import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { KIND_LABEL, type Kind } from "@/lib/resourceLinks";
import { AdminBar } from "../../../ui/BrandBar";
import { Table, Td, Tr } from "../../../ui/Table";

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

  // Resources tagged to this IPA. Optional, so a database that has not had the newest update yet still shows the page.
  let linked: { id: number; title: string; kind: Kind; published: boolean }[] = [];
  try {
    linked = (
      await pool.query(
        `select r.id, r.title, r.kind, r.published from resources r join resource_ipas ri on ri.resource_id = r.id where ri.ipa_id = $1 order by r.position, r.id`,
        [ipa.id],
      )
    ).rows;
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
  }

  const assigned = new Set(tasks.rows.map((t) => t.work_key));
  const available = types.rows.filter((t) => !assigned.has(t.key));

  return (
    <main id="main" className="page wide stack">
      <AdminBar current="ipas" />
      <header>
        <p className="mb-3"><Link href="/admin/ipas">&larr; All IPAs</Link></p>
        <h1>{ipa.name}</h1>
        {ipa.description && <p className="muted mt-2">{ipa.description}</p>}
      </header>

      <section className="card">
        <form action={`/api/admin/ipas/${ipa.id}/settings`} method="post" className="formrow" style={{ alignItems: "center" }}>
          <label className="check"><input type="checkbox" name="counts_weekends" defaultChecked={ipa.counts_weekends} /> Targets apply on weekends too</label>
          <button type="submit" className="btn secondary small">Save</button>
        </form>
        <p className="muted mt-3">Members on this IPA: {members.rows.length ? members.rows.map((m) => m.name).join(", ") : "none"}</p>
        {error && <p className="err mt-3" role="alert">{error}</p>}
      </section>

      <section>
        <h2>Targets</h2>
        <Table head={["Work type", "Daily minimum", "Proof link", ""]}>
          {tasks.rows.map((t) => (
            <Tr key={t.work_key}>
              <Td className="cell-name">{t.label}</Td>
              <Td label="Daily minimum" className="num">{t.daily_min}</Td>
              <Td label="Proof link">{t.requires_proof ? "required" : "optional"}</Td>
              <Td className="actions">
                <form action={`/api/admin/ipas/${ipa.id}/tasks/delete`} method="post">
                  <input type="hidden" name="work_key" value={t.work_key} />
                  <button type="submit" className="btn secondary small" aria-label={`Remove ${t.label}`}>Remove</button>
                </form>
              </Td>
            </Tr>
          ))}
          {tasks.rows.length === 0 && (
            <Tr><Td className="cell-full" colSpan={4}>No targets yet.</Td></Tr>
          )}
        </Table>
      </section>

      <section className="card">
        <div className="row between wrap">
          <h2 style={{ margin: 0 }}>Resources for this IPA</h2>
          <Link href={`/admin/resources/new?ipa=${ipa.id}`} className="btn secondary small">Add a resource</Link>
        </div>
        {linked.length === 0 ? (
          <p className="muted mt-3">None yet. Videos and guides you tag to this IPA show first for its members.</p>
        ) : (
          <ul className="plain mt-3">
            {linked.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/resources/${r.id}`}>{r.title}</Link> <span className="muted small">{KIND_LABEL[r.kind]}{r.published ? "" : ", draft"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="dash">
        <section className="card">
          <h2>Add or update a target</h2>
          <form action={`/api/admin/ipas/${ipa.id}/tasks`} method="post" className="formgrid">
            <select name="work_key" required className="field" defaultValue="" aria-label="Work type">
              <option value="" disabled>Choose a work type</option>
              {types.rows.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}{assigned.has(t.key) ? " (update)" : ""}
                </option>
              ))}
              <option value="__new__">New work type...</option>
            </select>
            <input name="new_label" placeholder="New work type name (only if New)" className="field" aria-label="New work type name" />
            <input name="new_key" placeholder="New key, e.g. social_posts (only if New)" className="field" aria-label="New work type key" />
            <input name="daily_min" type="number" min={0} required placeholder="Daily minimum, e.g. 500" className="field" aria-label="Daily minimum" />
            <label className="check"><input type="checkbox" name="requires_proof" defaultChecked /> Proof link required</label>
            <button type="submit" className="btn">Save target</button>
          </form>
          {available.length === 0 && <p className="muted mt-3">Every work type is already on this IPA. Add a new one above to add more.</p>}
        </section>

        <section className="card">
          <h2>Document</h2>
          {ipa.document_name ? (
            <p>
              Current: <a href={`/api/admin/ipas/${ipa.id}/document`}>{ipa.document_name}</a>
            </p>
          ) : (
            <p className="muted">No document uploaded.</p>
          )}
          <form action={`/api/admin/ipas/${ipa.id}/document`} method="post" encType="multipart/form-data" className="formgrid mt-3">
            <input name="file" type="file" accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg" required className="field" aria-label="Document file" />
            <button type="submit" className="btn">Upload document</button>
          </form>
          <p className="muted small mt-3">Up to 4 MB. Uploading replaces the current document.</p>
        </section>
      </div>
    </main>
  );
}
