import { pool } from "./db";
import { isDueDay, recentDates, shiftDate } from "./lagos";

/** Completion rate below this (over completed days) gets flagged for follow-up. */
export const FLAG_RATE = 70;

export type Requirement = {
  key: string;
  label: string;
  daily_min: number;
  requires_proof: boolean;
};

export type DayRow = Requirement & { done: number; met: boolean };

/** The member's targets come from their IPA. A member with no IPA has none. */
export async function memberRequirements(memberId: number): Promise<Requirement[]> {
  const { rows } = await pool.query(
    `select t.work_key as key, w.label, t.daily_min, t.requires_proof
       from members m
       join ipa_tasks t on t.ipa_id = m.ipa_id
       join work_types w on w.key = t.work_key
      where m.id = $1
      order by w.label`,
    [memberId],
  );
  return rows;
}

/** Whether the member's IPA counts this date. A member with no IPA is never due. */
export async function isMemberDue(memberId: number, date: string): Promise<boolean> {
  const { rows } = await pool.query(
    `select i.counts_weekends, to_char(m.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD') as joined
       from members m join ipas i on i.id = m.ipa_id where m.id = $1`,
    [memberId],
  );
  return rows[0] ? date >= rows[0].joined && isDueDay(date, rows[0].counts_weekends) : false;
}

export async function dayProgress(memberId: number, date: string): Promise<DayRow[]> {
  if (!(await isMemberDue(memberId, date))) return [];
  const reqs = await memberRequirements(memberId);
  const { rows } = await pool.query(
    `select work_key, coalesce(sum(count), 0)::int as done
       from entries
      where member_id = $1 and work_date = $2::date
      group by work_key`,
    [memberId, date],
  );
  const done = new Map(rows.map((r: { work_key: string; done: number }) => [r.work_key, r.done]));
  return reqs.map((r) => {
    const d = done.get(r.key) ?? 0;
    return { ...r, done: d, met: d >= r.daily_min };
  });
}

export type ConsistencyRow = {
  id: number;
  name: string;
  email: string;
  ipaName: string | null;
  days: number;
  metDays: number;
  rate: number;
  streak: number;
  lastLogged: string | null;
  remindersOn: boolean;
};

/**
 * Scores the last `days` completed days (today excluded, so a half-finished
 * day never counts against anyone). Newest completed day is index 0.
 */
export async function consistencyReport(days: number): Promise<ConsistencyRow[]> {
  const dates = recentDates(days + 1).slice(1);
  const from = dates[dates.length - 1];

  const members = (
    await pool.query(
      `select m.id, m.name, m.email, i.name as ipa_name, i.counts_weekends,
              to_char(m.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD') as joined
         from members m left join ipas i on i.id = m.ipa_id
        where m.active order by m.name`,
    )
  ).rows as { id: number; name: string; email: string; ipa_name: string | null; counts_weekends: boolean | null; joined: string }[];

  const reqs = (
    await pool.query(
      `select m.id as member_id, t.work_key as key, t.daily_min
         from members m join ipa_tasks t on t.ipa_id = m.ipa_id`,
    )
  ).rows as { member_id: number; key: string; daily_min: number }[];

  const ent = (
    await pool.query(
      `select member_id, to_char(work_date, 'YYYY-MM-DD') as d, work_key,
              sum(count)::int as done
         from entries
        where work_date >= $1::date
        group by member_id, work_date, work_key`,
      [from],
    )
  ).rows as { member_id: number; d: string; work_key: string; done: number }[];

  const lastRows = (
    await pool.query(
      `select member_id, to_char(max(work_date), 'YYYY-MM-DD') as last from entries group by member_id`,
    )
  ).rows as { member_id: number; last: string }[];
  const lastByMember = new Map(lastRows.map((r) => [r.member_id, r.last]));

  const deviceRows = (
    await pool.query(`select distinct member_id from push_subscriptions`)
  ).rows as { member_id: number }[];
  const devices = new Set(deviceRows.map((r) => r.member_id));

  const done = new Map<string, number>();
  for (const e of ent) done.set(`${e.member_id}|${e.d}|${e.work_key}`, e.done);

  return members.map((m) => {
    const mine = reqs.filter((r) => r.member_id === m.id);
    const dueDates = dates.filter((d) => d >= m.joined && m.counts_weekends !== null && isDueDay(d, m.counts_weekends));
    const metByDate = dueDates.map(
      (d) =>
        mine.length > 0 &&
        mine.every((r) => (done.get(`${m.id}|${d}|${r.key}`) ?? 0) >= r.daily_min),
    );
    const metDays = metByDate.filter(Boolean).length;
    let streak = 0;
    for (const ok of metByDate) {
      if (!ok) break;
      streak++;
    }
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      ipaName: m.ipa_name,
      days: dueDates.length,
      metDays,
      rate: dueDates.length === 0 ? 100 : Math.round((100 * metDays) / dueDates.length),
      streak,
      lastLogged: lastByMember.get(m.id) ?? null,
      remindersOn: devices.has(m.id),
    };
  });
}

