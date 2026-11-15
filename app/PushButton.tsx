"use client";

import { useEffect, useState } from "react";

function urlBase64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Props = {
  /** Where the device is linked to the account that is signed in. Team members and the admin have their own. */
  subscribeUrl?: string;
  label?: string;
  onText?: string;
};

/**
 * Turns notifications on for this device, for the account that is signed in. A device that has already
 * allowed notifications links itself again whenever this is on screen, so notifications follow whoever
 * is signed in and nobody has to tap twice.
 */
export default function PushButton({
  subscribeUrl = "/api/push/subscribe",
  label = "Turn on reminders",
  onText = "Reminders are on for this device. They stop when you sign out.",
}: Props) {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);

  async function link(sub: PushSubscription): Promise<boolean> {
    const res = await fetch(subscribeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
    return res.ok;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") return;
        if (Notification.permission !== "granted") return;
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing && (await link(existing)) && !cancelled) setOn(true);
      } catch {
        /* the button below still works */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeUrl]);

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
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as BufferSource,
        }));
      if (await link(sub)) {
        setMsg("");
        setOn(true);
      } else {
        setMsg("Could not save this device.");
      }
    } catch {
      setMsg("Could not turn on notifications.");
    }
  }

  return (
    <div className="stack tight mt-3">
      {on ? (
        <p className="row" role="status">
          <span className="pill done">On</span>
          <span className="muted">{onText}</span>
        </p>
      ) : (
        <button onClick={enable} className="btn secondary">
          {label}
        </button>
      )}
      {msg && !on && <p className="note" role="status">{msg}</p>}
    </div>
  );
}
