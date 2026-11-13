import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { BrandHero } from "../ui/BrandBar";
import PasswordField from "../ui/PasswordField";

export const dynamic = "force-dynamic";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await currentSession();
  if (!s) redirect("/login");
  if (!s.mustSetup) redirect("/");
  const { error } = await searchParams;

  return (
    <main id="main" className="page narrow stack">
      <BrandHero>
        <h1>Welcome, {s.name.split(" ")[0]}</h1>
        <p className="muted">One last step. Choose your own password, and this account is yours.</p>
      </BrandHero>
      <form action="/api/auth/setup" method="post" className="card stack tight">
        <p className="muted">You will sign in with {s.email} and this password.</p>
        <PasswordField name="password" label="New password" autoComplete="new-password" required minLength={10} />
        <PasswordField name="confirm" label="Type it again" autoComplete="new-password" required minLength={10} />
        <p className="muted small">At least 10 characters. A few random words is a good way to make one you can remember.</p>
        <button type="submit" className="btn">Save and continue</button>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
    </main>
  );
}
