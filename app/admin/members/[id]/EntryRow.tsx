"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Td, Tr } from "../../../ui/Table";

type Entry = {
  id: number;
  work_date: string;
  label: string;
  count: number;
  proof_url: string | null;
  has_image: boolean;
  proof_purged: boolean;
  notes: string | null;
};

export default function EntryRow({ entry }: { entry: Entry }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState(String(entry.count));
  const [proof, setProof] = useState(entry.proof_url ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: Number(count), proof_url: proof, notes }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not save");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete this ${entry.label} entry from ${entry.work_date}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/entries/${entry.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Could not delete");
      return;
    }
    router.refresh();
  }

  if (!editing) {
    return (
      <Tr>
        <Td label="Date" className="num">{entry.work_date}</Td>
        <Td label="Work" className="strong">{entry.label}</Td>
        <Td label="Count" className="num">{entry.count}</Td>
        <Td label="Proof">
          <span>
            {entry.has_image && (
              <a href={`/api/proof/${entry.id}`} target="_blank" rel="noreferrer">
                screenshot
              </a>
            )}
            {entry.has_image && entry.proof_url && " | "}
            {entry.proof_url && (
              <a href={entry.proof_url} target="_blank" rel="noreferrer">
                link
              </a>
            )}
            {!entry.has_image && !entry.proof_url && (entry.proof_purged ? "screenshot removed after 60 days" : "none")}
          </span>
        </Td>
        <Td label="Notes">{entry.notes ?? ""}</Td>
        <Td className="actions">
          <button className="btn secondary small" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
          <button className="btn secondary small" onClick={remove} disabled={busy}>Delete</button>
          {error && <p className="err" role="alert">{error}</p>}
        </Td>
      </Tr>
    );
  }

  return (
    <Tr>
      <Td label="Date" className="num">{entry.work_date}</Td>
      <Td label="Work" className="strong">{entry.label}</Td>
      <Td label="Count" className="cell-input">
        <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} className="field" style={{ maxWidth: 96 }} aria-label="Count" />
      </Td>
      <Td label="Proof" className="cell-input">
        <input value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://" className="field" aria-label="Proof link" />
      </Td>
      <Td label="Notes" className="cell-input">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="field" aria-label="Notes" />
      </Td>
      <Td className="actions">
        <button className="btn small" onClick={save} disabled={busy}>Save</button>
        <button className="btn secondary small" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
        {error && <p className="err" role="alert">{error}</p>}
      </Td>
    </Tr>
  );
}
