"use client";

import { useMemo, useState } from "react";
import { KIND_ACTION, KIND_LABEL, hostOf, type Kind } from "@/lib/resourceLinks";
import type { MemberResource } from "@/lib/resources";
import { KindIcon } from "../ui/KindIcon";

type Filter = "all" | Kind | "mine";

/** Tells the app a resource was opened, so the admin can see which ones get used. Counts only, never who. */
export function trackOpen(id: number) {
  try {
    void fetch(`/api/resources/${id}/open`, { method: "POST", keepalive: true });
  } catch {
    /* counting must never get in the way of opening a link */
  }
}

export function ResourceCard({ r }: { r: MemberResource }) {
  return (
    <article className="res-card">
      <div className={`res-icon k-${r.kind}`}><KindIcon kind={r.kind} /></div>
      <div className="res-main">
        <h3 className="res-h">
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="res-link" onClick={() => trackOpen(r.id)} onAuxClick={() => trackOpen(r.id)}>
            {r.title}
            <span className="sr"> ({KIND_LABEL[r.kind]}, opens in a new tab)</span>
          </a>
        </h3>
        {r.description && <p className="res-desc">{r.description}</p>}
        <p className="res-meta">
          {r.isNew && <span className="badge brand">New</span>}
          <span className="muted small">{KIND_LABEL[r.kind]} on {hostOf(r.url)}</span>
          {r.ipas.map((n) => <span key={n} className="badge quiet">{n}</span>)}
        </p>
      </div>
      <span className="res-cta" aria-hidden="true">{KIND_ACTION[r.kind]}</span>
    </article>
  );
}

function Group({ title, items }: { title: string; items: MemberResource[] }) {
  if (items.length === 0) return null;
  return (
    <section className="res-group" aria-label={title}>
      <h2>{title}</h2>
      <div className="res-list">{items.map((r) => <ResourceCard key={r.id} r={r} />)}</div>
    </section>
  );
}

/** The whole library: a search box, filter chips, and the resources in groups. Filtering happens on the phone, instantly. */
export default function ResourceLibrary({ resources, ipaName }: { resources: MemberResource[]; ipaName: string | null }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const hasMine = resources.some((r) => r.forMe);
  const counts = useMemo(
    () => ({ all: resources.length, video: resources.filter((r) => r.kind === "video").length, guide: resources.filter((r) => r.kind === "guide").length, link: resources.filter((r) => r.kind === "link").length, mine: resources.filter((r) => r.forMe).length }),
    [resources],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return resources.filter((r) => {
      if (filter === "mine" ? !r.forMe : filter !== "all" && r.kind !== filter) return false;
      if (!needle) return true;
      return [r.title, r.description, r.category, ...r.ipas].some((t) => t.toLowerCase().includes(needle));
    });
  }, [resources, q, filter]);

  const pinned = shown.filter((r) => r.pinned);
  const mine = shown.filter((r) => !r.pinned && r.forMe);
  const rest = shown.filter((r) => !r.pinned && !r.forMe);
  const categories: string[] = [];
  for (const r of rest) if (!categories.includes(r.category)) categories.push(r.category);

  const all: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "mine", label: ipaName ? "For my IPA" : "For me", n: hasMine ? counts.mine : 0 },
    { key: "video", label: "Videos", n: counts.video },
    { key: "guide", label: "Guides", n: counts.guide },
    { key: "link", label: "Links", n: counts.link },
  ];
  const chips = all.filter((c) => c.key === "all" || c.n > 0);

  return (
    <div className="stack">
      <div className="res-tools">
        <label className="label res-search">
          <span className="sr">Search resources</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className="field" placeholder="Search resources" autoComplete="off" />
        </label>
        <div className="chips" role="group" aria-label="Show">
          {chips.map((c) => (
            <button key={c.key} type="button" className="chip" aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
              {c.label} <span className="chip-n">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="sr" role="status" aria-live="polite">{shown.length === 1 ? "1 resource shown" : `${shown.length} resources shown`}</p>

      {shown.length === 0 ? (
        <p className="note">Nothing matches that. Try another word, or choose All.</p>
      ) : (
        <>
          <Group title="Pinned" items={pinned} />
          <Group title={ipaName ? `For your IPA: ${ipaName}` : "For you"} items={mine} />
          {categories.map((c) => (
            <Group key={c || "_"} title={c || (pinned.length || mine.length ? "More resources" : "Resources")} items={rest.filter((r) => r.category === c)} />
          ))}
        </>
      )}
    </div>
  );
}
