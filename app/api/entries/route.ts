import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";
import { todayLagos, shiftDate } from "@/lib/lagos";
import { memberRequirements } from "@/lib/status";

export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json();
  const today = todayLagos();
  const workDate = b.work_date || today;
  if (workDate !== today && workDate !== shiftDate(today, -1)) {
    return NextResponse.json({ error: "You can only log today or yesterday" }, { status: 400 });
  }

  const count = Number(b.count);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    return NextResponse.json({ error: "Count must be a whole number" }, { status: 400 });
  }

  const requirement = (await memberRequirements(me.id)).find((r) => r.key === b.work_key);
  if (!requirement) {
    return NextResponse.json({ error: "That work type is not assigned to you" }, { status: 400 });
  }

  const proof = typeof b.proof_url === "string" ? b.proof_url.trim() : "";
  if (requirement.requires_proof && !/^https?:\/\//.test(proof)) {
    return NextResponse.json({ error: "A proof link is required for this work type" }, { status: 400 });
  }

  const notes = typeof b.notes === "string" ? b.notes.slice(0, 500) : null;
  await pool.query(
    `insert into entries (member_id, work_date, work_key, count, proof_url, notes)
     values ($1, $2, $3, $4, $5, $6)`,
    [me.id, workDate, b.work_key, count, proof || null, notes || null],
  );
  return NextResponse.json({ ok: true });
}
