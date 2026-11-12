import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await currentSession();
  if (!s) redirect("/login");
  if (s.mustSetup) redirect("/welcome");
  const { error, ok } = await searchParams;

  return (
    <main className="app stack" style={{ maxWidth: 420, margin: "24px auto 0" }}>
      <p><Link href="/">&larr; Back</Link></p>
      <header>
        <h1>Your account</h1>
        <p className="muted">{s.name}, {s.email}</p>
      </header>
      <form action="/api/auth/password" method="post" className="card stack" style={{ gap: 12 }}>
        <h2 style={{ margin: 0 }}>Change your password</h2>
        <input name="current" type="password" required autoComplete="current-password" placeholder="Current password" className="field" aria-label="Current password" />
        <input name="password" type="password" required minLength={10} autoComplete="new-password" placeholder="New password, 10 or more characters" className="field" aria-label="New password" />
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" placeholder="New password again" className="field" aria-label="New password again" />
        <button type="submit" className="btn">Change password</button>
        {ok && <p className="win" role="status">{ok}</p>}
        {error && <p className="err" role="alert">{error}</p>}
      </form>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="btn ghost">Sign out</button>
      </form>
    </main>
  );
}
