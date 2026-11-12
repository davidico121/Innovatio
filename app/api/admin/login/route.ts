import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get("token") ?? "");
  const ok = !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;

  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  if (ok) {
    res.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 12,
      path: "/",
    });
  }
  return res;
}
