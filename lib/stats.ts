import { pool } from "./db";
import { isDueDay, shiftDate, todayLagos, weekStart, weekdayShort } from "./lagos";
import { memberRequirements, type Requirement } from "./status";

export type WeekDot = { date: string; label: string; state: "met" | "missed" | "rest" | "today" | "upcoming" };

export type MemberStats = {
  hasIpa: boolean;
  todayDue: boolean;
  tasks: (Requirement & { done: number; met: boolean; pct: number })[];
  todayPct: number;
  allMetToday: boolean;
  streak: number;
  bestStreak: number;
  week: WeekDot[];
  weekMet: number;
  weekDue: number;
};

const LOOKBACK = 120;

export async function memberStats(memberId: number, today = todayLagos()): Promise<MemberStats> {
  const [reqs, ipa, entries] = await Promise.all([
    memberRequirements(memberId),
    pool.query(
      `select coalesce(i.counts_weekends, false) as w, (m.ipa_id is not null) as has,
              to_char(m.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD') as joined
         from members m left join ipas i on i.id = m.ipa_id where m.id = $1`,
      [memberId],
    ),
    pool.query(
      `select to_char(work_date, 'YYYY-MM-DD') as d, work_key, sum(count)::int as done
         from entries where member_id = $1 and work_date >= $2::date
        group by work_date, work_key`,
      [memberId, shiftDate(today, -LOOKBACK)],
    ),
  ]);
  const weekends: boolean = ipa.rows[0]?.w ?? false;
  const hasIpa: boolean = ipa.rows[0]?.has ?? false;
  const joined: string = ipa.rows[0]?.joined ?? "0000-00-00";
  const dueOn = (d: string) => d >= joined && isDueDay(d, weekends);
  const done = new Map<string, number>(entries.rows.map((r: { d: string; work_key: string; done: number }) => [`${r.d}|${r.work_key}`, r.done]));

  const metOn = (d: string) => reqs.length > 0 && reqs.every((r) => (done.get(`${d}|${r.key}`) ?? 0) >= r.daily_min);
  const todayDue = hasIpa && dueOn(today);

  const tasks = reqs.map((r) => {
    const d = done.get(`${today}|${r.key}`) ?? 0;
    return { ...r, done: d, met: d >= r.daily_min, pct: r.daily_min === 0 ? 100 : Math.min(100, Math.round((100 * d) / r.daily_min)) };
  });
  const todayPct = tasks.length ? Math.round(tasks.reduce((s, t) => s + t.pct, 0) / tasks.length) : 0;
  const allMetToday = todayDue && tasks.length > 0 && tasks.every((t) => t.met);

  // Current streak: due days, newest first. An unfinished today never breaks it.
  let streak = 0;
  for (let i = 0; i <= LOOKBACK; i++) {
    const d = shiftDate(today, -i);
    if (!dueOn(d)) continue;
    if (d === today && !metOn(d)) continue;
    if (!metOn(d)) break;
    streak++;
  }

  // Best streak over the lookback window, oldest first.
  let best = 0;
  let run = 0;
  for (let i = LOOKBACK; i >= 0; i--) {
    const d = shiftDate(today, -i);
    if (!dueOn(d)) continue;
    if (metOn(d)) {
      run++;
      best = Math.max(best, run);
    } else if (d !== today) {
      run = 0;
    }
  }

  const monday = weekStart(today);
  const week: WeekDot[] = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDate(monday, i);
    const label = weekdayShort(d);
    if (!hasIpa || !dueOn(d)) return { date: d, label, state: "rest" as const };
    if (d > today) return { date: d, label, state: "upcoming" as const };
    if (metOn(d)) return { date: d, label, state: "met" as const };
    return { date: d, label, state: d === today ? ("today" as const) : ("missed" as const) };
  });

  return {
    hasIpa,
    todayDue,
    tasks,
    todayPct,
    allMetToday,
    streak,
    bestStreak: Math.max(best, streak),
    week,
    weekMet: week.filter((w) => w.state === "met").length,
    weekDue: week.filter((w) => w.state !== "rest").length,
  };
}
