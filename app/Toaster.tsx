"use client";

import { useEffect, useState } from "react";

// Brand colours from the design tokens in globals.css, so the confetti follows the theme.
const COLORS = ["var(--confetti-1)", "var(--confetti-2)", "var(--confetti-3)", "var(--confetti-4)", "var(--confetti-5)"];

export function celebrate(messages: string[]) {
  if (messages.length) window.dispatchEvent(new CustomEvent("celebrate", { detail: messages }));
}

export default function Toaster() {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    let n = 0;
    function onCelebrate(e: Event) {
      const msgs = (e as CustomEvent<string[]>).detail;
      const added = msgs.map((text) => ({ id: ++n + Date.now(), text }));
      setToasts((t) => [...t, ...added]);
      setBurst((b) => b + 1);
      setTimeout(() => setToasts((t) => t.filter((x) => !added.some((a) => a.id === x.id))), 4500);
    }
    window.addEventListener("celebrate", onCelebrate);
    return () => window.removeEventListener("celebrate", onCelebrate);
  }, []);

  return (
    <>
      {burst > 0 && (
        <div className="confetti" key={burst} aria-hidden>
          {Array.from({ length: 36 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 97) % 100}%`,
                background: COLORS[i % COLORS.length],
                animationDelay: `${(i % 9) * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
