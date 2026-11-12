import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const s = await req.json();
  if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) {
    return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  }

  await pool.query(
    `insert into push_subscriptions (member_id, endpoint, p256dh, auth)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update
       set member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [me.id, s.endpoint, s.keys.p256dh, s.keys.auth],
  );
  return NextResponse.json({ ok: true });
}
