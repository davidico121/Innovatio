import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { dayOfYear, shiftDate, todayLagos } from "@/lib/lagos";
import { PROOF_RETENTION_DAYS, consistencyReport, isFlagged, isMemberDue } from "@/lib/status";
import { memberStats } from "@/lib/stats";
import { sendEmail, sendPush } from "@/lib/notify";
import { MILESTONES, milestoneLine, quoteFor } from "@/lib/copy";
import { renderEmailHtml, type EmailDot } from "@/lib/emailTemplate";

export const dynamic = "force-dynamic";
// Sending to every member one by one can outlast the host default, so ask for the maximum.
export const maxDuration = 60;

/**
 * Trigger from any scheduler with header `Authorization: Bearer $CRON_SECRET`:
 *   ?kind=morning  clean-slate or streak message, plus milestone emails
 *   ?kind=evening  gentle nudge for anyone with today still open
 *   ?kind=quote    an occasional encouragement (every other day, pushes only)
 *   ?kind=weekly   a recap email for the week just finished (Mondays only, add &force=1 to override)
 *   ?kind=digest   email the admin: who needs a nudge, who is doing well
 *   ?kind=cleanup  delete screenshots older than 60 days, old reminder logs, expired sessions
 *
 * A reminder is recorded only after it goes out, so a failure is retried by
 * the next run, and one failing member never stops the others.
 */
const ADMIN_KEY = 0;

