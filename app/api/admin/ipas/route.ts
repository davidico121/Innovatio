import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { redirectTo, withError } from "@/lib/admin";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const description = String(form.get("description") ?? "").trim().slice(0, 1000);
  const countsWeekends = form.get("counts_weekends") === "on";
  if (!name) return withError(req, "/admin/ipas", "IPA name is required");
  const { rows } = await pool.query(
    `insert into ipas (name, description, counts_weekends) values ($1, $2, $3) returning id`,
    [name, description, countsWeekends],
  );
  return redirectTo(req, `/admin/ipas/${rows[0].id}`);
}
