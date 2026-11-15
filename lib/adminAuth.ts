import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Admin sign-in. One shared admin, set with three environment variables:
 *   ADMIN_USERNAME  the username. Optional, defaults to "admin". Set it to anything you like.
 *   ADMIN_PASSWORD  the password.
 *   ADMIN_TOKEN     the extra secret that was already there.
 * All three must match to sign in. If the password or the token is missing, nobody can sign in.
 *
 * A successful sign-in sets a signed cookie that holds an expiry time, a random sign-in id and a
 * signature. It never contains the username, password or token. The sign-in id lets a device that
 * turned on admin notifications be unlinked when that sign-in ends. The signing key is built from all three, so changing any
 * of them signs every admin out.
 */

export const ADMIN_COOKIE = "admin_session";
/** The cookie the app used before the username and password were added. It held the raw token, so it is cleared. */
export const OLD_ADMIN_COOKIE = "admin_token";
export const ADMIN_SESSION_HOURS = 12;

export function adminUsername(): string {
  return (process.env.ADMIN_USERNAME ?? "").trim() || "admin";
}

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD && !!process.env.ADMIN_TOKEN;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares two strings in constant time, whatever their lengths. */
function same(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

/** True only when the username, password and token all match. Every field is always checked, so the time taken says nothing about which one was wrong. */
export function checkAdminCredentials(username: string, password: string, token: string): boolean {
  if (!adminConfigured()) return false;
  const userOk = same(username.trim(), adminUsername());
  const passOk = same(password, process.env.ADMIN_PASSWORD!);
  const tokenOk = same(token, process.env.ADMIN_TOKEN!);
  return userOk && passOk && tokenOk;
}

function signingKey(): Buffer {
  return createHash("sha256")
    .update(`innovatio-admin-session-v1\n${adminUsername()}\n${process.env.ADMIN_PASSWORD}\n${process.env.ADMIN_TOKEN}`)
    .digest();
}

function sign(expires: number, id: string): string {
  return createHmac("sha256", signingKey()).update(`admin.${expires}.${id}`).digest("base64url");
}

/** A new cookie value, good for ADMIN_SESSION_HOURS. */
export function createAdminSession(now = Date.now()): string {
  const expires = now + ADMIN_SESSION_HOURS * 3_600_000;
  const id = randomBytes(12).toString("base64url");
  return `${expires}.${id}.${sign(expires, id)}`;
}

/** The sign-in id inside a genuine, unexpired cookie value, or null for anything else. */
export function adminSessionKey(value: string | undefined, now = Date.now()): string | null {
  if (!value || !adminConfigured()) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [expiresText, id, signature] = parts;
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || !/^[A-Za-z0-9_-]{16}$/.test(id) || !signature) return null;
  if (expires < now || expires > now + (ADMIN_SESSION_HOURS + 1) * 3_600_000) return null;
  return same(signature, sign(expires, id)) ? id : null;
}

/** True for a genuine, unexpired value made by createAdminSession. */
export function verifyAdminSession(value: string | undefined, now = Date.now()): boolean {
  return adminSessionKey(value, now) !== null;
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: true,
  // Strict also keeps other sites from making a signed-in admin's browser press the admin buttons.
  sameSite: "strict" as const,
  maxAge: ADMIN_SESSION_HOURS * 3600,
  path: "/",
};
