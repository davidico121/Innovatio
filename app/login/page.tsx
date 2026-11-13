import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { BrandHero } from "../ui/BrandBar";
import PasswordField from "../ui/PasswordField";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <main id="main" className="page narrow stack">
      <BrandHero>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to log your work and see how far you have come.</p>
      </BrandHero>
      <form action="/api/auth/login" method="post" className="card stack tight">
        <label className="label">
          Email
          <input name="email" type="email" required autoComplete="username" className="field" />
        </label>
        <PasswordField name="password" label="Password" autoComplete="current-password" required />
        <button type="submit" className="btn">Sign in</button>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
      <p className="muted small center">
        First time here? Use the temporary password from your invite email. Forgotten your password? Ask your manager to send a new invite.
      </p>
    </main>
  );
}
