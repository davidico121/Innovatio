import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";
import { dayProgress } from "@/lib/status";
import { memberStats } from "@/lib/stats";
import { monthStart, shiftDate, todayLagos, weekStart, TZ } from "@/lib/lagos";
import { freshStartLine, greeting, streakLine, todayNudge } from "@/lib/copy";
import LogForm from "./LogForm";
import PushButton from "./PushButton";
import Toaster from "./Toaster";
import Todos from "./Todos";
import Goals from "./Goals";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await currentMember();
  if (!me) {
    return <p>Open your personal sign-in link from your manager to continue.</p>;
  }

  const today = todayLagos();
  const yesterday = shiftDate(today, -1);
  const month = monthStart(today);
  const hour = Number(new Date().toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }));

  const [stats, yesterdayRows, todosRes, goalsRes] = await Promise.all([
    memberStats(me.id, today),
    dayProgress(me.id, yesterday),
    pool.query(
      `select id, title, scope, (done_at is not null) as done from todos
        where member_id = $1 and ((scope = 'day' and period_start = $2) or (scope = 'week' and period_start = $3))
        order by created_at`,
      [me.id, today, weekStart(today)],
    ),
    pool.query(`select id, title, target, progress from goals where member_id = $1 and month = $2 order by created_at`, [me.id, month]),
  ]);

  const missedYesterday = yesterdayRows.length > 0 && yesterdayRows.some((r) => !r.met);
  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  const dayTodos = todosRes.rows.filter((t) => t.scope === "day");
  const weekTodos = todosRes.rows.filter((t) => t.scope === "week");

  return (
    <main className="app stack">
      <Toaster />
      <header>
        <h1>{greeting(me.name, hour)}</h1>
        <p className="muted">{todayNudge(stats.todayPct, stats.allMetToday, stats.todayDue)}</p>
      </header>

      <section className="card hero">
        <div className="row between">
          <div>
            <div className="big">{stats.streak}</div>
            <p className="muted">{streakLine(stats.streak)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="muted">Best</p>
            <strong>{stats.bestStreak} {stats.bestStreak === 1 ? "day" : "days"}</strong>
          </div>
        </div>
        <div className="dots" aria-label="This week">
          {stats.week.map((d) => (
            <div key={d.date} className={`dot ${d.state}`}>
              {d.label}
              <span>{d.state === "met" ? "✓" : ""}</span>
            </div>
          ))}
        </div>
        {stats.weekDue > 0 && <p className="muted" style={{ marginTop: 10 }}>{stats.weekMet} of {stats.weekDue} working days done this week</p>}
      </section>

      {missedYesterday && stats.hasIpa && <p className="note">{freshStartLine()} You can still log yesterday's work below.</p>}

      <section className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Today</h2>
          {stats.todayDue && <span className={`pill ${stats.allMetToday ? "done" : ""}`}>{stats.todayPct}%</span>}
        </div>
        {!stats.hasIpa && <p className="muted" style={{ marginTop: 8 }}>Your targets are coming. Meanwhile, your day and goals below are all yours.</p>}
        {stats.hasIpa && !stats.todayDue && <p className="muted" style={{ marginTop: 8 }}>Not a working day for you. Nothing is due.</p>}
        <div style={{ marginTop: 12 }}>
          {stats.tasks.map((t) => (
            <div key={t.key} className="task">
              <div className="row between">
                <strong>{t.label}</strong>
                <span className={`pill ${t.met ? "done" : ""}`}>{t.done}/{t.daily_min}{t.met ? " done" : ""}</span>
              </div>
              <div className={`bar ${t.met ? "done" : ""}`}><i style={{ width: `${t.pct}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Log your work</h2>
        <LogForm
          work={stats.tasks.map((r) => ({ key: r.key, label: r.label, requires_proof: r.requires_proof }))}
          today={today}
          yesterday={yesterday}
        />
      </section>

      <Todos day={dayTodos} week={weekTodos} />
      <Goals goals={goalsRes.rows} monthLabel={monthLabel} />

      <section className="card">
        <h2>Reminders</h2>
        <p className="muted">Friendly nudges and the odd bit of encouragement, on this device.</p>
        <PushButton />
      </section>
      <p className="muted" style={{ textAlign: "center", fontSize: "0.85rem" }}>Your to-dos and goals are private. Only you can see them.</p>
    </main>
  );
}
