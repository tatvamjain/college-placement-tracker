import Link from "next/link";

import { Clock } from "./Clock";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell">
        <Link href="/" className="brand" aria-label="Placement Board home">
          <span className="brand-mark" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="brand-text">PLACEMENT BOARD</span>
        </Link>
        <nav className="nav">
          <Link href="/">LIVE</Link>
          <Link href="/today">TODAY</Link>
          <Link href="/seasons">ARCHIVE</Link>
        </nav>
        <Clock />
      </div>
    </header>
  );
}
