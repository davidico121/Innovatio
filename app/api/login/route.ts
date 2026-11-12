import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const { rows } = await pool.query(`select id from members where token = $1 and active`, [token]);
  if (!rows[0]) return new NextResponse("This sign-in link is not valid.", { status: 403 });

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("member_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
