import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { deliverToMembers } from "@/lib/broadcast";

export const dynamic = "force-dynamic";
// Sending to every member one by one, with a pause between emails, can outlast the host default.
export const maxDuration = 60;

// Not exported: a Next.js route file may only export its request handlers and settings.
const TITLE_MAX = 80;
const MESSAGE_MAX = 400;

/** Control characters and stray whitespace do not belong in a notification. */
const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max + 1);

/**
 * Sends a message from the admin to every active member's devices, and optionally to their email too.
 * Admin only. The same message cannot go out twice within two minutes, so a double tap or a retry
 * does not message the whole team twice.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });

  const input = await req.json().catch(() => null);
  const title = clean(input?.title, TITLE_MAX);
  const message = clean(input?.message, MESSAGE_MAX);
  const alsoEmail = input?.email === true;

  if (!title) return NextResponse.json({ error: "Add a title." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Add a message." }, { status: 400 });
  if (title.length > TITLE_MAX) return NextResponse.json({ error: `Keep the title to ${TITLE_MAX} characters.` }, { status: 400 });
  if (message.length > MESSAGE_MAX) return NextResponse.json({ error: `Keep the message to ${MESSAGE_MAX} characters.` }, { status: 400 });

  // Record it first, under a lock, so two identical sends at the same moment cannot both go through.
  let id: number;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(7243002)");
    const dup = await client.query(
      `select 1 from broadcasts where title = $1 and body = $2 and created_at > now() - interval '2 minutes'`,
      [title, message],
    );
    if (dup.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "That exact message was just sent. Change it, or wait two minutes, to send it again." }, { status: 409 });
    }
    const ins = await client.query(`insert into broadcasts (title, body, also_email) values ($1, $2, $3) returning id`, [title, message, alsoEmail]);
    id = ins.rows[0].id;
    await client.query("commit");
  } catch (err) {
    try { await client.query("rollback"); } catch { /* already rolled back */ }
    if (isMissingSchema(err)) {
      return NextResponse.json({ error: "Broadcasts are not ready yet. They will be after the next deploy." }, { status: 503 });
    }
    throw err;
  } finally {
    client.release();
  }

  const members = (await pool.query(`select id, name, email from members where active order by id`)).rows as { id: number; name: string; email: string }[];
  const { pushMembers, pushDevices, emailed, emailFailed } = await deliverToMembers(members, { title, message, path: "/", email: alsoEmail });

  await pool.query(
    `update broadcasts set members = $2, push_members = $3, push_devices = $4, emailed = $5, email_failed = $6 where id = $1`,
    [id, members.length, pushMembers, pushDevices, emailed, emailFailed],
  );
  return NextResponse.json({ ok: true, members: members.length, pushMembers, pushDevices, emailed, emailFailed });
}
