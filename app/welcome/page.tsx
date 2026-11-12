import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await currentSession();
  if (!s) redirect("/login");
  if (!s.mustSetup) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="app stack" style={{ maxWidth: 420, margin: "40px auto 0" }}>
      <header>
        <h1>Welcome, {s.name.split(" ")[0]}</h1>
        <p className="muted">One last step. Choose your own password, and this account is yours.</p>
      </header>
      <form action="/api/auth/setup" method="post" className="card stack" style={{ gap: 12 }}>
        <p className="muted">You will sign in with {s.email} and this password.</p>
        <label>
          New password
          <input name="password" type="password" required minLength={10} autoComplete="new-password" className="field" style={{ marginTop: 6 }} />
        </label>
        <label>
          Type it again
          <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="field" style={{ marginTop: 6 }} />
        </label>
        <p className="muted" style={{ fontSize: "0.85rem" }}>At least 10 characters. A few random words is a good way to make one you can remember.</p>
        <button type="submit" className="btn">Save and continue</button>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
    </main>
  );
}
