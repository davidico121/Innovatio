import { NextRequest, NextResponse } from "next/server";
import { currentMember, currentSessionId } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";

export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const s = await req.json();
  if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) {
    return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  }

  // The device is linked to this sign-in, so signing out removes it, and a different member signing in on the same phone takes it over.
  try {
    await pool.query(
      `insert into push_subscriptions (member_id, endpoint, p256dh, auth, session_id)
       values ($1, $2, $3, $4, $5)
       on conflict (endpoint) do update
         set member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth, session_id = excluded.session_id`,
      [me.id, s.endpoint, s.keys.p256dh, s.keys.auth, await currentSessionId()],
    );
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    // The newest migration has not run, so link the device the way it worked before. Reminders still work.
    await pool.query(
      `insert into push_subscriptions (member_id, endpoint, p256dh, auth)
       values ($1, $2, $3, $4)
       on conflict (endpoint) do update
         set member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      [me.id, s.endpoint, s.keys.p256dh, s.keys.auth],
    );
  }
  return NextResponse.json({ ok: true });
}
