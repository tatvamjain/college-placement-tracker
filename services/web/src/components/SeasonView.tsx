import { notFound } from "next/navigation";

import { api } from "@/lib/api";
import { formatLPA, lakhs } from "@/lib/format";
import { allHeadlines } from "@/lib/headlines";
import { ctcOffers } from "@/lib/offers";

import { DepartureBoard } from "./DepartureBoard";
import { Headlines } from "./Headlines";
import { OfferDistribution } from "./OfferDistribution";

function caption(placed: number, median: number | null, average: number | null) {
  if (median === null) {
    return <>No full-time results yet. The moment a company announces, the numbers show up here.</>;
  }
  const skewed = average !== null && average > median * 1.25;
  return (
    <>
      Half of the <em>{placed} students placed</em> got <em>₹{lakhs(median)} LPA</em> or less.
      {skewed && (
        <>
          {" "}
          The average says <em>₹{lakhs(average!)} LPA</em>, pulled up by a few big offers.
        </>
      )}
    </>
  );
}

// label === null means "the live season".
export async function SeasonView({ label }: { label: string | null }) {
  const data = label === null ? await api.currentSeason() : await api.season(label);

  if (data === null) {
    if (label !== null) notFound();
    return (
      <section className="notice">
        <p className="kicker">Between seasons</p>
        <h1>No live season</h1>
        <p>Placements haven&apos;t started yet. Past seasons are in the archive.</p>
      </section>
    );
  }

  const { season, drives } = data;
  const stats = await api.seasonStats(season.label);
  const offers = ctcOffers(drives);
  const isLive = season.status === "active";
  const headlines = isLive ? await allHeadlines(data) : [];

  return (
    <>
      <section className={isLive ? "hero hero-live" : "hero"}>
        {isLive ? (
          <Headlines
            seasonLabel={season.label}
            items={headlines.slice(0, 6)}
            total={headlines.length}
            boarding={drives.filter((d) => d.status === "ongoing")}
          />
        ) : (
          <div>
            <p className="kicker">Season {season.label} · Archive</p>
            <div className="hero-figure" aria-label={`Median package ${formatLPA(stats?.median_ctc_inr ?? null)}`}>
              <span className="rupee">₹</span>
              <span className="value">{stats?.median_ctc_inr != null ? lakhs(stats.median_ctc_inr) : "—"}</span>
              <span className="unit">LPA · MEDIAN</span>
            </div>
            <p className="hero-caption">
              {caption(stats?.fte_offers ?? 0, stats?.median_ctc_inr ?? null, stats?.average_ctc_inr ?? null)}
            </p>
          </div>
        )}

        <div className="readouts">
          {isLive && (
            <div className="readout accent">
              <p className="kicker">Median</p>
              <p className="num">{formatLPA(stats?.median_ctc_inr ?? null)}</p>
            </div>
          )}
          <div className="readout">
            <p className="kicker">Companies</p>
            <p className="num">{stats?.companies ?? 0}</p>
          </div>
          <div className="readout">
            <p className="kicker">Full-time</p>
            <p className="num">
              {stats?.fte_offers ?? 0}
              <small>offers</small>
            </p>
          </div>
          <div className={isLive ? "readout" : "readout accent"}>
            <p className="kicker">Highest</p>
            <p className="num">{formatLPA(stats?.highest_ctc_inr ?? null)}</p>
          </div>
          <div className="readout">
            <p className="kicker">Average</p>
            <p className="num">{formatLPA(stats?.average_ctc_inr ?? null)}</p>
          </div>
          <div className="readout">
            <p className="kicker">Internships</p>
            <p className="num">{stats?.intern_offers ?? 0}</p>
          </div>
          {!isLive && (
            <div className="readout">
              <p className="kicker">Drives</p>
              <p className="num">{drives.length}</p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">How packages are spread</h2>
          <span className="kicker">Every offer with a CTC · per student</span>
        </div>
        <OfferDistribution offers={offers} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">All drives</h2>
          <span className="kicker">{drives.length} drives · tap one for details</span>
        </div>
        <DepartureBoard drives={drives} />
      </section>
    </>
  );
}

export function SeasonSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading season">
      <div className="hero">
        <div>
          <div className="skeleton" style={{ height: 14, width: 180 }} />
          <div className="skeleton" style={{ height: 150, width: "70%", marginTop: 22 }} />
          <div className="skeleton" style={{ height: 50, width: "80%", marginTop: 18 }} />
        </div>
        <div className="skeleton" style={{ height: 300 }} />
      </div>
      <div className="skeleton" style={{ height: 260, marginTop: 30 }} />
      <div className="skeleton" style={{ height: 380, marginTop: 30 }} />
    </div>
  );
}
