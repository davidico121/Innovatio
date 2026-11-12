import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";
import { todayLagos, weekStart } from "@/lib/lagos";

export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const b = await req.json();
  const title = String(b.title ?? "").trim().slice(0, 140);
  const scope = b.scope === "week" ? "week" : "day";
  if (!title) return NextResponse.json({ error: "Write what you want to get done" }, { status: 400 });

  const today = todayLagos();
  const count = await pool.query(
    `select count(*)::int as n from todos where member_id = $1 and scope = $2 and period_start = $3`,
    [me.id, scope, scope === "week" ? weekStart(today) : today],
  );
  if (count.rows[0].n >= 30) return NextResponse.json({ error: "That is plenty for one list. Finish a few first." }, { status: 400 });

  await pool.query(
    `insert into todos (member_id, title, scope, period_start) values ($1, $2, $3, $4)`,
    [me.id, title, scope, scope === "week" ? weekStart(today) : today],
  );
  return NextResponse.json({ ok: true });
}
