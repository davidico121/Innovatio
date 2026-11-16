import { pool } from "./db";

/**
 * How many items are on a member's own day list for a date. Used only by the plan reminders, to leave
 * out anyone who has already planned. It counts and returns a number: it never reads a title, and it is
 * never used by any admin screen or admin query. A member's to-dos stay private to the member.
 */
export async function planCount(memberId: number, date: string): Promise<number> {
  const { rows } = await pool.query(
    `select count(*)::int as n from todos where member_id = $1 and scope = 'day' and period_start = $2`,
    [memberId, date],
  );
  return rows[0].n;
}
