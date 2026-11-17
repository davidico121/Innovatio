import { sendEmail, sendPush } from "./notify";
import { renderEmailHtml } from "./emailTemplate";

/** The email service allows about two requests a second, so emails go out a little slower than that. */
const EMAIL_GAP_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Recipient = { id: number; name: string; email: string };
export type Delivery = { pushMembers: number; pushDevices: number; emailed: number; emailFailed: number };

async function sendOneEmail(to: string, subject: string, text: string, html: string) {
  try {
    await sendEmail(to, subject, text, html);
  } catch (err) {
    // One retry if the email service says slow down.
    if (!String((err as Error).message).includes("429")) throw err;
    await sleep(1500);
    await sendEmail(to, subject, text, html);
  }
}

/**
 * Sends one message to a list of members: a notification to each of their devices, and optionally an
 * email as well. A failure for one member never stops the others. Used by the Broadcast page and when
 * the admin tells the team about a new resource.
 *
 * `path` is where the notification and the email button open, for example "/" or "/resources".
 */
export async function deliverToMembers(
  members: Recipient[],
  opts: { title: string; message: string; path: string; email: boolean; buttonLabel?: string },
): Promise<Delivery> {
  const app = process.env.APP_URL;
  const link = app ? new URL(opts.path, app).toString() : undefined;
  let pushDevices = 0;
  let pushMembers = 0;
  let emailed = 0;
  let emailFailed = 0;

  for (const m of members) {
    try {
      const reached = await sendPush(m.id, opts.title, opts.message, opts.path);
      pushDevices += reached;
      if (reached > 0) pushMembers++;
    } catch (err) {
      console.error(`team push failed for member ${m.id}`, err);
    }
  }

  if (opts.email) {
    for (const [i, m] of members.entries()) {
      if (i > 0) await sleep(EMAIL_GAP_MS);
      const first = m.name.split(" ")[0];
      try {
        await sendOneEmail(
          m.email,
          opts.title,
          `Hi ${first},\n\n${opts.message}\n\n${link ?? ""}`.trim(),
          renderEmailHtml(
            {
              preheader: opts.message.slice(0, 110),
              heading: opts.title,
              intro: [`Hi ${first},`, ...opts.message.split(/\n{2,}/)],
              button: link ? { label: opts.buttonLabel ?? "Open the app", url: link } : undefined,
              footer: "A message from your team. Sent by Innovatio Team Tracker.",
            },
            app,
          ),
        );
        emailed++;
      } catch (err) {
        emailFailed++;
        console.error(`team email failed for member ${m.id}`, err);
      }
    }
  }
  return { pushMembers, pushDevices, emailed, emailFailed };
}
