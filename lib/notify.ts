import webpush from "web-push";
import { pool } from "./db";

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidReady = true;
}

export async function sendPush(memberId: number, title: string, body: string, url = "/") {
  ensureVapid();
  const { rows } = await pool.query(
    `select id, endpoint, p256dh, auth from push_subscriptions where member_id = $1`,
    [memberId],
  );
  for (const s of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url }),
      );
    } catch (err) {
      // 404/410 means the device unsubscribed or reinstalled; drop the dead subscription.
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await pool.query(`delete from push_subscriptions where id = $1`, [s.id]);
      }
    }
  }
}

export async function sendEmail(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
