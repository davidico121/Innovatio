"use client";

import { useState, type FormEvent } from "react";

type Work = { key: string; label: string; requires_proof: boolean };

export default function LogForm({
  work,
  today,
  yesterday,
}: {
  work: Work[];
  today: string;
  yesterday: string;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(work[0]?.key ?? "");

  const needsProof = work.find((w) => w.key === selected)?.requires_proof ?? false;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setStatus("");
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        work_key: f.get("work_key"),
        work_date: f.get("work_date"),
        count: Number(f.get("count")),
        proof_url: f.get("proof_url"),
        notes: f.get("notes"),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Could not save");
      return;
    }
    e.currentTarget.reset();
    setSelected(work[0]?.key ?? "");
    setStatus("Saved.");
    window.location.reload();
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
      <label>
        Work type
        <select
          name="work_key"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        >
          {work.map((w) => (
            <option key={w.key} value={w.key}>
              {w.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Date
        <select name="work_date" defaultValue={today} style={{ width: "100%", padding: 8 }}>
          <option value={today}>Today</option>
          <option value={yesterday}>Yesterday</option>
        </select>
      </label>
      <label>
        Count
        <input name="count" type="number" min={1} defaultValue={1} required style={{ width: "100%", padding: 8 }} />
      </label>
      <label>
        Proof link {needsProof ? "(required)" : "(optional)"}
        <input
          name="proof_url"
          type="url"
          placeholder="https://"
          required={needsProof}
          style={{ width: "100%", padding: 8 }}
        />
      </label>
      <label>
        Notes (optional)
        <input name="notes" maxLength={500} style={{ width: "100%", padding: 8 }} />
      </label>
      <button type="submit" disabled={busy} style={{ padding: 10 }}>
        {busy ? "Saving..." : "Save entry"}
      </button>
      {status && <p>{status}</p>}
    </form>
  );
}
