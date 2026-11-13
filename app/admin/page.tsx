import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { consistencyReport, isFlagged } from "@/lib/status";
import { todayLagos } from "@/lib/lagos";
import { pool } from "@/lib/db";
import { AdminBar, BrandHero } from "../ui/BrandBar";
import { Table, Td, Tr } from "../ui/Table";

export const dynamic = "force-dynamic";

/** How each account state is shown. Text always says the state, the colour only backs it up. */
const accountTone: Record<string, string> = {
  Active: "good",
  "Invite pending": "",
  "Invite expired": "bad",
  "Not invited": "quiet",
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await isAdmin())) {
    return (
      <main id="main" className="page narrow stack">
        <div className="deco-asterisk" aria-hidden />
        <BrandHero>
          <h1>Admin</h1>
          <p className="muted">Enter the admin token to see how the team is doing.</p>
        </BrandHero>
        <form action="/api/admin/login" method="post" className="card stack tight">
          <label className="label">
            Admin token
            <input name="token" type="password" autoComplete="current-password" className="field" />
          </label>
          <button type="submit" className="btn">Enter</button>
        </form>
      </main>
    );
  }

  const { error } = await searchParams;
  const today = todayLagos();
  const rows = await consistencyReport(14);
  const ipas = (await pool.query(`select id, name from ipas order by name`)).rows as { id: number; name: string }[];
  const accounts = new Map(
    (
      await pool.query(
        `select id, (password_hash is not null) as invited, must_setup, (temp_expires_at < now()) as expired from members`,
      )
    ).rows.map((r: { id: number; invited: boolean; must_setup: boolean; expired: boolean }) => [
      r.id,
      !r.invited ? "Not invited" : r.must_setup ? (r.expired ? "Invite expired" : "Invite pending") : "Active",
    ]),
  );

  return (
    <main id="main" className="page wide stack">
      <AdminBar current="team" />
      <header>
        <h1>Team consistency</h1>
        <p className="muted mt-2">Last 14 completed days. Today is excluded until it closes.</p>
      </header>

      <section className="card">
        <h2>Add a member</h2>
        <form action="/api/admin/members" method="post" className="formrow">
          <input name="name" placeholder="Full name" required className="field" aria-label="Full name" />
          <input name="email" type="email" placeholder="Email" required className="field" aria-label="Email" />
          <select name="ipa_id" className="field" defaultValue="" aria-label="IPA">
            <option value="">No IPA yet</option>
            {ipas.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <button type="submit" className="btn">Add member</button>
        </form>
        {error && <p className="err mt-4" role="alert">{error}</p>}
      </section>

      <Table head={["Name", "Account", "IPA", "Days met", "Rate", "Streak", "Last log", "Reminders", "Flag"]}>
        {rows.map((r) => {
          const account = accounts.get(r.id) ?? "";
          return (
            <Tr key={r.id}>
              <Td className="cell-name">
                <Link href={`/admin/members/${r.id}`}>{r.name}</Link>
              </Td>
              <Td label="Account"><span className={`badge ${accountTone[account] ?? ""}`}>{account}</span></Td>
              <Td label="IPA">{r.ipaName ?? "none"}</Td>
              <Td label="Days met" className="num">{r.days === 0 ? "n/a" : `${r.metDays}/${r.days}`}</Td>
              <Td label="Rate" className="num">{r.days === 0 ? "n/a" : `${r.rate}%`}</Td>
              <Td label="Streak" className="num">{r.streak}</Td>
              <Td label="Last log" className="num">{r.lastLogged ?? "never"}</Td>
              <Td label="Reminders">{r.remindersOn ? "on" : "off, no device"}</Td>
              <Td label="Flag">
                {isFlagged(r, today) ? <span className="badge brand">Follow up</span> : <span className="badge quiet">OK</span>}
              </Td>
            </Tr>
          );
        })}
      </Table>
    </main>
  );
}
