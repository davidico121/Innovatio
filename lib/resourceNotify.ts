import { pool } from "./db";
import { deliverToMembers, type Delivery, type Recipient } from "./broadcast";
import { KIND_LABEL, type Kind } from "./resourceLinks";

export type Announcement = Delivery & { members: number };

/**
 * Who a resource is for: the active members of the IPAs it is tagged to, or every active member when
 * it is not tagged to any.
 */
export async function audienceFor(ipaIds: number[]): Promise<Recipient[]> {
  const { rows } = ipaIds.length
    ? await pool.query(`select id, name, email from members where active and ipa_id = any($1::int[]) order by id`, [ipaIds])
    : await pool.query(`select id, name, email from members where active order by id`);
  return rows as Recipient[];
}

/**
 * Tells the team about a published resource: a notification to the members it is for, and the email
 * too when asked. It is written to the Broadcast history so the admin can see it went out, and the same
 * words cannot go out twice within two minutes. Returns null when that guard stopped it.
 */
export async function announceResource(resourceId: number, alsoEmail: boolean): Promise<Announcement | null> {
  const r = (await pool.query(`select title, kind, published from resources where id = $1`, [resourceId])).rows[0] as
    | { title: string; kind: Kind; published: boolean }
    | undefined;
  if (!r || !r.published) return null;
  const ipaIds = (await pool.query(`select ipa_id from resource_ipas where resource_id = $1`, [resourceId])).rows.map((x) => x.ipa_id as number);
  const members = await audienceFor(ipaIds);

  const title = "New in Resources";
  const message = `${KIND_LABEL[r.kind]}: ${r.title}. Tap to see it.`;

  const client = await pool.connect();
  let logId: number;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(7243002)");
    const dup = await client.query(`select 1 from broadcasts where title = $1 and body = $2 and created_at > now() - interval '2 minutes'`, [title, message]);
    if (dup.rowCount) {
      await client.query("rollback");
      return null;
    }
    const ins = await client.query(`insert into broadcasts (title, body, also_email) values ($1, $2, $3) returning id`, [title, message, alsoEmail]);
    logId = ins.rows[0].id;
    await client.query("commit");
  } catch (err) {
    try { await client.query("rollback"); } catch { /* already rolled back */ }
    throw err;
  } finally {
    client.release();
  }

  const d = await deliverToMembers(members, { title, message, path: "/resources", email: alsoEmail, buttonLabel: "Open Resources" });
  await pool.query(
    `update broadcasts set members = $2, push_members = $3, push_devices = $4, emailed = $5, email_failed = $6 where id = $1`,
    [logId, members.length, d.pushMembers, d.pushDevices, d.emailed, d.emailFailed],
  );
  await pool.query(`update resources set notified_at = now() where id = $1`, [resourceId]);
  return { ...d, members: members.length };
}
