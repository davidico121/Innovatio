import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { redirectTo } from "@/lib/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const form = await req.formData();
  await pool.query(`update ipas set counts_weekends = $2 where id = $1`, [
    Number(id),
    form.get("counts_weekends") === "on",
  ]);
  return redirectTo(req, `/admin/ipas/${id}`);
}
