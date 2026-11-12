import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { redirectTo } from "@/lib/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const form = await req.formData();
  await pool.query(`delete from ipa_tasks where ipa_id = $1 and work_key = $2`, [Number(id), String(form.get("work_key") ?? "")]);
  return redirectTo(req, `/admin/ipas/${id}`);
}
