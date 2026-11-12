import { NextRequest, NextResponse } from "next/server";

export const KEY_PATTERN = /^[a-z][a-z0-9_]{1,40}$/;

export function redirectTo(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url), 303);
}

export function withError(req: NextRequest, path: string, message: string) {
  return NextResponse.redirect(new URL(`${path}?error=${encodeURIComponent(message)}`, req.url), 303);
}
