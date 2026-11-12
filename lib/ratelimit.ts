import { pool } from "./db";

const WINDOW = "15 minutes";
const MAX_PER_EMAIL = 8;
const MAX_PER_IP = 40;

/** Failed sign-ins are counted per email and per address, so guessing one account or many both get slowed. */
export async function isLockedOut(email: string, ip: string): Promise<boolean> {
  const { rows } = await pool.query(
    `select
       (select count(*)::int from login_attempts where key = $1 and created_at > now() - interval '${WINDOW}') as by_email,
       (select count(*)::int from login_attempts where ip = $2 and created_at > now() - interval '${WINDOW}') as by_ip`,
    [email, ip],
  );
  return rows[0].by_email >= MAX_PER_EMAIL || rows[0].by_ip >= MAX_PER_IP;
}

export async function recordFailure(email: string, ip: string) {
  await pool.query(`insert into login_attempts (key, ip) values ($1, $2)`, [email, ip]);
}

export async function clearFailures(email: string) {
  await pool.query(`delete from login_attempts where key = $1`, [email]);
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
