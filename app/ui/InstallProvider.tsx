"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Everything the install prompts need to know, in one place.
 *
 * Browsers decide when an app can be installed. Chrome, Edge and Samsung Internet send a
 * `beforeinstallprompt` event that we keep and fire when someone taps our own Install button.
 * iPhone Safari has no such event, so there we show the steps instead (Share, then Add to Home Screen).
 * Nothing here is sent anywhere. The only thing stored is when the person last said "Not now".
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type Platform = "ios" | "android" | "other";

type InstallState = {
  /** False until the browser has been checked, so nothing flashes on screen. */
  ready: boolean;
  /** Running as an installed app, or installed on this device already. */
  installed: boolean;
  platform: Platform;
  /** A phone or tablet. The popup is only for these. */
  mobile: boolean;
  /** The browser gave us the real install dialog to open. */
  canPrompt: boolean;
  /** "Not now" was tapped recently. */
  bannerDismissed: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismissBanner: () => void;
};

const DISMISS_KEY = "innovatio.install.dismissedUntil";
const DONE_KEY = "innovatio.install.doneAt";
const DISMISS_DAYS = 14;
const DONE_DAYS = 90;
const DAY = 86_400_000;

function read(key: string): number {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0; // private windows and blocked storage: behave as if nothing was saved
  }
}
function write(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* nothing to do: the prompt may show again next visit */
  }
}

function detectStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function detectPlatform(): { platform: Platform; mobile: boolean } {
  const ua = window.navigator.userAgent;
  const iPadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOs) return { platform: "ios", mobile: true };
  if (/Android/.test(ua)) return { platform: "android", mobile: true };
  return { platform: "other", mobile: false };
}

const InstallContext = createContext<InstallState | null>(null);

export function InstallProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [mobile, setMobile] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p.platform);
    setMobile(p.mobile);
    setInstalled(detectStandalone() || Date.now() - read(DONE_KEY) < DONE_DAYS * DAY);
    setBannerDismissed(Date.now() < read(DISMISS_KEY));
    setReady(true);

    // A small script in the page head (app/layout.tsx) catches the event early and keeps it on window.__bip.
    const adopt = () => {
      const early = (window as Window & { __bip?: InstallEvent }).__bip;
      if (early) {
        deferred.current = early;
        setCanPrompt(true);
      }
    };
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // keep the browser's own mini prompt away; we open the dialog from our button
      deferred.current = e as InstallEvent;
      setCanPrompt(true);
    };
    adopt();
    window.addEventListener("bip-ready", adopt);
    const onInstalled = () => {
      deferred.current = null;
      (window as Window & { __bip?: InstallEvent }).__bip = undefined;
      setCanPrompt(false);
      setInstalled(true);
      write(DONE_KEY, Date.now());
    };
    const mql = window.matchMedia("(display-mode: standalone)");
    const onMode = () => mql.matches && setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mql.addEventListener?.("change", onMode);
    return () => {
      window.removeEventListener("bip-ready", adopt);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mql.removeEventListener?.("change", onMode);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferred.current;
    if (!event) return "unavailable" as const;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred.current = null; // a browser lets each event be used once
    (window as Window & { __bip?: InstallEvent }).__bip = undefined;
    setCanPrompt(false);
    if (outcome === "accepted") {
      setInstalled(true);
      write(DONE_KEY, Date.now());
    }
    return outcome;
  }, []);

  const dismissBanner = useCallback(() => {
    write(DISMISS_KEY, Date.now() + DISMISS_DAYS * DAY);
    setBannerDismissed(true);
  }, []);

  const value = useMemo<InstallState>(
    () => ({ ready, installed, platform, mobile, canPrompt, bannerDismissed, promptInstall, dismissBanner }),
    [ready, installed, platform, mobile, canPrompt, bannerDismissed, promptInstall, dismissBanner],
  );
  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}

export function useInstall(): InstallState {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error("useInstall must be used inside InstallProvider");
  return ctx;
}
