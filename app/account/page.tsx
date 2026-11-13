import { redirect } from "next/navigation";
import Link from "next/link";
import { currentSession } from "@/lib/auth";
import { BrandBar } from "../ui/BrandBar";
import PasswordField from "../ui/PasswordField";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await currentSession();
  if (!s) redirect("/login");
  if (s.mustSetup) redirect("/welcome");
  const { error, ok } = await searchParams;

  return (
    <main id="main" className="page narrow stack">
      <BrandBar>
        <Link href="/" className="navlink">Back</Link>
      </BrandBar>
      <header>
        <h1>Your account</h1>
        <p className="muted">{s.name}, {s.email}</p>
      </header>
      <form action="/api/auth/password" method="post" className="card stack tight">
        <h2 style={{ marginBottom: 0 }}>Change your password</h2>
        <PasswordField name="current" autoComplete="current-password" placeholder="Current password" ariaLabel="Current password" required />
        <PasswordField name="password" autoComplete="new-password" placeholder="New password, 10 or more characters" ariaLabel="New password" required minLength={10} />
        <PasswordField name="confirm" autoComplete="new-password" placeholder="New password again" ariaLabel="New password again" required minLength={10} />
        <button type="submit" className="btn">Change password</button>
        {ok && <p className="win" role="status">{ok}</p>}
        {error && <p className="err" role="alert">{error}</p>}
      </form>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="btn secondary block">Sign out</button>
      </form>
    </main>
  );
}
