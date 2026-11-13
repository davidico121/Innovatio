import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { AdminBar } from "../../ui/BrandBar";
import { Table, Td, Tr } from "../../ui/Table";

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
    <main id="main" className="page wide stack">
      <AdminBar current="ipas" />
      <header>
        <h1>IPAs</h1>
        <p className="muted mt-2">An IPA is a set of daily targets for one role. Each member has one IPA.</p>
      </header>

      <section>
        <h2>Existing IPAs</h2>
        <Table head={["Name", "Targets", "Members", "Weekends", "Document"]}>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="cell-name"><Link href={`/admin/ipas/${r.id}`}>{r.name}</Link></Td>
              <Td label="Targets" className="num">{r.tasks}</Td>
              <Td label="Members" className="num">{r.members}</Td>
              <Td label="Weekends">{r.counts_weekends ? "included" : "weekdays only"}</Td>
              <Td label="Document">{r.document_name ?? "none"}</Td>
            </Tr>
          ))}
        </Table>
      </section>

      <section className="card">
        <h2>Add an IPA</h2>
        <form action="/api/admin/ipas" method="post" className="formgrid">
          <input name="name" placeholder="IPA name, e.g. Scouting IPA" required className="field" aria-label="IPA name" />
          <textarea name="description" placeholder="What this role is for (optional)" rows={3} className="field" aria-label="Description" />
          <label className="check"><input type="checkbox" name="counts_weekends" /> Targets apply on weekends too</label>
          <button type="submit" className="btn">Create IPA</button>
        </form>
        {error && <p className="err mt-4" role="alert">{error}</p>}
      </section>
    </main>
  );
}
