import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { AdminBar } from "../../ui/BrandBar";
import { Table, Td, Tr } from "../../ui/Table";
import BroadcastForm from "./BroadcastForm";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  title: string;
  body: string;
  also_email: boolean;
  members: number;
  push_members: number;
  push_devices: number;
  emailed: number;
  email_failed: number;
  sent: string;
};

export default async function BroadcastPage() {
  if (!(await isAdmin())) redirect("/login?as=admin");

  const audience = (
    await pool.query(
      `select (select count(*)::int from members where active) as members,
              (select count(distinct p.member_id)::int from push_subscriptions p join members m on m.id = p.member_id where m.active) as with_devices,
              (select count(*)::int from push_subscriptions p join members m on m.id = p.member_id where m.active) as devices`,
    )
  ).rows[0];

  let history: Row[] | null = null;
  try {
    history = (
      await pool.query(
        `select id, title, body, also_email, members, push_members, push_devices, emailed, email_failed,
                to_char(created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI') as sent
           from broadcasts order by id desc limit 10`,
      )
    ).rows as Row[];
  } catch (err) {
    if (!isMissingSchema(err)) throw err; // the newest database update has not run yet
  }

  return (
    <main id="main" className="page wide stack">
      <AdminBar current="broadcast" />
      <header>
        <h1>Broadcast</h1>
        <p className="muted mt-2">Send a message to every active member's phone, and to their email too if you choose.</p>
      </header>

      <div className="dash">
        <section className="card">
          <h2>New message</h2>
          <BroadcastForm audience={{ members: audience.members, withDevices: audience.with_devices, devices: audience.devices }} />
        </section>

        <section>
          <h2>Recent broadcasts</h2>
          {history === null ? (
            <p className="note">Broadcasts will be ready after the next deploy.</p>
          ) : history.length === 0 ? (
            <p className="muted">Nothing sent yet.</p>
          ) : (
            <Table head={["Sent", "Message", "Notification", "Email"]}>
              {history.map((r) => (
                <Tr key={r.id}>
                  <Td label="Sent" className="num">{r.sent}</Td>
                  <Td label="Message" className="cell-full">
                    <strong>{r.title}</strong>
                    <br />
                    <span className="muted">{r.body}</span>
                  </Td>
                  <Td label="Notification">{r.push_devices} {r.push_devices === 1 ? "device" : "devices"}, {r.push_members} of {r.members} members</Td>
                  <Td label="Email">
                    {r.also_email ? `${r.emailed} of ${r.members} sent${r.email_failed ? `, ${r.email_failed} failed` : ""}` : "not sent"}
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </section>
      </div>
    </main>
  );
}
