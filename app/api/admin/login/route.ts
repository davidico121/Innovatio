import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, OLD_ADMIN_COOKIE, adminConfigured, adminCookieOptions, checkAdminCredentials, createAdminSession } from "@/lib/adminAuth";
import { clearFailures, clientIp, isLockedOut, recordFailure } from "@/lib/ratelimit";

function back(req: NextRequest, message: string) {
  return NextResponse.redirect(new URL(`/login?as=admin&error=${encodeURIComponent(message)}`, req.url), 303);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "").slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 500);
  const ip = clientIp(req.headers);
  // Failures are counted per address, so a stranger guessing cannot lock the real admin out.
  const key = `admin|${ip}`;

  if (!adminConfigured()) {
    return back(req, "Admin sign-in is not set up yet. Add ADMIN_TOKEN in your host settings.");
  }
  if (await isLockedOut(key, ip)) return back(req, "Too many tries. Wait 15 minutes, then try again.");
  if (!username.trim() || !password) return back(req, "Enter the username and password.");

  if (!checkAdminCredentials(username, password)) {
    await recordFailure(key, ip);
    return back(req, "Those details did not match.");
  }

  await clearFailures(key);
  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  res.cookies.set(ADMIN_COOKIE, createAdminSession(), adminCookieOptions);
  res.cookies.delete(OLD_ADMIN_COOKIE); // the old cookie held the raw token
  return res;
}