export function isFlagged(r: { rate: number; days: number; lastLogged: string | null }, today: string): boolean {
  if (r.days === 0) return false;
  return r.rate < FLAG_RATE || r.lastLogged === null || r.lastLogged < shiftDate(today, -2);
}

async function memberCalendar(memberId: number): Promise<{ weekends: boolean; joined: string }> {
  const { rows } = await pool.query(
    `select coalesce(i.counts_weekends, false) as w,
            to_char(m.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD') as joined
       from members m left join ipas i on i.id = m.ipa_id where m.id = $1`,
    [memberId],
  );
  return { weekends: rows[0]?.w ?? false, joined: rows[0]?.joined ?? "0000-00-00" };
}

export type TypeRow = { key: string; label: string; daily_min: number; metDays: number; days: number };

/** Per work type: how many of the last `days` completed days the member hit its target. */
export async function typeBreakdown(memberId: number, days: number): Promise<TypeRow[]> {
  const { weekends, joined } = await memberCalendar(memberId);
  const dates = recentDates(days + 1).slice(1).filter((d) => d >= joined && isDueDay(d, weekends));
  const from = recentDates(days + 1).slice(1).pop()!;
  const reqs = await memberRequirements(memberId);
  const { rows } = await pool.query(
    `select to_char(work_date, 'YYYY-MM-DD') as d, work_key, sum(count)::int as done
       from entries
      where member_id = $1 and work_date >= $2::date
      group by work_date, work_key`,
    [memberId, from],
  );
  const done = new Map(rows.map((r: { d: string; work_key: string; done: number }) => [`${r.d}|${r.work_key}`, r.done]));
  return reqs.map((r) => ({
    key: r.key,
    label: r.label,
    daily_min: r.daily_min,
    metDays: dates.filter((d) => (done.get(`${d}|${r.key}`) ?? 0) >= r.daily_min).length,
    days: dates.length,
  }));
}

export type EntryRow = {
  id: number;
  work_date: string;
  label: string;
  count: number;
  proof_url: string | null;
  has_image: boolean;
  notes: string | null;
};

/** Entries from the last `days` days including today, newest first. */
export async function memberEntries(memberId: number, days: number): Promise<EntryRow[]> {
  const from = recentDates(days)[days - 1];
  const { rows } = await pool.query(
    `select e.id, to_char(e.work_date, 'YYYY-MM-DD') as work_date, wt.label,
            e.count, e.proof_url, (e.proof_image is not null) as has_image, e.notes
       from entries e
       join work_types wt on wt.key = e.work_key
      where e.member_id = $1 and e.work_date >= $2::date
      order by e.work_date desc, e.id desc`,
    [memberId, from],
  );
  return rows;
}
