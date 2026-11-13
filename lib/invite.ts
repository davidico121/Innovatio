import { pool } from "./db";
import { revokeSessions } from "./auth";
import { generateTempPassword, hashPassword } from "./password";
import { sendEmail } from "./notify";
import { renderEmailHtml } from "./emailTemplate";

export const TEMP_PASSWORD_DAYS = 7;

/**
 * Gives the member a new one-time temporary password and emails it. Used for the first
 * invite and for resets. Any sessions they already have are signed out.
 */
export async function sendInvite(memberId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const { rows } = await pool.query(`select name, email from members where id = $1 and active`, [memberId]);
  const m = rows[0];
  if (!m) return { ok: false, error: "Member not found" };

  const temp = generateTempPassword();
  await pool.query(
    `update members
        set password_hash = $2, must_setup = true, invited_at = now(),
            temp_expires_at = now() + make_interval(days => $3)
      where id = $1`,
    [memberId, await hashPassword(temp), TEMP_PASSWORD_DAYS],
  );
  await revokeSessions(memberId);

  const first = String(m.name).split(" ")[0];
  const app = process.env.APP_URL;
  try {
    await sendEmail(
      m.email,
      "Welcome, set up your account",
      [
        `Hi ${first},`,
        "",
        "You have been added to the team tracker. Here is how to get started.",
        "",
        `1. Open ${app}/login`,
        `2. Sign in with your email (${m.email}) and this temporary password:`,
        "",
        `   ${temp}`,
        "",
        "3. Choose your own password.",
        "",
        `The temporary password works once and expires in ${TEMP_PASSWORD_DAYS} days. If it expires, ask your manager to send a new one.`,
        "",
        "Tip: open the link on your phone and add it to your home screen (on iPhone: Share, then Add to Home Screen). Then turn on reminders so the app can cheer you on.",
      ].join("\n"),
      renderEmailHtml(
        {
          preheader: "Your temporary password is inside. It takes a minute to set up.",
          heading: "Welcome to the team",
          intro: [`Hi ${first},`, "You have been added to the team tracker. Here is how to get started."],
          steps: [`Open the sign-in page.`, `Sign in with your email (${m.email}) and the temporary password below.`, "Choose your own password."],
          code: { label: "Your temporary password", value: temp },
          outro: [
            `The temporary password works once and expires in ${TEMP_PASSWORD_DAYS} days. If it expires, ask your manager to send a new one.`,
            "Tip: open the link on your phone and add it to your home screen (on iPhone: Share, then Add to Home Screen). Then turn on reminders so the app can cheer you on.",
          ],
          button: app ? { label: "Open the sign-in page", url: `${app}/login` } : undefined,
        },
        app,
      ),
    );
  } catch (err) {
    console.error(`invite email failed for member ${memberId}`, err);
    // Nobody has seen this password, so drop it and let the admin page show "Not invited yet".
    await pool.query(
      `update members set password_hash = null, temp_expires_at = null, invited_at = null where id = $1`,
      [memberId],
    );
    return { ok: false, error: "The email could not be sent. Check your Resend setup, then send the invite again." };
  }
  return { ok: true };
}
