import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { SESSION_COOKIE, currentSession, revokeSessions } from "@/lib/auth";
import { hashPassword, validateNewPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const s = await currentSession();
  if (!s) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (!s.mustSetup) return NextResponse.redirect(new URL("/", req.url), 303);

  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const error = validateNewPassword(password, String(form.get("confirm") ?? ""), [s.email]);
  if (error) {
    return NextResponse.redirect(new URL(`/welcome?error=${encodeURIComponent(error)}`, req.url), 303);
  }

  await pool.query(
    `update members set password_hash = $2, must_setup = false, temp_expires_at = null where id = $1`,
    [s.id, await hashPassword(password)],
  );
  await revokeSessions(s.id, (await cookies()).get(SESSION_COOKIE)?.value);
  return NextResponse.redirect(new URL("/", req.url), 303);
}
