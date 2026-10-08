import Link from "next/link";
import { Suspense } from "react";

import { api } from "@/lib/api";
import { formatLPA } from "@/lib/format";

export const metadata = { title: "Archive" };

async function SeasonList() {
  const seasons = (await api.seasons()) ?? [];
  const stats = await Promise.all(seasons.map((s) => api.seasonStats(s.label)));

  return (
    <div className="seasons-grid">
      {seasons.map((season, i) => {
        const s = stats[i];
        const href = season.status === "active" ? "/" : `/seasons/${season.label}`;
        return (
          <Link key={season.label} href={href} className="season-card">
            <p className="kicker">
              {season.status === "active" && <span className="live-dot" aria-hidden />}
              {season.status === "active" ? "Live season" : "Archive"}
            </p>
            <p className="label">{season.label}</p>
            <div className="mini">
              <div>
                <span className="kicker">Companies</span>
                <b>{s?.companies ?? 0}</b>
              </div>
              <div>
                <span className="kicker">Offers</span>
                <b>{s?.fte_offers ?? 0}</b>
              </div>
              <div>
                <span className="kicker">Median</span>
                <b>{formatLPA(s?.median_ctc_inr ?? null)}</b>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function SeasonsPage() {
  return (
    <>
      <section className="today-hero">
        <p className="kicker">Every season on record</p>
        <h1 className="today-title">
          The <span>archive</span>
        </h1>
      </section>
      <Suspense
        fallback={<div className="skeleton" style={{ height: 240, marginBottom: 60 }} aria-busy="true" />}
      >
        <SeasonList />
      </Suspense>
    </>
  );
}
