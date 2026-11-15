import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, OLD_ADMIN_COOKIE } from "@/lib/adminAuth";
import { currentAdminSessionKey } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";

/**
 * Ends the admin session only. A team member session in the same browser stays signed in, and so do
 * that member's reminders. The devices this admin sign-in turned admin notifications on for are unlinked.
 */
export async function POST(req: NextRequest) {
  const sessionKey = await currentAdminSessionKey();
  if (sessionKey) {
    try {
      await pool.query(`delete from admin_push_subscriptions where session_key = $1`, [sessionKey]);
    } catch (err) {
      if (!isMissingSchema(err)) throw err; // signing out must work even if the newest migration has not run
    }
  }
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.delete(ADMIN_COOKIE);
  res.cookies.delete(OLD_ADMIN_COOKIE);
  return res;
}
