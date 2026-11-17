import { redirect } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";
import { listForMember, type MemberResource } from "@/lib/resources";
import Link from "next/link";
import { BrandBar } from "../ui/BrandBar";
import ResourceLibrary from "./ResourceLibrary";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const me = await currentSession();
  if (!me) redirect("/login");
  if (me.mustSetup) redirect("/welcome");
  const admin = await isAdmin();

  const ipa = (await pool.query(`select i.id, i.name from members m join ipas i on i.id = m.ipa_id where m.id = $1`, [me.id])).rows[0] as { id: number; name: string } | undefined;
  let resources: MemberResource[] = [];
  try {
    resources = await listForMember(ipa?.id ?? null);
  } catch (err) {
    if (!isMissingSchema(err)) throw err; // the newest database update has not run yet: show an empty library
  }

  return (
    <main id="main" className="page dash-page stack">
      <BrandBar>
        {admin && <Link href="/admin" className="navlink">Admin</Link>}
        <Link href="/" className="navlink">Dashboard</Link>
        <Link href="/resources" className="navlink" aria-current="page">Resources</Link>
        <Link href="/account" className="navlink">Account</Link>
      </BrandBar>
      <header>
        <h1>Resources</h1>
        <p className="muted mt-2">Videos, guides and links picked for the team. Open one whenever you want a hand.</p>
      </header>
      {resources.length === 0 ? (
        <section className="card">
          <h2>Nothing here yet</h2>
          <p className="muted">When your team lead adds videos and guides, you will find them here.</p>
        </section>
      ) : (
        <ResourceLibrary resources={resources} ipaName={ipa?.name ?? null} />
      )}
    </main>
  );
}
