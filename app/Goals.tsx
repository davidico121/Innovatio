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
      <p className="muted mb-3">Set what you want out of this month. Add to it as you go. Only you can see these.</p>
      {goals.map((g) => {
        const pct = Math.min(100, Math.round((100 * g.progress) / g.target));
        return (
          <div key={g.id} className="task">
            <div className="row between">
              <strong>{g.title}</strong>
              <span className={`pill ${pct >= 100 ? "done" : ""}`}>{g.progress}/{g.target}</span>
            </div>
            <div className={`bar ${pct >= 100 ? "done" : ""}`} role="progressbar" aria-label={`${g.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
            <div className="goal-actions">
              <button className="btn secondary small" onClick={() => bump(g, 1)} aria-label={`Add one to ${g.title}`}>+1</button>
              <button className="btn secondary small" onClick={() => bump(g, 5)} aria-label={`Add five to ${g.title}`}>+5</button>
              <button className="btn secondary small" onClick={() => bump(g, -1)} aria-label={`Take one off ${g.title}`}>-1</button>
              <span className="spacer" />
              <button className="link" onClick={() => remove(g)} aria-label={`Remove ${g.title}`}>Remove</button>
            </div>
          </div>
        );
      })}
      <form onSubmit={add} className="goal-add">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A goal, e.g. Book 5 calls" maxLength={140} className="field" aria-label="Goal" />
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" type="number" min={1} className="field" aria-label="Target number" />
        <button className="btn secondary small" type="submit" disabled={!title.trim() || !target}>Add</button>
      </form>
      {error && <p className="err mt-3" role="alert">{error}</p>}
    </section>
  );
}
