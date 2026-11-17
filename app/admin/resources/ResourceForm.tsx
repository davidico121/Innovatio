"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KIND_LABEL, LIMITS, guessKind, normalizeUrl, type Kind } from "@/lib/resourceLinks";

type IpaOption = { id: number; name: string; members: number };
export type ResourceValues = {
  title: string;
  url: string;
  kind: Kind;
  category: string;
  description: string;
  pinned: boolean;
  published: boolean;
  ipaIds: number[];
};
type Told = { members: number; pushMembers: number; pushDevices: number; emailed: number; emailFailed: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Add or edit one resource. The type follows the link until the admin chooses one themselves. */
export default function ResourceForm({
  mode,
  id,
  initial,
  ipas,
  totalMembers,
  categories,
  toldAt,
}: {
  mode: "new" | "edit";
  id?: number;
  initial: ResourceValues;
  ipas: IpaOption[];
  totalMembers: number;
  categories: string[];
  toldAt?: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<ResourceValues>(initial);
  const [kindChosen, setKindChosen] = useState(mode === "edit");
  const [notify, setNotify] = useState(false);
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const set = <K extends keyof ResourceValues>(k: K, val: ResourceValues[K]) => setV((p) => ({ ...p, [k]: val }));

  function onUrl(url: string) {
    setV((p) => {
      const norm = normalizeUrl(url);
      return { ...p, url, kind: !kindChosen && norm ? guessKind(norm) : p.kind };
    });
  }
  function toggleIpa(ipaId: number) {
    set("ipaIds", v.ipaIds.includes(ipaId) ? v.ipaIds.filter((x) => x !== ipaId) : [...v.ipaIds, ipaId]);
  }

  const audience = v.ipaIds.length ? ipas.filter((i) => v.ipaIds.includes(i.id)).reduce((n, i) => n + i.members, 0) : totalMembers;
  const canNotify = v.published && audience > 0;
  const ready = v.title.trim().length > 0 && v.url.trim().length > 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    const willNotify = notify && canNotify;
    if (willNotify) {
      const how = email ? "as a notification and by email" : "as a notification";
      if (!window.confirm(`Save this and tell ${plural(audience, "member", "members")} ${how}? The message cannot be taken back.`)) return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(mode === "new" ? "/api/admin/resources" : `/api/admin/resources/${id}`, {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, notify: willNotify, email: willNotify && email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save. Nothing was changed.");
        return;
      }
      const told: Told | undefined = data.told ?? undefined;
      if (mode === "new") {
        const q = new URLSearchParams({ saved: "added" });
        if (told) {
          q.set("told", String(told.members));
          q.set("push", String(told.pushMembers));
          q.set("mail", String(told.emailed));
        }
        if (data.notifyNote) q.set("note", "1");
        router.push(`/admin/resources?${q.toString()}`);
        return;
      }
      setStatus(
        told
          ? `Saved. Told ${plural(told.members, "member", "members")}: the notification reached ${told.pushMembers}${email ? `, and ${told.emailed} got the email` : ""}.`
          : data.notifyNote
            ? `Saved. ${data.notifyNote}`
            : "Saved.",
      );
      setNotify(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check the list before trying again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || busy) return;
    if (!window.confirm(`Delete "${v.title}"? Members will no longer see it, and its open counts go too.`)) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/resources/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setBusy(false);
      setError("Could not delete it.");
      return;
    }
    router.push("/admin/resources?saved=deleted");
  }

  return (
    <form onSubmit={save} className="stack tight">
      <label className="label">
        Title
        <input value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={LIMITS.title} required className="field" placeholder="e.g. How to write a first outreach email" />
        <span className="charcount" aria-hidden="true">{v.title.length} / {LIMITS.title}</span>
      </label>

      <label className="label">
        Link
        <input
          value={v.url}
          onChange={(e) => onUrl(e.target.value)}
          required
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={LIMITS.url}
          className="field"
          placeholder="https://youtu.be/... or a link to a PDF"
          aria-describedby="res-link-help"
        />
      </label>
      <p id="res-link-help" className="muted small" style={{ marginTop: "-4px" }}>
        Paste the link to a video, a PDF or any page. Nothing is uploaded, members just open the link.
      </p>

      <div className="formrow">
        <label className="label" style={{ flex: "1 1 160px" }}>
          Type
          <select
            value={v.kind}
            onChange={(e) => {
              setKindChosen(true);
              set("kind", e.target.value as Kind);
            }}
            className="field"
          >
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <label className="label" style={{ flex: "2 1 200px" }}>
          Category
          <input value={v.category} onChange={(e) => set("category", e.target.value)} maxLength={LIMITS.category} list="res-categories" className="field" placeholder="e.g. Getting started (optional)" />
          <datalist id="res-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
      </div>

      <label className="label">
        Short description (optional)
        <textarea value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={LIMITS.description} rows={3} className="field" placeholder="One or two lines on what they will get from it." />
        <span className="charcount" aria-hidden="true">{v.description.length} / {LIMITS.description}</span>
      </label>

      <fieldset className="checkgroup">
        <legend className="label-text">Who is it for?</legend>
        {ipas.length === 0 ? (
          <p className="muted small">There are no IPAs yet, so this goes to everyone.</p>
        ) : (
          <>
            {ipas.map((i) => (
              <label key={i.id} className="check">
                <input type="checkbox" checked={v.ipaIds.includes(i.id)} onChange={() => toggleIpa(i.id)} />
                {i.name} <span className="muted small">({plural(i.members, "member", "members")})</span>
              </label>
            ))}
            <p className="muted small">
              {v.ipaIds.length === 0
                ? "Nothing ticked means it is for everyone. Everyone can see every resource. Ticking an IPA puts it first for the people on that IPA."
                : "Everyone can still find it in Resources. It is shown first to the people on the IPAs you ticked."}
            </p>
          </>
        )}
      </fieldset>

      <div className="stack tight">
        <label className="check">
          <input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} />
          Published (members can see it)
        </label>
        <label className="check">
          <input type="checkbox" checked={v.pinned} onChange={(e) => set("pinned", e.target.checked)} />
          Pin to the top of the page
        </label>
      </div>

      <fieldset className="checkgroup">
        <legend className="label-text">Tell the team</legend>
        <label className="check">
          <input type="checkbox" checked={notify && canNotify} disabled={!canNotify} onChange={(e) => setNotify(e.target.checked)} />
          Send a notification when I save
        </label>
        {notify && canNotify && (
          <label className="check">
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
            Also email it
          </label>
        )}
        <p className="muted small">
          {!v.published
            ? "Publish it first. Drafts are not announced."
            : audience === 0
              ? "No active members would receive it."
              : `Goes to ${plural(audience, "active member", "active members")}${v.ipaIds.length ? " on the IPAs you ticked" : ""}.`}
          {toldAt ? ` The team was last told about this on ${toldAt}.` : ""}
        </p>
      </fieldset>

      <div className="row wrap">
        <button type="submit" className="btn" disabled={!ready || busy}>{busy ? "Saving..." : mode === "new" ? "Add resource" : "Save changes"}</button>
        {mode === "edit" && (
          <button type="button" className="btn secondary" onClick={remove} disabled={busy}>Delete</button>
        )}
      </div>

      {error && <p className="err" role="alert">{error}</p>}
      {status && <p className="win" role="status">{status}</p>}
    </form>
  );
}
