import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  const r = await pool.query(
    `update todos set done_at = case when $3::boolean then coalesce(done_at, now()) else null end
      where id = $1 and member_id = $2`,
    [Number(id), me.id, !!b.done],
  );
  if (r.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  await pool.query(`delete from todos where id = $1 and member_id = $2`, [Number(id), me.id]);
  return NextResponse.json({ ok: true });
}
