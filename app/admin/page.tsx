import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { consistencyReport, isFlagged } from "@/lib/status";
import { todayLagos } from "@/lib/lagos";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const th = { textAlign: "left" as const, borderBottom: "1px solid #ccc", padding: 6 };
const td = { padding: 6, borderBottom: "1px solid #eee" };

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await isAdmin())) {
    return (
      <form action="/api/admin/login" method="post">
        <h1>Admin</h1>
        <input name="token" type="password" placeholder="Admin token" style={{ padding: 8 }} />{" "}
        <button type="submit" style={{ padding: 8 }}>
          Enter
        </button>
      </form>
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
    <main>
      <h1>Team consistency</h1>
      <p>Last 14 completed days. Today is excluded until it closes.</p>
      <p><Link href="/admin/ipas">Manage IPAs and targets</Link></p>

      <h2>Add a member</h2>
      <form action="/api/admin/members" method="post" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input name="name" placeholder="Full name" required style={{ padding: 8 }} />
        <input name="email" type="email" placeholder="Email" required style={{ padding: 8 }} />
        <select name="ipa_id" style={{ padding: 8 }} defaultValue="">
          <option value="">No IPA yet</option>
          {ipas.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: 8 }}>
          Add member
        </button>
      </form>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["Name", "Account", "IPA", "Days met", "Rate", "Streak", "Last log", "Reminders", "Flag"].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={td}>
                <Link href={`/admin/members/${r.id}`}>{r.name}</Link>
              </td>
              <td style={td}>{accounts.get(r.id)}</td>
              <td style={td}>{r.ipaName ?? "none"}</td>
              <td style={td}>
                {r.days === 0 ? "n/a" : `${r.metDays}/${r.days}`}
              </td>
              <td style={td}>{r.days === 0 ? "n/a" : `${r.rate}%`}</td>
              <td style={td}>{r.streak}</td>
              <td style={td}>{r.lastLogged ?? "never"}</td>
              <td style={td}>{r.remindersOn ? "on" : "off, no device"}</td>
              <td style={td}>{isFlagged(r, today) ? "Follow up" : "OK"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
