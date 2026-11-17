import { KINDS, LIMITS, cleanText, normalizeUrl, type Kind } from "./resourceLinks";

export type ResourceFields = {
  title?: string;
  url?: string;
  kind?: Kind;
  category?: string;
  description?: string;
  pinned?: boolean;
  published?: boolean;
  ipaIds?: number[];
};

/**
 * Checks what the admin sent. With `partial` only the fields present are checked and returned, which
 * is what the quick actions in the list use (pin, publish). Otherwise a title and a link are required.
 */
export function parseResourceInput(input: unknown, partial: boolean): { error: string } | { fields: ResourceFields } {
  if (!input || typeof input !== "object") return { error: "Nothing was sent." };
  const i = input as Record<string, unknown>;
  const out: ResourceFields = {};
  const has = (k: string) => i[k] !== undefined;

  if (!partial || has("title")) {
    const title = cleanText(i.title, LIMITS.title + 1);
    if (!title) return { error: "Add a title." };
    if (title.length > LIMITS.title) return { error: `Keep the title to ${LIMITS.title} characters.` };
    out.title = title;
  }
  if (!partial || has("url")) {
    const url = normalizeUrl(i.url);
    if (!url) return { error: "That does not look like a web link. Paste a full link, for example https://youtu.be/..." };
    out.url = url;
  }
  if (!partial || has("kind")) {
    const kind = String(i.kind ?? "");
    if (!KINDS.includes(kind as Kind)) return { error: "Choose Video, Guide or Link." };
    out.kind = kind as Kind;
  }
  if (has("category") || !partial) {
    const category = cleanText(i.category, LIMITS.category + 1);
    if (category.length > LIMITS.category) return { error: `Keep the category to ${LIMITS.category} characters.` };
    out.category = category;
  }
  if (has("description") || !partial) {
    const description = cleanText(i.description, LIMITS.description + 1);
    if (description.length > LIMITS.description) return { error: `Keep the description to ${LIMITS.description} characters.` };
    out.description = description;
  }
  if (has("pinned")) out.pinned = i.pinned === true;
  if (has("published")) out.published = i.published === true;
  if (has("ipaIds")) {
    if (!Array.isArray(i.ipaIds) || i.ipaIds.length > 100) return { error: "Choose IPAs from the list." };
    const ids = i.ipaIds.map(Number);
    if (ids.some((n) => !Number.isInteger(n) || n < 1)) return { error: "Choose IPAs from the list." };
    out.ipaIds = [...new Set(ids)];
  }
  return { fields: out };
}
