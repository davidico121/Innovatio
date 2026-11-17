// Everything about resource links that does not touch the database, so the browser can use it too.
export type Kind = "video" | "guide" | "link";
export const KINDS: Kind[] = ["video", "guide", "link"];
export const KIND_LABEL: Record<Kind, string> = { video: "Video", guide: "Guide", link: "Link" };
/** What the call to action says for each kind. */
export const KIND_ACTION: Record<Kind, string> = { video: "Watch video", guide: "Open guide", link: "Open link" };

export const LIMITS = { title: 120, category: 40, description: 300, url: 2000 };

/** Control characters and stray whitespace do not belong in a title or a description. */
export function cleanText(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s*\r?\n\s*/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Turns what the admin pasted into a web link, or null when it is not one we will store.
 * Only http and https are allowed, so a link can never run code (javascript:) or open a file
 * (file:, data:). A link with a username or password inside it is refused as well. A link typed
 * without the https:// in front gets it added.
 */
export function normalizeUrl(input: unknown): string | null {
  let s = String(input ?? "").trim();
  if (!s || s.length > LIMITS.url || /[\s\u0000-\u001f\u007f]/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (!u.hostname.includes(".")) return null; // "localhost" and bare words are not a public page
  return u.toString();
}

const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|loom\.com|wistia\.com|wistia\.net|tiktok\.com|dailymotion\.com|fathom\.video|vidyard\.com|descript\.com)$/;

/** A best guess at what a link is, so the admin does not have to choose. They can always change it. */
export function guessKind(url: string): Kind {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "link";
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();
  if (VIDEO_HOSTS.test(host)) return "video";
  if (host === "drive.google.com" && /\/file\//.test(path)) {
    return /\.(mp4|mov|webm)$/.test(path) ? "video" : "guide";
  }
  if (host === "docs.google.com" && /\/(document|presentation|spreadsheets)\//.test(path)) return "guide";
  if (/\.(pdf|docx?|pptx?|xlsx?|epub)$/.test(path)) return "guide";
  if (/\.(mp4|mov|webm|m4v)$/.test(path)) return "video";
  return "link";
}

/** The site a link is on, shown on the card so people know where it goes. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
