"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { celebrate } from "./Toaster";

type Todo = { id: number; title: string; done: boolean };

function List({ title, scope, todos, hint }: { title: string; scope: "day" | "week"; todos: Todo[]; hint: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: text, scope }) });
    if (!res.ok) return setError((await res.json()).error ?? "Could not add");
    setText("");
    router.refresh();
  }
  async function toggle(t: Todo) {
    await fetch(`/api/todos/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !t.done }) });
    const remaining = todos.filter((x) => !x.done && x.id !== t.id).length;
    if (!t.done && todos.length > 1 && remaining === 0) celebrate([`Your whole ${scope === "day" ? "day" : "week"} list is done.`]);
    router.refresh();
  }
  async function remove(t: Todo) {
    await fetch(`/api/todos/${t.id}`, { method: "DELETE" });
    router.refresh();
  }

  const done = todos.filter((t) => t.done).length;
  return (
    <div>
      <div className="row between">
        <h2 style={{ margin: 0 }}>{title}</h2>
        {todos.length > 0 && <span className={`pill ${done === todos.length ? "done" : ""}`}>{done}/{todos.length}</span>}
      </div>
      <p className="muted mt-2">{hint}</p>
      <div className="mt-3">
      {todos.map((t) => (
        <div key={t.id} className={`todo ${t.done ? "done" : ""}`}>
          <input type="checkbox" checked={t.done} onChange={() => toggle(t)} aria-label={t.title} />
          <span className="t">{t.title}</span>
          <button className="link" onClick={() => remove(t)} aria-label={`Delete ${t.title}`}>Remove</button>
        </div>
      ))}
      </div>
      <form onSubmit={add} className="todo-add">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add something" maxLength={140} className="field" aria-label={`Add to ${title}`} />
        <button className="btn secondary small" type="submit" disabled={!text.trim()}>Add</button>
      </form>
      {error && <p className="err mt-3" role="alert">{error}</p>}
    </div>
  );
}

export default function Todos({ day, week }: { day: Todo[]; week: Todo[] }) {
  return (
    <>
      <section className="card"><List title="My day" scope="day" todos={day} hint="Your own list for today. Only you can see it." /></section>
      <section className="card"><List title="My week" scope="week" todos={week} hint="What would make this week a good one?" /></section>
    </>
  );
}
