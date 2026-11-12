import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { memberEntries, typeBreakdown } from "@/lib/status";
import EntryRow from "./EntryRow";

export const dynamic = "force-dynamic";

const th = { textAlign: "left" as const, borderBottom: "1px solid #ccc", padding: 6 };
const td = { padding: 6, borderBottom: "1px solid #eee", verticalAlign: "top" as const };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) notFound();
  const { id } = await params;

  const { rows } = await pool.query(
    `select m.id, m.name, m.email, m.token, m.ipa_id, i.name as ipa_name
       from members m left join ipas i on i.id = m.ipa_id
      where m.id = $1`,
    [Number(id)],
  );
  const member = rows[0];
  if (!member) notFound();
  const ipas = (await pool.query(`select id, name from ipas order by name`)).rows as { id: number; name: string }[];

  const [breakdown, entries] = await Promise.all([typeBreakdown(member.id, 14), memberEntries(member.id, 14)]);
  const signInUrl = `${process.env.APP_URL}/api/login?token=${member.token}`;

  return (
    <main>
      <p>
        <Link href="/admin">&larr; All members</Link>
      </p>
      <h1>{member.name}</h1>
      <p>{member.email}</p>

      <h2>IPA</h2>
      <form action={`/api/admin/members/${member.id}/ipa`} method="post" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select name="ipa_id" defaultValue={member.ipa_id ?? ""} style={{ padding: 8 }}>
          <option value="">No IPA</option>
          {ipas.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: 8 }}>Save IPA</button>
      </form>
      {!member.ipa_name && <p>This member has no targets until an IPA is assigned.</p>}

      <h2>Sign-in link</h2>
      <p>Send this to {member.name} only. Anyone with it can log in as them.</p>
      <p style={{ wordBreak: "break-all", fontFamily: "monospace" }}>{signInUrl}</p>

      <h2>Last 14 completed days, by work type{member.ipa_name ? ` (${member.ipa_name})` : ""}</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["Work type", "Minimum per day", "Days met"].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {breakdown.map((r) => (
            <tr key={r.key}>
              <td style={td}>{r.label}</td>
              <td style={td}>{r.daily_min}</td>
              <td style={td}>
                {r.metDays}/{r.days}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Entries, last 14 days</h2>
      {entries.length === 0 ? (
        <p>Nothing logged yet.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Date", "Work", "Count", "Proof", "Notes", ""].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
