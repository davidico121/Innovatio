import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { table, th, td, field } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function IpaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await isAdmin())) notFound();
  const { id } = await params;
  const { error } = await searchParams;

  const ipa = (
    await pool.query(`select id, name, description, document_name, counts_weekends from ipas where id = $1`, [Number(id)])
  ).rows[0];
  if (!ipa) notFound();

  const [tasks, types, members] = await Promise.all([
    pool.query(
      `select t.work_key, w.label, t.daily_min, t.requires_proof
         from ipa_tasks t join work_types w on w.key = t.work_key
        where t.ipa_id = $1 order by w.label`,
      [ipa.id],
    ),
    pool.query(`select key, label from work_types order by label`),
    pool.query(`select name from members where ipa_id = $1 and active order by name`, [ipa.id]),
  ]);

  const assigned = new Set(tasks.rows.map((t) => t.work_key));
  const available = types.rows.filter((t) => !assigned.has(t.key));

  return (
    <main>
      <p><Link href="/admin/ipas">&larr; All IPAs</Link></p>
      <h1>{ipa.name}</h1>
      {ipa.description && <p>{ipa.description}</p>}
      <form action={`/api/admin/ipas/${ipa.id}/settings`} method="post" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label><input type="checkbox" name="counts_weekends" defaultChecked={ipa.counts_weekends} /> Targets apply on weekends too</label>
        <button type="submit">Save</button>
      </form>
      <p>Members on this IPA: {members.rows.length ? members.rows.map((m) => m.name).join(", ") : "none"}</p>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      <h2>Targets</h2>
      <table style={table}>
        <thead>
          <tr>
            {["Work type", "Daily minimum", "Proof link", ""].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.rows.map((t) => (
            <tr key={t.work_key}>
              <td style={td}>{t.label}</td>
              <td style={td}>{t.daily_min}</td>
              <td style={td}>{t.requires_proof ? "required" : "optional"}</td>
              <td style={td}>
                <form action={`/api/admin/ipas/${ipa.id}/tasks/delete`} method="post">
                  <input type="hidden" name="work_key" value={t.work_key} />
                  <button type="submit">Remove</button>
                </form>
              </td>
            </tr>
          ))}
          {tasks.rows.length === 0 && (
            <tr><td style={td} colSpan={4}>No targets yet.</td></tr>
          )}
        </tbody>
      </table>

      <h3>Add or update a target</h3>
      <form action={`/api/admin/ipas/${ipa.id}/tasks`} method="post" style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <select name="work_key" required style={field} defaultValue="">
          <option value="" disabled>Choose a work type</option>
          {types.rows.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}{assigned.has(t.key) ? " (update)" : ""}
            </option>
          ))}
          <option value="__new__">New work type...</option>
        </select>
        <input name="new_label" placeholder="New work type name (only if New)" style={field} />
        <input name="new_key" placeholder="New key, e.g. social_posts (only if New)" style={field} />
        <input name="daily_min" type="number" min={0} required placeholder="Daily minimum, e.g. 500" style={field} />
        <label><input type="checkbox" name="requires_proof" defaultChecked /> Proof link required</label>
        <button type="submit" style={field}>Save target</button>
      </form>
      {available.length === 0 && <p>Every work type is already on this IPA. Add a new one above to add more.</p>}

      <h2>Document</h2>
      {ipa.document_name ? (
        <p>
          Current: <a href={`/api/admin/ipas/${ipa.id}/document`}>{ipa.document_name}</a>
        </p>
      ) : (
        <p>No document uploaded.</p>
      )}
      <form action={`/api/admin/ipas/${ipa.id}/document`} method="post" encType="multipart/form-data" style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <input name="file" type="file" accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg" required />
        <button type="submit" style={field}>Upload document</button>
      </form>
      <p>Up to 5 MB. Uploading replaces the current document.</p>
    </main>
  );
}
