import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminBar } from "../../../ui/BrandBar";
import ResourceForm from "../ResourceForm";
import { loadFormOptions } from "../options";

export const dynamic = "force-dynamic";

export default async function NewResourcePage({ searchParams }: { searchParams: Promise<{ ipa?: string }> }) {
  if (!(await isAdmin())) redirect("/login?as=admin");
  const { ipa } = await searchParams;
  const opts = await loadFormOptions();
  const preset = Number(ipa);
  const presetId = opts.ipas.some((i) => i.id === preset) ? [preset] : [];

  return (
    <main id="main" className="page wide stack">
      <AdminBar current="resources" />
      <header>
        <p className="mb-3"><Link href="/admin/resources">&larr; All resources</Link></p>
        <h1>Add a resource</h1>
      </header>
      <section className="card">
        <ResourceForm
          mode="new"
          initial={{ title: "", url: "", kind: "link", category: "", description: "", pinned: false, published: true, ipaIds: presetId }}
          ipas={opts.ipas}
          totalMembers={opts.totalMembers}
          categories={opts.categories}
        />
      </section>
    </main>
  );
}
