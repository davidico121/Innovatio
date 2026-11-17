import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { shiftDate, todayLagos } from "@/lib/lagos";
import type { Kind } from "@/lib/resourceLinks";
import { AdminBar } from "../../../ui/BrandBar";
import ResourceForm from "../ResourceForm";
import { loadFormOptions } from "../options";

export const dynamic = "force-dynamic";

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/login?as=admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  let r;
  try {
    r = (
      await pool.query(
        `select id, title, url, kind, category, description, pinned, published,
                to_char(notified_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI') as told_at,
                coalesce((select array_agg(ipa_id) from resource_ipas where resource_id = r.id), '{}') as ipa_ids,
                coalesce((select sum(opens) from resource_opens where resource_id = r.id and day > $2::date), 0)::int as week,
                coalesce((select sum(opens) from resource_opens where resource_id = r.id and day > $3::date), 0)::int as month,
                coalesce((select sum(opens) from resource_opens where resource_id = r.id), 0)::int as total
           from resources r where id = $1`,
        [id, shiftDate(todayLagos(), -7), shiftDate(todayLagos(), -30)],
      )
    ).rows[0];
  } catch (err) {
    if (isMissingSchema(err)) notFound();
    throw err;
  }
  if (!r) notFound();
  const opts = await loadFormOptions();

  return (
    <main id="main" className="page wide stack">
      <AdminBar current="resources" />
      <header>
        <p className="mb-3"><Link href="/admin/resources">&larr; All resources</Link></p>
        <h1>Edit resource</h1>
        <p className="muted mt-2">
          {r.total === 0 ? "Not opened yet." : `Opened ${r.week} ${r.week === 1 ? "time" : "times"} this week, ${r.month} in the last 30 days, ${r.total} in all.`} Counts never show who opened it.
        </p>
      </header>
      <section className="card">
        <ResourceForm
          mode="edit"
          id={r.id}
          initial={{ title: r.title, url: r.url, kind: r.kind as Kind, category: r.category, description: r.description, pinned: r.pinned, published: r.published, ipaIds: r.ipa_ids }}
          ipas={opts.ipas}
          totalMembers={opts.totalMembers}
          categories={opts.categories}
          toldAt={r.told_at}
        />
      </section>
    </main>
  );
}
