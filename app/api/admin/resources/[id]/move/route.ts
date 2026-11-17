import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Moves a resource one place up or down the list. Admin only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const id = Number((await params).id);
  const dir = (await req.json().catch(() => null))?.direction;
  if (!Number.isInteger(id) || id < 1 || (dir !== "up" && dir !== "down")) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(7243003)"); // two quick taps must not shuffle against each other
    const ids = (await client.query(`select id from resources order by position, id`)).rows.map((r) => r.id as number);
    const at = ids.indexOf(id);
    const to = dir === "up" ? at - 1 : at + 1;
    if (at >= 0 && to >= 0 && to < ids.length) {
      [ids[at], ids[to]] = [ids[to], ids[at]];
    }
    // Renumber the whole list so ties and gaps never cause a surprise.
    await client.query(`update resources r set position = o.n from (select unnest($1::int[]) as id, generate_series(1, $2::int) as n) o where r.id = o.id`, [ids, ids.length]);
    await client.query("commit");
  } catch (err) {
    try { await client.query("rollback"); } catch { /* already rolled back */ }
    throw err;
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
}
