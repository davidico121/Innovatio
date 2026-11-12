import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  const delta = Number(b.delta);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000000) {
    return NextResponse.json({ error: "Enter a whole number" }, { status: 400 });
  }
  const before = await pool.query(`select progress, target from goals where id = $1 and member_id = $2`, [Number(id), me.id]);
  if (!before.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await pool.query(
    `update goals set progress = greatest(0, progress + $3) where id = $1 and member_id = $2 returning progress, target, title`,
    [Number(id), me.id, delta],
  );
  const g = r.rows[0];
  const reached = before.rows[0].progress < g.target && g.progress >= g.target;
  return NextResponse.json({ ok: true, celebration: reached ? `Goal reached: ${g.title}. You did that.` : null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  await pool.query(`delete from goals where id = $1 and member_id = $2`, [Number(id), me.id]);
  return NextResponse.json({ ok: true });
}
