import { NextRequest, NextResponse } from "next/server";
import { currentAdminSessionKey } from "@/lib/auth";
import { pool } from "@/lib/db";

/** Links this device to the admin sign-in it is using, so it receives the admin's notifications until that sign-in ends. */
export async function POST(req: NextRequest) {
  const sessionKey = await currentAdminSessionKey();
  if (!sessionKey) return NextResponse.json({ error: "Not signed in as admin" }, { status: 401 });

  const s = await req.json().catch(() => null);
  if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) {
    return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  }

  await pool.query(
    `insert into admin_push_subscriptions (endpoint, p256dh, auth, session_key)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update
       set p256dh = excluded.p256dh, auth = excluded.auth, session_key = excluded.session_key, linked_at = now()`,
    [s.endpoint, s.keys.p256dh, s.keys.auth, sessionKey],
  );
  return NextResponse.json({ ok: true });
}
