"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** The quick actions on a row of the admin list: move up or down, pin, publish. Each one saves straight away. */
export default function RowActions({ id, title, pinned, published, first, last }: { id: number; title: string; pinned: boolean; published: boolean; first: boolean; last: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(url: string, init: RequestInit) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      if (!res.ok) setError("Could not save that.");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }
  const patch = (body: object) => call(`/api/admin/resources/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  const move = (direction: "up" | "down") => call(`/api/admin/resources/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) });

  return (
    <>
      <button type="button" className="btn secondary small" disabled={busy || first} onClick={() => move("up")} aria-label={`Move ${title} up`}>Up</button>
      <button type="button" className="btn secondary small" disabled={busy || last} onClick={() => move("down")} aria-label={`Move ${title} down`}>Down</button>
      <button type="button" className="btn secondary small" disabled={busy} onClick={() => patch({ pinned: !pinned })} aria-label={`${pinned ? "Unpin" : "Pin"} ${title}`}>{pinned ? "Unpin" : "Pin"}</button>
      <button type="button" className="btn secondary small" disabled={busy} onClick={() => patch({ published: !published })} aria-label={`${published ? "Unpublish" : "Publish"} ${title}`}>{published ? "Unpublish" : "Publish"}</button>
      {error && <span className="err small" role="alert">{error}</span>}
    </>
  );
}
