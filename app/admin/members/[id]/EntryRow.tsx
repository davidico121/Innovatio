"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Entry = {
  id: number;
  work_date: string;
  label: string;
  count: number;
  proof_url: string | null;
  notes: string | null;
};

const cell = { padding: 6, borderBottom: "1px solid #eee", verticalAlign: "top" as const };
const input = { padding: 6, width: "100%", boxSizing: "border-box" as const };

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
      <tr>
        <td style={cell}>{entry.work_date}</td>
        <td style={cell}>{entry.label}</td>
        <td style={cell}>{entry.count}</td>
        <td style={cell}>
          {entry.proof_url ? (
            <a href={entry.proof_url} target="_blank" rel="noreferrer">
              proof
            </a>
          ) : (
            "none"
          )}
        </td>
        <td style={cell}>{entry.notes ?? ""}</td>
        <td style={cell}>
          <button onClick={() => setEditing(true)} disabled={busy}>Edit</button>{" "}
          <button onClick={remove} disabled={busy}>Delete</button>
          {error && <p style={{ color: "#b00020" }}>{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td style={cell}>{entry.work_date}</td>
      <td style={cell}>{entry.label}</td>
      <td style={cell}>
        <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} style={{ ...input, width: 70 }} />
      </td>
      <td style={cell}>
        <input value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://" style={input} />
      </td>
      <td style={cell}>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} style={input} />
      </td>
      <td style={cell}>
        <button onClick={save} disabled={busy}>Save</button>{" "}
        <button onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
      </td>
    </tr>
  );
}
