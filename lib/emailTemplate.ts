/**
 * The branded HTML for every email the app sends. The plain-text versions are written next to
 * each message and are never generated from this, so a client that shows only text still gets
 * the same words.
 *
 * Email clients do not support CSS variables, so the values below are the Innovatio Team design
 * system's tokens written out (see app/globals.css for the names):
 *   yellow-500 #f9b612   ink-900 #000000   ink-800 #101010   ink-500 #5c5c5c
 *   paper-50 #f6f6f6     paper-0 #ffffff   paper-100 #eeeeee   paper-200 #e2e2e2
 * Clients that honour prefers-color-scheme get the derived dark values from globals.css and the
 * dark logo. Everything else gets the light version. Fonts are the design system's families with
 * web-safe fallbacks, because most mail apps cannot load web fonts.
 */

export type EmailDot = { label: string; state: "met" | "missed" | "rest" | "today" | "upcoming" };
export type EmailRow = { label: string; value: string };

export type EmailSpec = {
  /** The preview line some mail apps show beside the subject. */
  preheader: string;
  heading: string;
  /** Paragraphs under the heading. Put the greeting in the first one. */
  intro?: string[];
  /** The big yellow panel: a number and what it counts. */
  hero?: { value: string; label: string; dots?: EmailDot[]; note?: string };
  /** The temporary password box. */
  code?: { label: string; value: string };
  steps?: string[];
  /** `stacked` puts each value under its label, for long values such as the digest lines. */
  sections?: { title: string; rows: EmailRow[]; empty?: string; stacked?: boolean }[];
  outro?: string[];
  button?: { label: string; url: string };
  footer?: string;
};

/** Escapes text for use inside HTML. Names, labels and notes are user-written, so every one goes through this. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only web links are allowed in a button. */
function safeUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

const HEAD = `font-family:'Archivo Black','Arial Black',Arial,Helvetica,sans-serif;font-weight:900;`;
const BODY = `font-family:'Open Sans',Arial,Helvetica,sans-serif;`;
const LABEL = `font-family:Roboto,'Open Sans',Arial,Helvetica,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;`;

function paragraphs(items: string[] | undefined, extra = ""): string {
  return (items ?? [])
    .map((p) => `<p class="tx" style="${BODY}margin:0 0 16px 0;font-size:16px;line-height:24px;color:#101010;${extra}">${esc(p)}</p>`)
    .join("");
}

function dot(d: EmailDot): string {
  const base = `width:32px;height:32px;border-radius:16px;text-align:center;font-size:16px;line-height:28px;font-weight:700;${BODY}`;
  const style =
    d.state === "met"
      ? `${base}background:#000000;color:#f9b612;border:2px solid #000000;`
      : d.state === "missed"
        ? `${base}background:#f9b612;color:#000000;border:2px dashed #5c5c5c;`
        : d.state === "rest"
          ? `${base}background:#f9b612;color:#000000;border:2px solid #c98f00;`
          : d.state === "today"
            ? `${base}background:#f9b612;color:#000000;border:3px solid #000000;`
            : `${base}background:#f9b612;color:#000000;border:2px solid #000000;`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:separate;border-spacing:0"><tr><td style="${style}">${d.state === "met" ? "&#10003;" : "&nbsp;"}</td></tr></table>`;
}

function hero(h: NonNullable<EmailSpec["hero"]>): string {
  const dots = h.dots?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px"><tr>${h.dots
        .map(
          (d) =>
            `<td align="center" style="padding:0 2px"><div style="${LABEL}font-size:10px;letter-spacing:0.08em;line-height:14px;color:#000000;padding-bottom:4px">${esc(d.label)}</div>${dot(d)}</td>`,
        )
        .join("")}</tr></table>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;border-collapse:separate"><tr><td style="background:#f9b612;border:3px solid #000000;border-radius:16px;padding:20px 20px 22px 20px;color:#000000">
<div style="${HEAD}font-size:56px;line-height:56px;letter-spacing:-0.02em;color:#000000">${esc(h.value)}</div>
<div style="${BODY}font-size:16px;line-height:24px;font-weight:600;color:#000000;margin-top:6px">${esc(h.label)}</div>${dots}${
    h.note ? `<div style="${BODY}font-size:14px;line-height:20px;color:#2a2a2a;margin-top:14px">${esc(h.note)}</div>` : ""
  }</td></tr></table>`;
}

function code(c: NonNullable<EmailSpec["code"]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px 0;border-collapse:separate"><tr><td class="sunk ln" style="background:#eeeeee;border:2px solid #000000;border-radius:8px;padding:14px 16px">
<div class="mu" style="${LABEL}font-size:11px;line-height:16px;color:#5c5c5c">${esc(c.label)}</div>
<div class="tx" style="font-family:'Courier New',Courier,monospace;font-size:24px;line-height:32px;font-weight:700;letter-spacing:0.08em;color:#000000;margin-top:4px">${esc(c.value)}</div>
</td></tr></table>`;
}

