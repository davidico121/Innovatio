import { NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { todayLagos } from "@/lib/lagos";

export const dynamic = "force-dynamic";

/**
 * Counts one open of a resource for the day. Signed-in members only. It records how often a resource
 * is opened and nothing about who opened it, so the admin can see what is useful without seeing people.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return new NextResponse("Forbidden", { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ ok: false }, { status: 404 });
  try {
    await pool.query(
      `insert into resource_opens (resource_id, day, opens)
       select id, $2::date, 1 from resources where id = $1 and published
       on conflict (resource_id, day) do update set opens = resource_opens.opens + 1`,
      [id, todayLagos()],
    );
  } catch (err) {
    if (!isMissingSchema(err)) throw err; // counting must never get in the way of opening a link
  }
  return NextResponse.json({ ok: true });
}
