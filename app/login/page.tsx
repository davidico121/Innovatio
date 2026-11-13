import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { BrandHero } from "../ui/BrandBar";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <main id="main" className="page narrow stack">
      <div className="deco-asterisk" aria-hidden />
      <BrandHero>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to log your work and see how far you have come.</p>
      </BrandHero>
      <form action="/api/auth/login" method="post" className="card stack tight">
        <label className="label">
          Email
          <input name="email" type="email" required autoComplete="username" className="field" />
        </label>
        <label className="label">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="field" />
        </label>
        <button type="submit" className="btn">Sign in</button>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
      <p className="muted small center">
        First time here? Use the temporary password from your invite email. Forgotten your password? Ask your manager to send a new invite.
      </p>
    </main>
  );
}
