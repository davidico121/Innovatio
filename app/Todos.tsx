"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { celebrate } from "./Toaster";

type Todo = { id: number; title: string; done: boolean };
type Day = "today" | "tomorrow";

function List({
  title,
  scope,
  when,
  todos,
  hint,
  addLabel,
  celebrates = true,
  bare = false,
}: {
  title: string;
  scope: "day" | "week";
  /** For a day list: today, or tomorrow when planning ahead. */
  when?: Day;
  todos: Todo[];
  hint: string;
  addLabel: string;
  /** Finishing a whole list is a win, but only for a list that is happening now. */
  celebrates?: boolean;
  /** Leave out the heading, for a list that sits under a card heading of its own. */
  bare?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: text, scope, day: when }) });
    if (!res.ok) return setError((await res.json()).error ?? "Could not add");
    setText("");
    router.refresh();
  }
  async function toggle(t: Todo) {
    await fetch(`/api/todos/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !t.done }) });
    const remaining = todos.filter((x) => !x.done && x.id !== t.id).length;
    if (celebrates && !t.done && todos.length > 1 && remaining === 0) celebrate([`Your whole ${scope === "day" ? "day" : "week"} list is done.`]);
    router.refresh();
  }
  async function remove(t: Todo) {
    await fetch(`/api/todos/${t.id}`, { method: "DELETE" });
    router.refresh();
  }

  const done = todos.filter((t) => t.done).length;
  return (
    <div>
      {!bare && (
        <div className="row between">
          <h2 style={{ margin: 0 }}>{title}</h2>
          {todos.length > 0 && <span className={`pill ${done === todos.length ? "done" : ""}`}>{done}/{todos.length}</span>}
        </div>
      )}
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
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add something" maxLength={140} className="field" aria-label={addLabel} />
        <button className="btn secondary small" type="submit" disabled={!text.trim()}>Add</button>
      </form>
      {error && <p className="err mt-3" role="alert">{error}</p>}
    </div>
  );
}

/** "My day" has two tabs: today's list, and tomorrow's for planning ahead. Tomorrow's list becomes today's at midnight. */
function DayCard({ day, tomorrow, initialDay }: { day: Todo[]; tomorrow: Todo[]; initialDay: Day }) {
  const [tab, setTab] = useState<Day>(initialDay);
  const refs = { today: useRef<HTMLButtonElement>(null), tomorrow: useRef<HTMLButtonElement>(null) };

  function onKey(e: KeyboardEvent) {
    const order: Day[] = ["today", "tomorrow"];
    let next: Day | null = null;
    if (e.key === "ArrowRight") next = order[(order.indexOf(tab) + 1) % 2];
    if (e.key === "ArrowLeft") next = order[(order.indexOf(tab) + 1) % 2];
    if (e.key === "Home") next = "today";
    if (e.key === "End") next = "tomorrow";
    if (next) {
      e.preventDefault();
      setTab(next);
      refs[next].current?.focus();
    }
  }

  const todayDone = day.filter((t) => t.done).length;
  const label = (d: Day) => (d === "today" ? "Today" : "Tomorrow");
  const countText = (d: Day) => {
    const list = d === "today" ? day : tomorrow;
    return d === "today" && list.length > 0 ? `${todayDone}/${list.length}` : list.length > 0 ? String(list.length) : "";
  };

  return (
    <section className="card" id="plan" aria-labelledby="my-day-title">
      <h2 id="my-day-title" style={{ marginBottom: 0 }}>My day</h2>
      <div role="tablist" aria-label="Which day to plan" className="tabs" onKeyDown={onKey}>
        {(["today", "tomorrow"] as Day[]).map((d) => (
          <button
            key={d}
            ref={refs[d]}
            id={`tab-${d}`}
            type="button"
            role="tab"
            aria-selected={tab === d}
            aria-controls={`panel-${d}`}
            tabIndex={tab === d ? 0 : -1}
            className="tab"
            onClick={() => setTab(d)}
          >
            {label(d)}
            {countText(d) && <span className="tab-count">{countText(d)}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "today" ? (
          <List key="today" title="My day" scope="day" when="today" todos={day} bare hint="Your own list for today. Only you can see it." addLabel="Add to My day" />
        ) : (
          <List
            key="tomorrow"
            title="Tomorrow"
            scope="day"
            when="tomorrow"
            todos={tomorrow}
            bare
            celebrates={false}
            hint="Plan tomorrow tonight and wake up knowing what matters. This becomes your day list at midnight. Only you can see it."
            addLabel="Add to tomorrow"
          />
        )}
      </div>
    </section>
  );
}

export default function Todos({ day, tomorrow, week, initialDay = "today" }: { day: Todo[]; tomorrow: Todo[]; week: Todo[]; initialDay?: Day }) {
  return (
    <>
      <DayCard day={day} tomorrow={tomorrow} initialDay={initialDay} />
      <section className="card"><List title="My week" scope="week" todos={week} hint="What would make this week a good one?" addLabel="Add to My week" /></section>
    </>
  );
}
