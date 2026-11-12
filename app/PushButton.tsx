"use client";

import { useState } from "react";

function urlBase64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function PushButton() {
  const [msg, setMsg] = useState("");

  async function enable() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg("To get reminders, add this app to your home screen first (iPhone: Share, then Add to Home Screen).");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg("Notifications are blocked for this site.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ) as unknown as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setMsg(res.ok ? "Reminders are on for this device." : "Could not save this device.");
    } catch {
      setMsg("Could not turn on reminders.");
    }
  }

  return (
    <div style={{ margin: "8px 0" }}>
      <button onClick={enable} className="btn ghost">
        Turn on reminders
      </button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
