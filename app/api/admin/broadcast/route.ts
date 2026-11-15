import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { sendEmail, sendPush } from "@/lib/notify";
import { renderEmailHtml } from "@/lib/emailTemplate";

export const dynamic = "force-dynamic";
// Sending to every member one by one, with a pause between emails, can outlast the host default.
export const maxDuration = 60;

// Not exported: a Next.js route file may only export its request handlers and settings.
const TITLE_MAX = 80;
const MESSAGE_MAX = 400;
/** The email service allows about two requests a second, so emails go out a little slower than that. */
const EMAIL_GAP_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Control characters and stray whitespace do not belong in a notification. */
const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max + 1);

async function sendOneEmail(to: string, subject: string, text: string, html: string) {
  try {
    await sendEmail(to, subject, text, html);
  } catch (err) {
    // One retry if the email service says slow down.
    if (!String((err as Error).message).includes("429")) throw err;
    await sleep(1500);
    await sendEmail(to, subject, text, html);
  }
}

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
  const app = process.env.APP_URL;
  let pushDevices = 0;
  let pushMembers = 0;
  let emailed = 0;
  let emailFailed = 0;

  for (const m of members) {
    try {
      const reached = await sendPush(m.id, title, message, "/");
      pushDevices += reached;
      if (reached > 0) pushMembers++;
    } catch (err) {
      console.error(`broadcast push failed for member ${m.id}`, err);
    }
  }

  if (alsoEmail) {
    for (const [i, m] of members.entries()) {
      if (i > 0) await sleep(EMAIL_GAP_MS);
      const first = m.name.split(" ")[0];
      try {
        await sendOneEmail(
          m.email,
          title,
          `Hi ${first},\n\n${message}\n\n${app ?? ""}`.trim(),
          renderEmailHtml(
            {
              preheader: message.slice(0, 110),
              heading: title,
              intro: [`Hi ${first},`, ...message.split(/\n{2,}/)],
              button: app ? { label: "Open the app", url: app } : undefined,
              footer: "A message from your team. Sent by Innovatio Team Tracker.",
            },
            app,
          ),
        );
        emailed++;
      } catch (err) {
        emailFailed++;
        console.error(`broadcast email failed for member ${m.id}`, err);
      }
    }
  }

  await pool.query(
    `update broadcasts set members = $2, push_members = $3, push_devices = $4, emailed = $5, email_failed = $6 where id = $1`,
    [id, members.length, pushMembers, pushDevices, emailed, emailFailed],
  );
  return NextResponse.json({ ok: true, members: members.length, pushMembers, pushDevices, emailed, emailFailed });
}
