import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { pool } from "./db";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 180;

export type SessionMember = { id: number; name: string; email: string; mustSetup: boolean };

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

/** Creates a session row and returns the raw cookie value. Only its hash is stored. */
export async function createSession(memberId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `insert into sessions (member_id, token_hash, expires_at) values ($1, $2, now() + make_interval(days => $3))`,
    [memberId, sha(token), SESSION_DAYS],
  );
  return token;
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  options: {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: "/",
  },
};

export async function destroySession(token: string | undefined) {
  if (token) await pool.query(`delete from sessions where token_hash = $1`, [sha(token)]);
}

/** Signs a member out everywhere, optionally keeping the session they are using now. */
export async function revokeSessions(memberId: number, keepToken?: string) {
  await pool.query(`delete from sessions where member_id = $1 and token_hash <> $2`, [memberId, keepToken ? sha(keepToken) : ""]);
}

/** The signed-in member, even if they still have to choose their own password. */
export async function currentSession(): Promise<SessionMember | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { rows } = await pool.query(
    `select m.id, m.name, m.email, m.must_setup
       from sessions s join members m on m.id = s.member_id
      where s.token_hash = $1 and s.expires_at > now() and m.active`,
    [sha(token)],
  );
  const r = rows[0];
  return r ? { id: r.id, name: r.name, email: r.email, mustSetup: r.must_setup } : null;
}

/** The signed-in member, only once their account is fully set up. Every data route uses this. */
export async function currentMember(): Promise<{ id: number; name: string; email: string } | null> {
  const s = await currentSession();
  return s && !s.mustSetup ? { id: s.id, name: s.name, email: s.email } : null;
}

export async function isAdmin(): Promise<boolean> {
  const c = (await cookies()).get("admin_token")?.value;
  return !!c && !!process.env.ADMIN_TOKEN && c === process.env.ADMIN_TOKEN;
}
