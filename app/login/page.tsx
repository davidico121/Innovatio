import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession, isAdmin } from "@/lib/auth";
import { BrandHero } from "../ui/BrandBar";
import PasswordField from "../ui/PasswordField";

export const dynamic = "force-dynamic";

/**
 * One sign-in page for everyone. Team members use their email and password. Managers follow the
 * "Admin" link, which shows the admin form on this same page (/login?as=admin).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; as?: string }> }) {
  const { error, as } = await searchParams;
  const admin = as === "admin";

  // Already signed in to the side being asked for: go straight in. A team member who is signed in can
  // still open the admin form here, and an admin who is signed in can still open the team form.
  if (admin ? await isAdmin() : await currentSession()) redirect(admin ? "/admin" : "/");

  if (admin) {
    return (
      <main id="main" className="page narrow stack">
        <BrandHero>
          <h1>Admin sign in</h1>
          <p className="muted">For managers. Enter your username, password and admin token.</p>
        </BrandHero>
        <form action="/api/admin/login" method="post" className="card stack tight">
          <label className="label">
            Username
            <input name="username" type="text" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="field" />
          </label>
          <PasswordField name="password" label="Password" autoComplete="current-password" required />
          <PasswordField name="token" label="Admin token" autoComplete="off" required />
          <button type="submit" className="btn">Sign in as admin</button>
          {error && <p className="err" role="alert">{error}</p>}
        </form>
        <p className="muted small center">
          Not an admin? <Link href="/login">Back to team sign in</Link>
        </p>
      </main>
    );
  }

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
      <p className="small center">
        <Link href="/login?as=admin">Admin? Sign in here</Link>
      </p>
    </main>
  );
}
