import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { SESSION_COOKIE, currentMember, revokeSessions } from "@/lib/auth";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/password";
import { clientIp, isLockedOut, recordFailure } from "@/lib/ratelimit";

function back(req: NextRequest, key: "error" | "ok", message: string) {
  return NextResponse.redirect(new URL(`/account?${key}=${encodeURIComponent(message)}`, req.url), 303);
}

export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login", req.url), 303);

  const form = await req.formData();
  const current = String(form.get("current") ?? "");
  const ip = clientIp(req.headers);
  const email = me.email.toLowerCase();

  // Changing a password needs the old one, and wrong guesses count like failed sign-ins.
  if (await isLockedOut(email, ip)) return back(req, "error", "Too many tries. Wait 15 minutes, then try again.");
  const { rows } = await pool.query(`select password_hash from members where id = $1`, [me.id]);
  if (!(await verifyPassword(current, rows[0]?.password_hash ?? null))) {
    await recordFailure(email, ip);
    return back(req, "error", "Your current password is not right.");
  }

  const error = validateNewPassword(String(form.get("password") ?? ""), String(form.get("confirm") ?? ""), [me.email, current]);
  if (error) return back(req, "error", error);

  await pool.query(`update members set password_hash = $2 where id = $1`, [me.id, await hashPassword(String(form.get("password")))]);
  await revokeSessions(me.id, (await cookies()).get(SESSION_COOKIE)?.value);
  return back(req, "ok", "Password changed. Any other devices were signed out.");
}
