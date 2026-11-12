import { NextRequest, NextResponse } from "next/server";
import { currentMember, isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows } = await pool.query(
    `select member_id, proof_image, proof_image_type from entries where id = $1`,
    [Number(id)],
  );
  const e = rows[0];
  if (!e?.proof_image) return new NextResponse("Not found", { status: 404 });

  const admin = await isAdmin();
  const me = admin ? null : await currentMember();
  if (!admin && me?.id !== e.member_id) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(e.proof_image, {
    headers: { "Content-Type": e.proof_image_type, "Cache-Control": "private, max-age=3600" },
  });
}
