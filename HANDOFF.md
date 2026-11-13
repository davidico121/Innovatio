# Handoff

Notes for whoever works on this next, human or Claude. Read this first.

## What this is

A team accountability app that is meant to feel like a supportive friend, not surveillance. Members log daily work against targets, see a streak and week view, keep private to-dos and monthly goals, and get encouraging notifications and emails. The owner sees consistency, proof and who needs a nudge from `/admin`.

Stack: Next.js 15 App Router PWA, Postgres on Neon, `web-push` for notifications, Resend for email. All dates use Africa/Lagos time (`lib/lagos.ts`).

## How it is deployed

- App: Vercel, deploys from `main`. A push to `main` goes live, so use a branch and a preview for anything risky.
- Database: Neon, using the pooled connection string (host contains `-pooler`).
- Scheduled reminders: GitHub Actions (`.github/workflows/reminders.yml`) calls `/api/cron/reminders?kind=...` with a bearer secret. Needs two repository secrets, `APP_URL` and `CRON_SECRET`.
- Environment variables are listed in `.env.example`. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is public on purpose. `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `ADMIN_TOKEN`, `RESEND_API_KEY` and `DATABASE_URL` are secrets. A new `NEXT_PUBLIC_` value only takes effect after a redeploy.
- `schema.sql` is safe to run again on an existing database. Run it in Neon's SQL Editor after any schema change.

## Concepts

- **IPA**: a named set of daily targets for a role (for example, "Email outreach IPA" at 500 emails a day). Each member has one IPA. Each IPA can include weekends or not (`counts_weekends`) and can have an uploaded document.
- **Work type**: one kind of task, like email outreach. IPAs set a daily minimum and whether proof is required per work type. Admins can create new work types from an IPA page.
- **Due day**: a day that counts for a member. Weekends are skipped unless the IPA includes them, and days before the member joined never count. Streaks and consistency skip non-due days.
- **Proof**: a screenshot or a link. Screenshots are re-encoded on the server to 1280px JPEGs (`lib/image.ts`), stored in Postgres, and deleted after 60 days by the `cleanup` job. The entry, count and link are kept.

## Where things live

- `lib/status.ts`: targets, daily progress, consistency report for the admin, flagging rules.
- `lib/stats.ts`: the member dashboard's streak, best streak and week dots.
- `lib/copy.ts`: all encouragement, quotes and milestone wording. Edit tone here.
- `lib/auth.ts`, `lib/password.ts`, `lib/ratelimit.ts`, `lib/invite.ts`: sign-in, sessions, lockout and invites.
- `lib/notify.ts`: push and email sending.
- `app/api/cron/reminders/route.ts`: morning, evening, quote, weekly, digest and cleanup jobs.
- `app/globals.css`: the member-facing styles. The admin pages mostly use inline styles from `lib/ui.ts`.
- Member screens: `app/login`, `app/welcome`, `app/page.tsx`, `app/account`. Admin: `app/admin/...`.

## Decisions worth knowing

- **Sign-in**: email and password. Adding a member emails a one-time temporary password (valid 7 days). They must choose their own password before anything else works. Sessions last 180 days and are stored hashed. After 8 wrong tries an email is locked out for 15 minutes. A forgotten password is handled by the admin pressing "Send a new invite", which also signs the member out everywhere. The old magic-link sign-in was removed on purpose.
- **Admin**: one shared `ADMIN_TOKEN` entered at `/admin`, kept in a cookie for 12 hours. There are no individual admin accounts.
- **Privacy promise**: personal to-dos and goals are private. No admin screen or query may read the `todos` or `goals` tables. Keep it that way, the app tells members it is true.
- **Tone**: encouraging, never guilt. Celebrations fire only for real wins (a target crossed, a day finished, a list finished, a goal reached), once each. A missed day gets a fresh-start message. Quotes are original lines with no attributed names, so nothing is misquoted.
- **Notification rules**: push first. Email is the fallback when no device was reached, and is always sent for streak milestones and the weekly recap. A reminder is recorded as sent only after it succeeds, so failures retry on the next run.
- **No em dashes** in any copy.

## Local development

1. A Postgres database and a `.env.local` based on `.env.example`. Set `PGSSL=false` for a local database.
2. Generate push keys: `npx web-push generate-vapid-keys`.
3. Run `schema.sql`.
4. `npm run dev`. Use `npm run build` and `npm start` to test production behavior.
5. To read emails without sending them, set `RESEND_API_URL` to a small local server that logs request bodies.
6. Test cron jobs with `curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/reminders?kind=morning"`. Add `&force=1` to run `weekly` on a day that is not Monday.

Gotchas: restart the server after changing `.env.local`. After deleting a route, remove `.next` or typecheck reports stale errors.

## Open items

- A deactivate-member button in admin. The `active` flag works in the database, and deactivated members' sessions already stop working.
- Self-service forgot-password. Today the admin resets it.
- The real daily targets for the other IPAs, and their documents.
- A streak freeze (one forgiven miss a month), only if people quit after a first miss.
- Screenshots are stored in Postgres. Move them to file storage if the team grows past about 10 members.
- Emails are plain text. Branded HTML versions would be a nice follow-up.
