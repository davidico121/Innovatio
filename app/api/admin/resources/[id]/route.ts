import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { parseResourceInput } from "@/lib/resourceInput";
import { announceResource } from "@/lib/resourceNotify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COLUMNS: Record<string, string> = {
  title: "title",
  url: "url",
  kind: "kind",
  category: "category",
  description: "description",
  pinned: "pinned",
  published: "published",
};

/**
 * Changes a resource. Admin only. Send only what changed: the quick actions in the list send just
 * `pinned` or `published`, and the edit form sends everything. `notify` tells the team afterwards.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const input = await req.json().catch(() => null);
  const parsed = parseResourceInput(input, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields as Record<string, unknown>;

  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, col] of Object.entries(COLUMNS)) {
    if (f[key] !== undefined) {
      values.push(f[key]);
      sets.push(`${col} = $${values.length}`);
    }
  }
  const ipaIds = f.ipaIds as number[] | undefined;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const exists = await client.query(`select 1 from resources where id = $1 for update`, [id]);
    if (!exists.rowCount) {
      await client.query("rollback");
      return NextResponse.json({ error: "That resource no longer exists." }, { status: 404 });
    }
    if (sets.length) await client.query(`update resources set ${sets.join(", ")}, updated_at = now() where id = $1`, values);
    if (ipaIds) {
      await client.query(`delete from resource_ipas where resource_id = $1`, [id]);
      if (ipaIds.length) {
        await client.query(`insert into resource_ipas (resource_id, ipa_id) select $1, id from ipas where id = any($2::int[])`, [id, ipaIds]);
      }
      if (!sets.length) await client.query(`update resources set updated_at = now() where id = $1`, [id]);
    }
    await client.query("commit");
  } catch (err) {
    try { await client.query("rollback"); } catch { /* already rolled back */ }
    if (isMissingSchema(err)) return NextResponse.json({ error: "Resources are not ready yet. They will be after the next deploy." }, { status: 503 });
    throw err;
  } finally {
    client.release();
  }

  const body = input as { notify?: unknown; email?: unknown };
  if (body.notify !== true) return NextResponse.json({ ok: true, id });
  try {
    const told = await announceResource(id, body.email === true);
    return NextResponse.json({
      ok: true,
      id,
      told,
      notifyNote: told ? undefined : "The team was told about this a moment ago, or it is still a draft, so nothing was sent.",
    });
  } catch (err) {
    console.error("resource announcement failed", err);
    return NextResponse.json({ ok: true, id, notifyNote: "Your changes were saved, but telling the team failed." });
  }
}

/** Removes a resource and its open counts. Admin only. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await pool.query(`delete from resources where id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
