import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { shiftDate, todayLagos } from "@/lib/lagos";
import { KIND_LABEL, hostOf, type Kind } from "@/lib/resourceLinks";
import { AdminBar } from "../../ui/BrandBar";
import { KindIcon } from "../../ui/KindIcon";
import { Table, Td, Tr } from "../../ui/Table";
import RowActions from "./RowActions";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  title: string;
  url: string;
  kind: Kind;
  category: string;
  pinned: boolean;
  published: boolean;
  ipas: string[];
  week: number;
  month: number;
  total: number;
};

const int = (v: string | undefined) => (v && /^\d{1,6}$/.test(v) ? Number(v) : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function AdminResourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isAdmin())) redirect("/login?as=admin");
  const sp = await searchParams;

  const today = todayLagos();
  let rows: Row[] | null = null;
  try {
    rows = (
      await pool.query(
        `select r.id, r.title, r.url, r.kind, r.category, r.pinned, r.published,
                coalesce((select array_agg(i.name order by i.name) from resource_ipas ri join ipas i on i.id = ri.ipa_id where ri.resource_id = r.id), '{}') as ipas,
                coalesce((select sum(o.opens) from resource_opens o where o.resource_id = r.id and o.day > $1::date), 0)::int as week,
                coalesce((select sum(o.opens) from resource_opens o where o.resource_id = r.id and o.day > $2::date), 0)::int as month,
                coalesce((select sum(o.opens) from resource_opens o where o.resource_id = r.id), 0)::int as total
           from resources r order by r.position, r.id`,
        [shiftDate(today, -7), shiftDate(today, -30)],
      )
    ).rows as Row[];
  } catch (err) {
    if (!isMissingSchema(err)) throw err; // the newest database update has not run yet
  }

  const flash =
    sp.saved === "added"
      ? "Added."
      : sp.saved === "deleted"
        ? "Deleted."
        : "";
  const told = int(sp.told);

  return (
    <main id="main" className="page wide stack">
      <AdminBar current="resources" />
      <header className="row between wrap">
        <div>
          <h1>Resources</h1>
          <p className="muted mt-2">Videos, guides and links for the team. Members open them from the app. Nothing is uploaded here.</p>
        </div>
        <Link href="/admin/resources/new" className="btn">Add a resource</Link>
      </header>

      {flash && (
        <p className="win" role="status">
          {flash}
          {told > 0 && ` Told ${plural(told, "member", "members")}: the notification reached ${int(sp.push)}${int(sp.mail) ? `, and ${int(sp.mail)} got the email` : ""}.`}
          {sp.note === "1" && " It was saved, but the team was not told (it was announced a moment ago, or sending failed)."}
        </p>
      )}

      {rows === null ? (
        <p className="note">Resources will be ready after the next deploy.</p>
      ) : rows.length === 0 ? (
        <section className="card">
          <h2>Nothing here yet</h2>
          <p className="muted">Add the first video or guide and your team will find it under Resources in the app.</p>
          <p className="mt-3"><Link href="/admin/resources/new" className="btn">Add a resource</Link></p>
        </section>
      ) : (
        <Table head={["Resource", "Type", "Who it is for", "Opened", ""]}>
          {rows.map((r, i) => (
            <Tr key={r.id}>
              <Td className="cell-full">
                <Link href={`/admin/resources/${r.id}`} className="res-title"><strong>{r.title}</strong></Link>
                <br />
                <span className="muted small">{hostOf(r.url)}{r.category ? ` · ${r.category}` : ""}</span>
                <span className="res-flags">
                  {r.pinned && <span className="badge brand">Pinned</span>}
                  {!r.published && <span className="badge quiet">Draft</span>}
                </span>
              </Td>
              <Td label="Type"><span className="kind"><KindIcon kind={r.kind} size={18} /> {KIND_LABEL[r.kind]}</span></Td>
              <Td label="Who it is for">{r.ipas.length ? r.ipas.join(", ") : "Everyone"}</Td>
              <Td label="Opened" className="num">
                {r.total === 0 ? <span className="muted">Not opened yet</span> : <><span className="nowrap">{r.week} this week</span><br /><span className="muted small nowrap">{r.month} in 30 days</span><br /><span className="muted small nowrap">{r.total} in all</span></>}
              </Td>
              <Td className="actions">
                <RowActions id={r.id} title={r.title} pinned={r.pinned} published={r.published} first={i === 0} last={i === rows.length - 1} />
                <Link href={`/admin/resources/${r.id}`} className="btn secondary small" aria-label={`Edit ${r.title}`}>Edit</Link>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
      <p className="muted small">The order here is the order members see. Pinned resources always come first.</p>
    </main>
  );
}
