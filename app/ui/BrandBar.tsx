import Link from "next/link";
import type { ReactNode } from "react";

/** The logo mark and wordmark. Pass links for the right-hand side, such as the account link. */
export function BrandBar({ sub = "Team Tracker", home = "/", children }: { sub?: string; home?: string; children?: ReactNode }) {
  return (
    <div className="brandbar">
      <Link href={home} className="brandlink" aria-label="Innovatio Team Tracker, home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.png" alt="" width={44} height={47} className="mark" />
        <span className="wordmark">
          <b>Innovatio</b>
          <span>{sub}</span>
        </span>
      </Link>
      {children ? <nav aria-label="Main">{children}</nav> : null}
    </div>
  );
}

/** Big logo block for the sign-in screens. */
export function BrandHero({ children }: { children: ReactNode }) {
  return (
    <header className="intro">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="" width={72} height={77} className="mark big" />
      <p className="eyebrow muted">Innovatio Team Tracker</p>
      {children}
    </header>
  );
}

export function AdminBar({ current }: { current: "team" | "ipas" }) {
  return (
    <BrandBar sub="Admin" home="/admin">
      <Link href="/admin" className="navlink" aria-current={current === "team" ? "page" : undefined}>Team</Link>
      <Link href="/admin/ipas" className="navlink" aria-current={current === "ipas" ? "page" : undefined}>IPAs</Link>
    </BrandBar>
  );
}
