import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { redirectTo, withError, KEY_PATTERN } from "@/lib/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const path = `/admin/ipas/${id}`;

  const form = await req.formData();
  const dailyMin = Number(form.get("daily_min"));
  const requiresProof = form.get("requires_proof") === "on";
  if (!Number.isInteger(dailyMin) || dailyMin < 0 || dailyMin > 100000) {
    return withError(req, path, "Daily minimum must be a whole number");
  }

  let workKey = String(form.get("work_key") ?? "");
  const newLabel = String(form.get("new_label") ?? "").trim().slice(0, 100);
  if (workKey === "__new__") {
    const newKey = String(form.get("new_key") ?? "").trim().toLowerCase();
    if (!KEY_PATTERN.test(newKey)) {
      return withError(req, path, "New key must be lowercase letters, numbers and underscores");
    }
    if (!newLabel) return withError(req, path, "Give the new work type a name");
    await pool.query(
      `insert into work_types (key, label) values ($1, $2) on conflict (key) do nothing`,
      [newKey, newLabel],
    );
    workKey = newKey;
  }

  const exists = await pool.query(`select 1 from work_types where key = $1`, [workKey]);
  if (exists.rowCount === 0) return withError(req, path, "Choose a work type");

  await pool.query(
    `insert into ipa_tasks (ipa_id, work_key, daily_min, requires_proof) values ($1, $2, $3, $4)
     on conflict (ipa_id, work_key) do update
       set daily_min = excluded.daily_min, requires_proof = excluded.requires_proof`,
    [Number(id), workKey, dailyMin, requiresProof],
  );
  return redirectTo(req, path);
}
