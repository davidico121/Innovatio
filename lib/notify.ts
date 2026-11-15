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

type Device = { id: number; endpoint: string; p256dh: string; auth: string };

/**
 * Sends one notification to each device and returns how many it reached. A device the push service
 * says is gone (404 or 410) is dropped from its table. The table name is one of two fixed values.
 */
async function deliver(table: "push_subscriptions" | "admin_push_subscriptions", devices: Device[], payload: object): Promise<number> {
  ensureVapid();
  let delivered = 0;
  for (const s of devices) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      delivered++;
    } catch (err) {
      // 404/410 means the device unsubscribed or reinstalled; drop the dead subscription.
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await pool.query(`delete from ${table} where id = $1`, [s.id]);
    }
  }
  return delivered;
}

/** A team member's notification, to the devices linked to that member. Returns how many devices it reached. */
export async function sendPush(memberId: number, title: string, body: string, url = "/"): Promise<number> {
  const { rows } = await pool.query(
    `select id, endpoint, p256dh, auth from push_subscriptions where member_id = $1`,
    [memberId],
  );
  return deliver("push_subscriptions", rows, { title, body, url });
}

/** The admin's notification, to the devices linked to an admin sign-in. Returns how many devices it reached. */
export async function sendAdminPush(title: string, body: string, url = "/admin"): Promise<number> {
  const { rows } = await pool.query(`select id, endpoint, p256dh, auth from admin_push_subscriptions`);
  return deliver("admin_push_subscriptions", rows, { title, body, url });
}

export async function adminDeviceCount(): Promise<number> {
  const { rows } = await pool.query(`select count(*)::int as n from admin_push_subscriptions`);
  return rows[0].n;
}

/** Sends one email. `html` is the branded version; `text` is always sent too, for clients that show only text. */
export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text, ...(html ? { html } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
