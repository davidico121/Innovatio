import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { parseResourceInput } from "@/lib/resourceInput";
import { announceResource } from "@/lib/resourceNotify";

export const dynamic = "force-dynamic";
// Telling the team can send an email to every member one by one, which can outlast the host default.
export const maxDuration = 60;

/** Adds a resource. Admin only. Optionally tells the team about it straight away. */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const input = await req.json().catch(() => null);
  const parsed = parseResourceInput(input, false);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;
  const published = (input as { published?: unknown }).published !== false;

  let id: number;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const ins = await client.query(
      `insert into resources (title, url, kind, category, description, pinned, published, position)
       values ($1, $2, $3, $4, $5, $6, $7, (select coalesce(max(position), 0) + 1 from resources)) returning id`,
      [f.title, f.url, f.kind, f.category, f.description, f.pinned === true, published],
    );
    id = ins.rows[0].id;
    if (f.ipaIds?.length) {
      await client.query(
        `insert into resource_ipas (resource_id, ipa_id) select $1, id from ipas where id = any($2::int[])`,
        [id, f.ipaIds],
      );
    }
    await client.query("commit");
  } catch (err) {
    try { await client.query("rollback"); } catch { /* already rolled back */ }
    if (isMissingSchema(err)) return NextResponse.json({ error: "Resources are not ready yet. They will be after the next deploy." }, { status: 503 });
    throw err;
  } finally {
    client.release();
  }

  const wantsNotify = (input as { notify?: unknown }).notify === true;
  if (!wantsNotify || !published) return NextResponse.json({ ok: true, id });
  try {
    const told = await announceResource(id, (input as { email?: unknown }).email === true);
    return NextResponse.json({ ok: true, id, told, notifyNote: told ? undefined : "The team was told about this a moment ago, so it was not sent again." });
  } catch (err) {
    console.error("resource announcement failed", err);
    return NextResponse.json({ ok: true, id, notifyNote: "The resource was saved, but telling the team failed. You can try again from its edit page." });
  }
}
