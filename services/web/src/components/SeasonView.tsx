import { notFound } from "next/navigation";

import { api } from "@/lib/api";
import { formatLPA, lakhs } from "@/lib/format";
import { fteOffers } from "@/lib/offers";

import { DepartureBoard } from "./DepartureBoard";
import { OfferDistribution } from "./OfferDistribution";

function caption(placed: number, median: number | null, average: number | null) {
  if (median === null) {
    return <>No full-time results yet. The moment a company announces, the numbers land here.</>;
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
  const offers = fteOffers(drives);
  const isLive = season.status === "active";

  return (
    <>
      <section className="hero">
        <div>
          <p className="kicker">
            {isLive && <span className="live-dot" aria-hidden />}
            Season {season.label} · {isLive ? "Live" : "Archive"}
          </p>
          <div className="hero-figure" aria-label={`Median package ${formatLPA(stats?.median_ctc_inr ?? null)}`}>
            <span className="rupee">₹</span>
            <span className="value">{stats?.median_ctc_inr != null ? lakhs(stats.median_ctc_inr) : "—"}</span>
            <span className="unit">LPA · MEDIAN</span>
          </div>
          <p className="hero-caption">
            {caption(stats?.fte_offers ?? 0, stats?.median_ctc_inr ?? null, stats?.average_ctc_inr ?? null)}
          </p>
        </div>

        <div className="readouts">
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
          <div className="readout accent">
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
          <div className="readout">
            <p className="kicker">Drives</p>
            <p className="num">{drives.length}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Where the offers landed</h2>
          <span className="kicker">Full-time · per student</span>
        </div>
        <OfferDistribution
          offers={offers}
          median={stats?.median_ctc_inr ?? null}
          average={stats?.average_ctc_inr ?? null}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Departures</h2>
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
