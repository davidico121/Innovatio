import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;

  const b = await req.json();
  const count = Number(b.count);
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    return NextResponse.json({ error: "Count must be a whole number" }, { status: 400 });
  }
  const proof = typeof b.proof_url === "string" ? b.proof_url.trim() : "";
  if (proof && !/^https?:\/\//.test(proof)) {
    return NextResponse.json({ error: "Proof must be a full link starting with https://" }, { status: 400 });
  }
  const notes = typeof b.notes === "string" ? b.notes.slice(0, 500) : "";

  const r = await pool.query(
    `update entries set count = $2, proof_url = $3, notes = $4 where id = $1`,
    [id, count, proof || null, notes || null],
  );
  if (r.rowCount === 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const r = await pool.query(`delete from entries where id = $1`, [id]);
  if (r.rowCount === 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
