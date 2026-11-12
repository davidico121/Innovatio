"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { celebrate } from "./Toaster";

type Goal = { id: number; title: string; target: number; progress: number };

export default function Goals({ goals, monthLabel }: { goals: Goal[]; monthLabel: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, target: Number(target) }) });
    if (!res.ok) return setError((await res.json()).error ?? "Could not add");
    setTitle("");
    setTarget("");
    router.refresh();
  }
  async function bump(g: Goal, delta: number) {
    const res = await fetch(`/api/goals/${g.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta }) });
    const data = await res.json();
    if (data.celebration) celebrate([data.celebration]);
    router.refresh();
  }
  async function remove(g: Goal) {
    await fetch(`/api/goals/${g.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section className="card">
      <h2>{monthLabel} goals</h2>
      <p className="muted" style={{ marginBottom: 8 }}>Set what you want out of this month. Add to it as you go. Only you can see these.</p>
      {goals.map((g) => {
        const pct = Math.min(100, Math.round((100 * g.progress) / g.target));
        return (
          <div key={g.id} className="task">
            <div className="row between">
              <strong>{g.title}</strong>
              <span className={`pill ${pct >= 100 ? "done" : ""}`}>{g.progress}/{g.target}</span>
            </div>
            <div className={`bar ${pct >= 100 ? "done" : ""}`}><i style={{ width: `${pct}%` }} /></div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn ghost small" onClick={() => bump(g, 1)}>+1</button>
              <button className="btn ghost small" onClick={() => bump(g, 5)}>+5</button>
              <button className="btn ghost small" onClick={() => bump(g, -1)} aria-label="Take one off">-1</button>
              <span style={{ flex: 1 }} />
              <button className="link" onClick={() => remove(g)}>Remove</button>
            </div>
          </div>
        );
      })}
      <form onSubmit={add} className="row" style={{ marginTop: 10 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A goal, e.g. Book 5 calls" maxLength={140} className="field" aria-label="Goal" />
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" type="number" min={1} className="field" style={{ maxWidth: 100 }} aria-label="Target number" />
        <button className="btn ghost small" type="submit" disabled={!title.trim() || !target}>Add</button>
      </form>
      {error && <p className="err">{error}</p>}
    </section>
  );
}