type Msg = { title: string; body: string; email?: { subject: string; text: string; html?: string }; emailAlways?: boolean };
type Member = { id: number; name: string; email: string };

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const kind = req.nextUrl.searchParams.get("kind");
  if (!["morning", "evening", "quote", "weekly", "digest", "cleanup"].includes(kind ?? "")) {
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  }
  const today = todayLagos();
  const yesterday = shiftDate(today, -1);
  const app = process.env.APP_URL;
  const members = (await pool.query(`select id, name, email from members where active`)).rows as Member[];

  async function alreadySent(memberId: number, k: string) {
    const r = await pool.query(`select 1 from reminder_log where member_id = $1 and kind = $2 and sent_on = $3`, [memberId, k, today]);
    return (r.rowCount ?? 0) > 0;
  }
  async function markSent(memberId: number, k: string) {
    await pool.query(`insert into reminder_log (member_id, kind, sent_on) values ($1, $2, $3) on conflict do nothing`, [memberId, k, today]);
  }

  let sent = 0;
  const failed: number[] = [];

  /** Push first. Email is the fallback when no device was reached, or always for big moments. */
  async function perMember(k: string, build: (m: Member) => Promise<Msg | null>) {
    for (const m of members) {
      try {
        if (await alreadySent(m.id, k)) continue;
        const msg = await build(m);
        if (!msg) continue;
        const delivered = await sendPush(m.id, msg.title, msg.body, "/");
        if (msg.email && (msg.emailAlways || delivered === 0)) await sendEmail(m.email, msg.email.subject, msg.email.text, msg.email.html);
        await markSent(m.id, k);
        sent++;
      } catch (err) {
        failed.push(m.id);
        console.error(`reminder ${k} failed for member ${m.id}`, err);
      }
    }
  }

  if (kind === "morning") {
    await perMember("morning", async (m) => {
      if (!(await isMemberDue(m.id, today))) return null;
      const s = await memberStats(m.id, yesterday);
      const wasDue = await isMemberDue(m.id, yesterday);
      const first = m.name.split(" ")[0];

      if (wasDue && s.allMetToday) {
        const milestone = MILESTONES.includes(s.streak);
        const line = milestone ? milestoneLine(s.streak) : `You hit every target yesterday. ${s.streak} in a row. Keep it rolling.`;
        return {
          title: milestone ? `${s.streak} day streak` : "Nice work yesterday",
          body: line,
          emailAlways: milestone,
          email: {
            subject: `${s.streak} days in a row, ${first}`,
            text: `Hi ${first},\n\n${line}\n\nThat did not happen by accident. You kept showing up.\n\nKeep it going: ${app}`,
            html: renderEmailHtml(
              {
                preheader: line,
                heading: milestone ? "A streak worth being proud of" : "Nice work yesterday",
                intro: [`Hi ${first},`, line],
                hero: { value: String(s.streak), label: s.streak === 1 ? "day in a row" : "days in a row" },
                outro: ["That did not happen by accident. You kept showing up."],
                button: app ? { label: "Keep it going", url: app } : undefined,
              },
              app,
            ),
          },
        };
      }
      const todayTasks = (await memberStats(m.id, today)).tasks;
      const todays = todayTasks.map((t) => `${t.label} ${t.daily_min}`).join(", ");
      return {
        title: "A fresh day",
        body: wasDue ? `Yesterday is done. Today is a clean page: ${todays}.` : `Today's targets: ${todays}.`,
        email: {
          subject: "A fresh day",
          text: `Hi ${first},\n\nToday is a clean page. Targets: ${todays}.\n\nYour streak restarts the moment you finish them. Start here: ${app}`,
          html: renderEmailHtml(
            {
              preheader: `Today is a clean page. Targets: ${todays}.`,
              heading: "A fresh day",
              intro: [`Hi ${first},`, "Today is a clean page."],
              sections: [{ title: "Today's targets", rows: todayTasks.map((t) => ({ label: t.label, value: String(t.daily_min) })) }],
              outro: ["Your streak restarts the moment you finish them."],
              button: app ? { label: "Start here", url: app } : undefined,
            },
            app,
          ),
        },
      };
    });
  }

  if (kind === "evening") {
    await perMember("evening", async (m) => {
      const s = await memberStats(m.id, today);
      if (!s.todayDue || s.allMetToday) return null;
      const first = m.name.split(" ")[0];
      const open = s.tasks.filter((t) => !t.met);
      const left = open.map((t) => `${t.label} ${t.daily_min - t.done} to go`).join(", ");
      const title = s.streak > 0 ? `Keep your ${s.streak}-day streak` : "Still time today";
      const body =
        s.todayPct >= 50
          ? `You are ${s.todayPct}% there. ${left}.`
          : s.todayPct > 0
            ? `You have started, which is the hard part. ${left}.`
            : `${left}. Start with the first one and the rest follows.`;
      const lead =
        s.todayPct >= 50
          ? `You are ${s.todayPct}% there.`
          : s.todayPct > 0
            ? "You have started, which is the hard part."
            : "Start with the first one and the rest follows.";
      return {
        title,
        body,
        email: {
          subject: title,
          text: `Hi ${first},\n\n${body}\n\nLog your work here: ${app}`,
          html: renderEmailHtml(
            {
              preheader: body,
              heading: title,
              intro: [`Hi ${first},`, lead],
              sections: [{ title: "Still open today", rows: open.map((t) => ({ label: t.label, value: `${t.daily_min - t.done} to go` })) }],
              button: app ? { label: "Log your work", url: app } : undefined,
            },
            app,
          ),
        },
      };
    });
  }

  if (kind === "quote") {
    // Every other day per member, and never on top of a morning push.
    for (const m of members) {
      try {
        if ((dayOfYear(today) + m.id) % 2 !== 0) continue;
        if (await alreadySent(m.id, "quote")) continue;
        if (await alreadySent(m.id, "morning")) continue;
        await sendPush(m.id, "A thought for today", quoteFor(m.id, dayOfYear(today)), "/");
        await markSent(m.id, "quote");
        sent++;
      } catch (err) {
        failed.push(m.id);
        console.error(`quote failed for member ${m.id}`, err);
      }
    }
  }

  const isMonday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1;
  if (kind === "weekly" && (isMonday || req.nextUrl.searchParams.get("force") === "1")) {
    // Recap of the 7 days ending yesterday. On a Monday that is Monday to Sunday.
    const sunday = yesterday;
    await perMember("weekly", async (m) => {
      const s = await memberStats(m.id, sunday);
      if (s.weekDue === 0) return null;
      const first = m.name.split(" ")[0];
      const totals = await pool.query(
        `select w.label, sum(e.count)::int as n from entries e join work_types w on w.key = e.work_key
          where e.member_id = $1 and e.work_date between $2::date and $3::date group by w.label order by n desc`,
        [m.id, shiftDate(sunday, -6), sunday],
      );
      const lines = totals.rows.map((r: { label: string; n: number }) => `- ${r.label}: ${r.n}`).join("\n");
      const verdict = s.weekMet === s.weekDue ? "A perfect week. Every working day done." : `${s.weekMet} of ${s.weekDue} working days done. Every one of them counted.`;
      const text = `Hi ${first},\n\nYour week in review.\n\n${verdict}\n\n${lines || "Nothing logged this week. A new week starts today."}\n\nCurrent streak: ${s.streak} days. Best: ${s.bestStreak}.\n\nSet this week's to-dos and see your goals: ${app}`;
      // On the recap the week is over, so a day that is still "today" in the stats counts as an open day.
      const dots: EmailDot[] = s.week.map((d) => ({ label: d.label, state: d.state === "today" ? "missed" : d.state }));
      const html = renderEmailHtml(
        {
          preheader: verdict,
          heading: "Your week in review",
          intro: [`Hi ${first},`, verdict],
          hero: { value: `${s.weekMet}/${s.weekDue}`, label: "working days done", dots, note: `Current streak: ${s.streak} days. Best: ${s.bestStreak}.` },
          sections: [
            {
              title: "What you logged",
              rows: totals.rows.map((r: { label: string; n: number }) => ({ label: r.label, value: r.n.toLocaleString("en-US") })),
              empty: "Nothing logged this week. A new week starts today.",
            },
          ],
          outro: ["Set this week's to-dos and see your goals."],
          button: app ? { label: "Open the app", url: app } : undefined,
        },
        app,
      );
      return { title: "Your week in review", body: verdict, emailAlways: true, email: { subject: "Your week in review", text, html } };
    });
  }

  if (kind === "digest" && !(await alreadySent(ADMIN_KEY, "digest")) && process.env.ADMIN_EMAIL) {
    const rows = await consistencyReport(7);
    const flagged = rows.filter((r) => isFlagged(r, today));
    const strong = rows.filter((r) => r.days > 0 && r.rate >= 90 && !isFlagged(r, today));
    const f = flagged.map((r) => `- ${r.name}: ${r.metDays}/${r.days} days met, last log ${r.lastLogged ?? "never"}`).join("\n");
    const g = strong.map((r) => `- ${r.name}: ${r.metDays}/${r.days} days met, ${r.streak} day streak`).join("\n");
    const text = `Last 7 completed days.\n\nNeeds a nudge (${flagged.length}):\n${f || "- nobody"}\n\nGoing well (${strong.length}):\n${g || "- nobody yet"}\n\nAdmin: ${app}/admin`;
    try {
      const html = renderEmailHtml(
        {
          preheader: `${flagged.length} to nudge, ${strong.length} doing well over the last 7 completed days.`,
          heading: "Your team this week",
          intro: ["Last 7 completed days."],
          sections: [
            {
              stacked: true,
              title: `Needs a nudge (${flagged.length})`,
              rows: flagged.map((r) => ({ label: r.name, value: `${r.metDays}/${r.days} days met, last log ${r.lastLogged ?? "never"}` })),
              empty: "Nobody.",
            },
            {
              stacked: true,
              title: `Going well (${strong.length})`,
              rows: strong.map((r) => ({ label: r.name, value: `${r.metDays}/${r.days} days met, ${r.streak} day streak` })),
              empty: "Nobody yet.",
            },
          ],
          button: app ? { label: "Open admin", url: `${app}/admin` } : undefined,
          footer: "Sent to the admin of Innovatio Team Tracker.",
        },
        app,
      );
      await sendEmail(process.env.ADMIN_EMAIL, `Team tracker: ${flagged.length} to nudge, ${strong.length} doing well`, text, html);
      await markSent(ADMIN_KEY, "digest");
      sent++;
    } catch (err) {
      failed.push(ADMIN_KEY);
      console.error("digest failed", err);
    }
  }

  if (kind === "cleanup") {
    const purged = await pool.query(
      `update entries set proof_image = null, proof_image_type = null, proof_purged = true
        where proof_image is not null and work_date < $1::date`,
      [shiftDate(today, -PROOF_RETENTION_DAYS)],
    );
    const logs = await pool.query(`delete from reminder_log where sent_on < $1::date`, [shiftDate(today, -90)]);
    await pool.query(`delete from sessions where expires_at < now()`);
    await pool.query(`delete from login_attempts where created_at < now() - interval '1 day'`);
    return NextResponse.json({ kind, screenshotsRemoved: purged.rowCount ?? 0, logRowsRemoved: logs.rowCount ?? 0 });
  }

  return NextResponse.json({ kind, sent, failed }, { status: failed.length > 0 ? 500 : 200 });
}
