import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { redirectTo } from "@/lib/admin";
import { sendInvite } from "@/lib/invite";
import { withError } from "@/lib/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const ipaId = Number(form.get("ipa_id")) || null;

  if (!name) return withError(req, "/admin", "Name is required");
  if (!EMAIL.test(email)) return withError(req, "/admin", "Enter a valid email");

  const { rows } = await pool.query(
    `insert into members (name, email, ipa_id) values ($1, $2, $3)
     on conflict (email) do nothing returning id`,
    [name, email, ipaId],
  );
  if (rows.length === 0) return withError(req, "/admin", "A member with that email already exists");
  const invite = await sendInvite(rows[0].id);
  const note = invite.ok ? `notice=${encodeURIComponent(`Invite sent to ${email}.`)}` : `error=${encodeURIComponent(`Member added. ${invite.error}`)}`;
  return redirectTo(req, `/admin/members/${rows[0].id}?${note}`);
}
