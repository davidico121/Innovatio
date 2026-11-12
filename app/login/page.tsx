import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="app stack" style={{ maxWidth: 420, margin: "40px auto 0" }}>
      <header>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to log your work and see how far you have come.</p>
      </header>
      <form action="/api/auth/login" method="post" className="card stack" style={{ gap: 12 }}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="username" className="field" style={{ marginTop: 6 }} />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" className="field" style={{ marginTop: 6 }} />
        </label>
        <button type="submit" className="btn">Sign in</button>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
      <p className="muted" style={{ textAlign: "center", fontSize: "0.85rem" }}>
        First time here? Use the temporary password from your invite email. Forgotten your password? Ask your manager to send a new invite.
      </p>
    </main>
  );
}
