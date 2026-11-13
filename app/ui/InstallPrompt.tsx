"use client";

import { useEffect, useRef, useState } from "react";
import { useInstall, type Platform } from "./InstallProvider";

const SHOW_AFTER_MS = 2500;

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline-icon">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/** The steps for browsers that cannot open an install dialog from a button. */
function Steps({ platform }: { platform: Platform }) {
  if (platform === "ios") {
    return (
      <>
        <ol className="install-steps">
          <li>Tap the Share button <ShareIcon /> in Safari.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>.</li>
        </ol>
        <p className="muted small">Do not see it? Open this page in Safari first.</p>
      </>
    );
  }
  return (
    <ol className="install-steps">
      <li>Open your browser menu (the three dots).</li>
      <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
      <li>Tap <strong>Install</strong>.</li>
    </ol>
  );
}

/**
 * A small popup near the bottom of the screen, a moment after the dashboard opens, on phones and
 * tablets that have not installed the app. "Not now" hides it for two weeks.
 */
export function InstallBanner() {
  const { ready, installed, platform, mobile, canPrompt, bannerDismissed, promptInstall, dismissBanner } = useInstall();
  const [due, setDue] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const el = useRef<HTMLElement>(null);

  const eligible = ready && !installed && !bannerDismissed && mobile && (canPrompt || platform === "ios" || platform === "android");
  const visible = eligible && due;

  useEffect(() => {
    if (!eligible) return;
    const t = window.setTimeout(() => setDue(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [eligible]);

  // Lets the celebration toasts sit above the banner instead of behind it, however tall it is.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("has-install-banner", visible);
    const node = el.current;
    if (!visible || !node) return;
    const measure = () => root.style.setProperty("--install-h", `${Math.ceil(node.getBoundingClientRect().height)}px`);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(node);
    return () => {
      ro?.disconnect();
      root.classList.remove("has-install-banner");
      root.style.removeProperty("--install-h");
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <section className="install-banner" aria-label="Install the app" ref={el}>
      <div className="install-banner-head">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcSet="/brand/mark-dark.svg" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" width={36} height={41} className="install-mark" />
        </picture>
        <div className="grow">
          <p className="install-title">Add Innovatio to your home screen</p>
          <p className="muted small">Open it in one tap, like any other app, and get your reminders.</p>
        </div>
      </div>
      {howTo && !canPrompt && <Steps platform={platform} />}
      <div className="install-actions">
        {canPrompt ? (
          <button type="button" className="btn small" onClick={() => void promptInstall()}>Install</button>
        ) : (
          <button type="button" className="btn small" aria-expanded={howTo} onClick={() => setHowTo((h) => !h)}>
            {howTo ? "Hide steps" : "Show me how"}
          </button>
        )}
        <button type="button" className="link" onClick={dismissBanner}>Not now</button>
      </div>
    </section>
  );
}

/**
 * A permanent place on the dashboard for the same thing, for anyone who tapped "Not now" or
 * wants it later. It disappears once the app is installed.
 */
export function InstallCard() {
  const { ready, installed, platform, canPrompt, promptInstall } = useInstall();
  if (!ready || installed) return null;
  // A browser that cannot install apps at all (some desktop browsers) has nothing to offer.
  if (!canPrompt && platform === "other") return null;

  return (
    <section className="card" aria-labelledby="install-card-title">
      <h2 id="install-card-title">Get the app</h2>
      <p className="muted">
        Add it to your home screen to open it in one tap.
        {platform === "ios" ? " On iPhone, this is also what lets reminders reach you." : ""}
      </p>
      <div className="mt-3">
        {canPrompt ? (
          <button type="button" className="btn block" onClick={() => void promptInstall()}>Install the app</button>
        ) : (
          <Steps platform={platform} />
        )}
      </div>
    </section>
  );
}
