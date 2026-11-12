import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { redirectTo } from "@/lib/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const form = await req.formData();
  const ipaId = Number(form.get("ipa_id")) || null;
  await pool.query(`update members set ipa_id = $2 where id = $1`, [Number(id), ipaId]);
  return redirectTo(req, `/admin/members/${id}`);
}
