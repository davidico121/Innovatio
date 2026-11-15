"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const TITLE_MAX = 80;
const MESSAGE_MAX = 400;

type Audience = { members: number; withDevices: number; devices: number };
type Result = { members: number; pushMembers: number; pushDevices: number; emailed: number; emailFailed: number; email: boolean };

/** Writes a message, shows how it will look on a phone, and sends it to every active member after a confirmation. */
export default function BroadcastForm({ audience }: { audience: Audience }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const ready = title.trim().length > 0 && message.trim().length > 0 && audience.members > 0;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    const who = plural(audience.members, "member", "members");
    const how = email ? "as a notification and by email" : "as a notification";
    if (!window.confirm(`Send this to ${who} ${how}? It cannot be taken back.`)) return;

    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send. Nothing was sent.");
        return;
      }
      setResult({ ...data, email });
      setTitle("");
      setMessage("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check whether it was sent in the history below before sending again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="stack tight">
      <label className="label">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required className="field" placeholder="e.g. Team call at 5pm today" />
        <span className="charcount" aria-hidden="true">{title.length} / {TITLE_MAX}</span>
      </label>
      <label className="label">
        Message
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MESSAGE_MAX} required rows={4} className="field" placeholder="What do you want the team to know?" />
        <span className="charcount" aria-hidden="true">{message.length} / {MESSAGE_MAX}</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
        Also email it to every member
      </label>

      <div className="notif-preview" aria-label="How it will look on a phone">
        <p className="eyebrow muted">How it looks on a phone</p>
        <div className="notif-card">
          <div className="notif-meta">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" width={18} height={18} className="notif-icon" />
            <span>Innovatio Team Tracker</span>
            <span>now</span>
          </div>
          <p className="notif-title">{title.trim() || "Your title"}</p>
          <p className="notif-body">{message.trim() || "Your message"}</p>
        </div>
      </div>

      <p className="muted small">
        {audience.members === 0
          ? "There are no active members to send to."
          : `Goes to ${plural(audience.members, "active member", "active members")}. Notifications are on for ${audience.withDevices} of them (${plural(audience.devices, "device", "devices")}).${
              email ? " Everyone also gets the email, including members without notifications." : audience.withDevices < audience.members ? " Members without notifications will not see it unless you also email it." : ""
            }`}
      </p>

      <button type="submit" className="btn" disabled={!ready || busy}>{busy ? "Sending..." : "Send broadcast"}</button>

      {error && <p className="err" role="alert">{error}</p>}
      {result && (
        <p className="win" role="status">
          Sent. The notification reached {plural(result.pushDevices, "device", "devices")} ({result.pushMembers} of {result.members} members).
          {result.email ? ` Emailed ${result.emailed} of ${result.members}.` : ""}
          {result.emailFailed > 0 ? ` ${plural(result.emailFailed, "email", "emails")} could not be sent.` : ""}
        </p>
      )}
    </form>
  );
}
