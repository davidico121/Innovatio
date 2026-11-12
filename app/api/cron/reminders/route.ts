import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { todayLagos, shiftDate } from "@/lib/lagos";
import { dayProgress, consistencyReport, isFlagged } from "@/lib/status";
import { sendPush, sendEmail } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Trigger from any scheduler with header `Authorization: Bearer $CRON_SECRET`:
 *   ?kind=morning  (09:00 Lagos) push + email to anyone short yesterday
 *   ?kind=evening  (19:00 Lagos) push to anyone with today still open
 *   ?kind=digest   (once a day)  email admin the flagged members
 *
 * A reminder is recorded as sent only after it goes out, so a failure is
 * retried by the next run. One failing member never stops the others.
 */
const DIGEST_KEY = 0;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const kind = req.nextUrl.searchParams.get("kind");
  const today = todayLagos();
  const yesterday = shiftDate(today, -1);
  const members = (await pool.query(`select id, name, email from members where active`))
    .rows as { id: number; name: string; email: string }[];

  async function alreadySent(memberId: number, k: string) {
    const r = await pool.query(
      `select 1 from reminder_log where member_id = $1 and kind = $2 and sent_on = $3`,
      [memberId, k, today],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async function markSent(memberId: number, k: string) {
    await pool.query(
      `insert into reminder_log (member_id, kind, sent_on) values ($1, $2, $3)
       on conflict do nothing`,
      [memberId, k, today],
    );
  }

  let sent = 0;
  const failed: number[] = [];

  async function perMember(k: string, build: (m: (typeof members)[number]) => Promise<{ title: string; body: string; email?: { subject: string; text: string } } | null>) {
    for (const m of members) {
      try {
        if (await alreadySent(m.id, k)) continue;
        const msg = await build(m);
        if (!msg) continue;
        await sendPush(m.id, msg.title, msg.body, "/");
        if (msg.email) await sendEmail(m.email, msg.email.subject, msg.email.text);
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
      const short = (await dayProgress(m.id, yesterday)).filter((r) => !r.met);
      if (short.length === 0) return null;
      const list = short.map((r) => `${r.label} ${r.done}/${r.daily_min}`).join(", ");
      return {
        title: "Yesterday was short",
        body: list,
        email: {
          subject: "Yesterday's targets were not met",
          text: `Hi ${m.name},\n\nYesterday you were short on: ${list}.\n\nLog any missing work here: ${process.env.APP_URL}`,
        },
      };
    });
  }

  if (kind === "evening") {
    const withDevice = new Set(
      ((await pool.query(`select distinct member_id from push_subscriptions`)).rows as { member_id: number }[]).map(
        (r) => r.member_id,
      ),
    );
    await perMember("evening", async (m) => {
      const open = (await dayProgress(m.id, today)).filter((r) => !r.met);
      if (open.length === 0) return null;
      const list = open.map((r) => `${r.label} ${r.done}/${r.daily_min}`).join(", ");
      return {
        title: "Today's targets are still open",
        body: list,
        // Members without a device get the reminder by email instead.
        email: withDevice.has(m.id)
          ? undefined
          : {
              subject: "Today's targets are still open",
              text: `Hi ${m.name},\n\nStill open today: ${list}.\n\nLog it here: ${process.env.APP_URL}`,
            },
      };
    });
  }

  if (kind === "digest" && !(await alreadySent(DIGEST_KEY, "digest"))) {
    const flagged = (await consistencyReport(7)).filter((r) => isFlagged(r, today));
    if (flagged.length > 0 && process.env.ADMIN_EMAIL) {
      const lines = flagged
        .map((r) => `- ${r.name}: ${r.metDays}/${r.days} days met, last log ${r.lastLogged ?? "never"}`)
        .join("\n");
      try {
        await sendEmail(
          process.env.ADMIN_EMAIL,
          `Team tracker: ${flagged.length} flagged`,
          `Flagged in the last 7 completed days:\n\n${lines}\n\nAdmin: ${process.env.APP_URL}/admin`,
        );
        await markSent(DIGEST_KEY, "digest");
        sent++;
      } catch (err) {
        failed.push(DIGEST_KEY);
        console.error("digest failed", err);
      }
    }
  }

  return NextResponse.json({ kind, sent, failed }, { status: failed.length > 0 ? 500 : 200 });
}