function steps(items: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0">${items
    .map(
      (s, i) =>
        `<tr><td valign="top" width="36" style="padding:0 0 12px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0"><tr><td style="width:28px;height:28px;border-radius:14px;background:#f9b612;border:2px solid #000000;color:#000000;text-align:center;font-size:14px;line-height:24px;font-weight:700;${BODY}">${i + 1}</td></tr></table></td><td class="tx" valign="top" style="${BODY}padding:2px 0 12px 0;font-size:16px;line-height:24px;color:#101010">${esc(s)}</td></tr>`,
    )
    .join("")}</table>`;
}

function section(s: NonNullable<EmailSpec["sections"]>[number]): string {
  const body = s.rows.length && s.stacked
    ? s.rows
        .map(
          (r, i) =>
            `<tr><td class="hl" style="padding:10px 0;${i === 0 ? "" : "border-top:1.5px solid #e2e2e2;"}"><div class="tx" style="${BODY}font-size:16px;line-height:22px;font-weight:700;color:#101010">${esc(r.label)}</div><div class="mu" style="${BODY}font-size:14px;line-height:20px;color:#5c5c5c;padding-top:2px">${esc(r.value)}</div></td></tr>`,
        )
        .join("")
    : s.rows.length
    ? s.rows
        .map(
          (r, i) =>
            `<tr><td class="tx hl" style="${BODY}padding:10px 0;${i === 0 ? "" : "border-top:1.5px solid #e2e2e2;"}font-size:16px;line-height:22px;font-weight:700;color:#101010">${esc(r.label)}</td><td class="mu hl" align="right" style="${BODY}padding:10px 0 10px 16px;${i === 0 ? "" : "border-top:1.5px solid #e2e2e2;"}font-size:15px;line-height:22px;color:#5c5c5c">${esc(r.value)}</td></tr>`,
        )
        .join("")
    : `<tr><td class="mu" style="${BODY}padding:10px 0;font-size:15px;line-height:22px;color:#5c5c5c">${esc(s.empty ?? "Nothing to show.")}</td></tr>`;
  return `<div class="tx" style="${LABEL}font-size:12px;line-height:16px;color:#000000;margin:8px 0 2px 0">${esc(s.title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;border-bottom:2px solid #000000;border-top:2px solid #000000" class="ln">${body}</table>`;
}

function button(b: NonNullable<EmailSpec["button"]>): string {
  const url = safeUrl(b.url);
  if (!url) return "";
  // A bulletproof button: the link is the whole yellow pill, so it works with images off and in Outlook.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;border-collapse:separate"><tr><td align="center" style="background:#f9b612;border:2px solid #000000;border-radius:999px"><a href="${esc(url)}" style="${BODY}display:inline-block;padding:14px 28px;font-size:16px;line-height:20px;font-weight:700;color:#000000;text-decoration:none">${esc(b.label)}</a></td></tr></table>`;
}

export function renderEmailHtml(spec: EmailSpec, appUrl: string | undefined): string {
  const base = (appUrl ?? "").replace(/\/+$/, "");
  const img = (file: string, cls: string, extra: string) =>
    base
      ? `<img class="${cls}" src="${esc(base)}/brand/${file}" width="52" height="59" alt="Innovatio Team Tracker" style="display:block;border:0;outline:none;text-decoration:none;${extra}">`
      : "";
  const logo = base
    ? `${img("email-mark.png", "lg-light", "")}${img("email-mark-dark.png", "lg-dark", "display:none;max-height:0;overflow:hidden;mso-hide:all;")}`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(spec.heading)}</title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:separate; border-spacing:0; }
  img { -ms-interpolation-mode:bicubic; }
  a { color:#000000; }
  @media only screen and (max-width: 520px) {
    .wrap { padding:16px 12px 24px 12px !important; }
    .pad { padding:20px 18px 8px 18px !important; }
  }
  @media (prefers-color-scheme: dark) {
    body, .pg { background:#0d0d0d !important; }
    .card { background:#181818 !important; border-color:#f6f6f6 !important; }
    .tx { color:#ececec !important; }
    .mu { color:#a8a8a8 !important; }
    .hd { color:#ffffff !important; }
    .ln { border-color:#f6f6f6 !important; }
    .hl { border-color:#303030 !important; }
    .sunk { background:#222222 !important; }
    .sunk .tx, .sunk div { color:#ffffff !important; }
    .lg-light { display:none !important; }
    .lg-dark { display:block !important; max-height:none !important; overflow:visible !important; }
    a.link { color:#ffffff !important; }
  }
</style>
</head>
<body class="pg" style="margin:0;padding:0;background:#f6f6f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${esc(spec.preheader)}${"&nbsp;&zwnj;".repeat(40)}</div>
<table role="presentation" class="pg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f6">
<tr><td align="center" class="wrap" style="padding:28px 16px 40px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border-collapse:separate;border-spacing:0">
    <tr><td style="padding:0 4px 20px 4px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle" style="padding-right:12px">${logo}</td>
        <td valign="middle"><div class="hd" style="${BODY}font-size:15px;line-height:18px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#000000">Innovatio</div><div class="mu" style="${LABEL}font-size:12px;line-height:18px;color:#5c5c5c">Team Tracker</div></td>
      </tr></table>
    </td></tr>
    <tr><td class="card ln" style="background:#ffffff;border:3px solid #000000;border-radius:16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="pad" style="padding:28px 26px 12px 26px">
        <h1 class="hd" style="${HEAD}margin:0 0 20px 0;font-size:28px;line-height:32px;letter-spacing:-0.01em;color:#000000">${esc(spec.heading)}</h1>
        ${paragraphs(spec.intro)}${spec.hero ? hero(spec.hero) : ""}${spec.code ? code(spec.code) : ""}${spec.steps?.length ? steps(spec.steps) : ""}${(spec.sections ?? []).map(section).join("")}${paragraphs(spec.outro)}${spec.button ? button(spec.button) : ""}
        <div style="height:16px;line-height:16px;font-size:16px">&nbsp;</div>
      </td></tr></table>
    </td></tr>
    <tr><td class="mu" style="${BODY}padding:18px 8px 0 8px;font-size:13px;line-height:19px;color:#5c5c5c;text-align:center">${esc(spec.footer ?? "Sent by Innovatio Team Tracker. Your to-dos and goals stay private to you.")}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
