import { cookies } from "next/headers";
import { pool } from "./db";

export async function currentMember(): Promise<{ id: number; name: string; email: string } | null> {
  const token = (await cookies()).get("member_token")?.value;
  if (!token) return null;
  const { rows } = await pool.query(
    `select id, name, email from members where token = $1 and active`,
    [token],
  );
  return rows[0] ?? null;
}

export async function isAdmin(): Promise<boolean> {
  const c = (await cookies()).get("admin_token")?.value;
  return !!c && !!process.env.ADMIN_TOKEN && c === process.env.ADMIN_TOKEN;
}
