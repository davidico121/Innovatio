import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";
import { monthStart, todayLagos } from "@/lib/lagos";

export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const b = await req.json();
  const title = String(b.title ?? "").trim().slice(0, 140);
  const target = Number(b.target);
  if (!title) return NextResponse.json({ error: "Name your goal" }, { status: 400 });
  if (!Number.isInteger(target) || target < 1 || target > 1000000) {
    return NextResponse.json({ error: "Set a target number, like 20" }, { status: 400 });
  }
  const month = monthStart(todayLagos());
  const n = await pool.query(`select count(*)::int as n from goals where member_id = $1 and month = $2`, [me.id, month]);
  if (n.rows[0].n >= 10) return NextResponse.json({ error: "Ten goals a month is plenty. Finish one first." }, { status: 400 });
  await pool.query(`insert into goals (member_id, title, month, target) values ($1, $2, $3, $4)`, [me.id, title, month, target]);
  return NextResponse.json({ ok: true });
}
