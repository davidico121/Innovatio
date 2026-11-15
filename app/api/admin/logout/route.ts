import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, OLD_ADMIN_COOKIE } from "@/lib/adminAuth";

/** Ends the admin session only. A team member session in the same browser stays signed in. */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.delete(ADMIN_COOKIE);
  res.cookies.delete(OLD_ADMIN_COOKIE);
  return res;
}
