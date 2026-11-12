import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { clearFailures, clientIp, isLockedOut, recordFailure } from "@/lib/ratelimit";

function back(req: NextRequest, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url), 303);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 200);
  const ip = clientIp(req.headers);

  if (!email || !password) return back(req, "Enter your email and password.");
  if (await isLockedOut(email, ip)) {
    return back(req, "Too many tries. Wait 15 minutes, then try again.");
  }

  const { rows } = await pool.query(
    `select id, password_hash, must_setup, temp_expires_at, (temp_expires_at < now()) as temp_expired
       from members where lower(email) = $1 and active`,
    [email],
  );
  const m = rows[0];
  // Runs the same hashing work even when the email is unknown, so timing gives nothing away.
  const ok = await verifyPassword(password, m?.password_hash ?? null);

  if (!m || !ok) {
    await recordFailure(email, ip);
    return back(req, "That email and password do not match.");
  }
  if (m.must_setup && m.temp_expired) {
    return back(req, "Your temporary password has expired. Ask your manager to send a new invite.");
  }

  await clearFailures(email);
  await pool.query(`update members set last_login_at = now() where id = $1`, [m.id]);
  const token = await createSession(m.id);
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return res;
}
