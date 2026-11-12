import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { table, th, td, field } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function IpasPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await isAdmin())) notFound();
  const { error } = await searchParams;
  const { rows } = await pool.query(
    `select i.id, i.name, i.document_name, i.counts_weekends,
            (select count(*)::int from ipa_tasks t where t.ipa_id = i.id) as tasks,
            (select count(*)::int from members m where m.ipa_id = i.id and m.active) as members
       from ipas i order by i.name`,
  );

  return (
    <main>
      <p><Link href="/admin">&larr; Team consistency</Link></p>
      <h1>IPAs</h1>
      <p>An IPA is a set of daily targets for one role. Each member has one IPA.</p>

      <h2>Add an IPA</h2>
      <form action="/api/admin/ipas" method="post" style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <input name="name" placeholder="IPA name, e.g. Scouting IPA" required style={field} />
        <textarea name="description" placeholder="What this role is for (optional)" rows={3} style={field} />
        <label><input type="checkbox" name="counts_weekends" /> Targets apply on weekends too</label>
        <button type="submit" style={field}>Create IPA</button>
      </form>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      <h2>Existing IPAs</h2>
      <table style={table}>
        <thead>
          <tr>
            {["Name", "Targets", "Members", "Weekends", "Document"].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={td}><Link href={`/admin/ipas/${r.id}`}>{r.name}</Link></td>
              <td style={td}>{r.tasks}</td>
              <td style={td}>{r.members}</td>
              <td style={td}>{r.counts_weekends ? "included" : "weekdays only"}</td>
              <td style={td}>{r.document_name ?? "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
