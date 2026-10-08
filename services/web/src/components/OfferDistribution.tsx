"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { lakhs } from "@/lib/format";
import type { OfferGroup } from "@/lib/offers";

const PLOT_HEIGHT = 210;
const AXIS_HEIGHT = 34;
const LABEL_SPACE = 40;
const COLUMN_PX = 12;

function niceMax(value: number): number {
  const steps = [5, 10, 20, 25, 50, 100, 200];
  const step = steps.find((s) => value / s <= 6) ?? 500;
  return Math.max(step, Math.ceil(value / step) * step);
}

type Bin = { index: number; lakh: number; groups: OfferGroup[]; total: number };

function percentBelow(groups: OfferGroup[], total: number, inr: number) {
  const below = groups.reduce((n, g) => n + (g.ctc_inr < inr ? g.count : 0), 0);
  return { below, pct: Math.round((below / total) * 100) };
}

// One dot per student placed, stacked by package. Hover or tap a column to see who
// got that package; pick a company to light up its offers; drag the slider to see
// where an offer would land.
export function OfferDistribution({
  offers,
  median,
  average,
}: {
  offers: OfferGroup[];
  median: number | null;
  average: number | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(860);
  const [active, setActive] = useState<number | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [probe, setProbe] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = offers.reduce((n, g) => n + g.count, 0);
  const top = offers.length > 0 ? offers[offers.length - 1].ctc_inr : 0;
  const maxL = niceMax(top / 100_000 || 1);

  const companies = useMemo(() => {
    const byName = new Map<string, { name: string; count: number; driveId: number; best: number }>();
    for (const g of offers) {
      const c = byName.get(g.company) ?? { name: g.company, count: 0, driveId: g.driveId, best: 0 };
      c.count += g.count;
      c.best = Math.max(c.best, g.ctc_inr);
      byName.set(g.company, c);
    }
    return [...byName.values()].sort((a, b) => b.count - a.count || b.best - a.best);
  }, [offers]);

  const columns = Math.max(20, Math.floor(width / COLUMN_PX));
  const binWidth = maxL / columns;
  const x = (lakh: number) => (lakh / maxL) * width;

  const bins = useMemo(() => {
    const map = new Map<number, Bin>();
    for (const g of offers) {
      const index = Math.round(g.ctc_inr / 100_000 / binWidth);
      const bin = map.get(index) ?? { index, lakh: index * binWidth, groups: [], total: 0 };
      bin.groups.push(g);
      bin.total += g.count;
      map.set(index, bin);
    }
    return [...map.values()];
  }, [offers, binWidth]);

  if (total === 0) {
    return (
      <div className="dist dist-empty">
        <p className="kicker">No full-time results yet</p>
        <p style={{ marginTop: 8, color: "var(--muted)" }}>
          Every placed student becomes a dot here once results are published.
        </p>
      </div>
    );
  }

  const tallest = Math.max(...bins.map((b) => b.total));
  const step = Math.min(COLUMN_PX, PLOT_HEIGHT / tallest);
  const r = Math.max(1.6, Math.min(4.6, step / 2 - 0.5));
  const baseline = LABEL_SPACE + PLOT_HEIGHT;
  const height = baseline + AXIS_HEIGHT;
  const tickCount = width < 520 ? 2 : 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (i * maxL) / tickCount);

  const activeBin = bins.find((b) => b.index === active) ?? null;
  const probeInr = probe ?? median ?? top;
  const probeStats = percentBelow(offers, total, probeInr);

  const markers = [
    median !== null && { value: median, label: `MEDIAN ₹${lakhs(median)}L`, color: "var(--amber)", y: 12 },
    average !== null && { value: average, label: `AVERAGE ₹${lakhs(average)}L`, color: "var(--sky)", y: 28 },
  ].filter(Boolean) as { value: number; label: string; color: string; y: number }[];

  return (
    <div className="dist">
      <div className="dist-chart">
        <div ref={wrap} className="dist-plot" onPointerLeave={() => setActive(null)}>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Distribution of ${total} full-time offers from ₹${lakhs(offers[0].ctc_inr)} to ₹${lakhs(top)} LPA`}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={LABEL_SPACE} y2={baseline} stroke="var(--line-soft)" />
                <text
                  x={x(t)}
                  y={baseline + 22}
                  textAnchor={t === 0 ? "start" : t === maxL ? "end" : "middle"}
                  className="dist-tick"
                >
                  ₹{Number.isInteger(t) ? t : t.toFixed(1)}L
                </text>
              </g>
            ))}
            <line x1={0} x2={width} y1={baseline} y2={baseline} stroke="var(--line)" />

            {probe !== null && (
              <g className="dist-probe">
                <rect x={0} y={LABEL_SPACE} width={x(probeInr / 100_000)} height={PLOT_HEIGHT} />
                <line x1={x(probeInr / 100_000)} x2={x(probeInr / 100_000)} y1={LABEL_SPACE - 6} y2={baseline} />
              </g>
            )}

            {bins.map((b) => {
              const cx = x(b.lakh);
              let k = 0;
              return (
                <g
                  key={b.index}
                  className={`dist-stack${active === b.index ? " is-active" : ""}${active !== null && active !== b.index ? " is-faded" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`₹${lakhs(b.groups[0].ctc_inr)} LPA: ${b.total} ${b.total === 1 ? "student" : "students"}`}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setActive(b.index)}
                  onClick={() => setActive(b.index)}
                  onFocus={() => setActive(b.index)}
                >
                  <rect
                    className="dist-hit"
                    x={cx - COLUMN_PX / 2}
                    y={LABEL_SPACE}
                    width={COLUMN_PX}
                    height={PLOT_HEIGHT + 4}
                  />
                  {b.groups.flatMap((g) =>
                    Array.from({ length: g.count }, () => {
                      const i = k++;
                      const lit = company === null || company === g.company;
                      return (
                        <circle
                          key={`${g.driveId}-${g.role}-${i}`}
                          cx={cx}
                          cy={baseline - r - 2 - i * step}
                          r={r}
                          className={`dot${g.ctc_inr === top ? " top" : ""}${lit ? "" : " is-dim"}${company === g.company ? " is-picked" : ""}`}
                          style={{ animationDelay: `${Math.min(i * 14, 600) + (b.index % 7) * 20}ms` }}
                        />
                      );
                    }),
                  )}
                </g>
              );
            })}

            {markers.map((m) => {
              const mx = x(m.value / 100_000);
              const anchor = mx > width * 0.7 ? "end" : "start";
              return (
                <g key={m.label} className="dist-marker" pointerEvents="none">
                  <line
                    x1={mx}
                    x2={mx}
                    y1={m.y + 4}
                    y2={baseline}
                    stroke={m.color}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text x={anchor === "start" ? mx + 6 : mx - 6} y={m.y + 8} textAnchor={anchor} fill={m.color}>
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="dist-probe-ctl">
          <label htmlFor="probe" className="kicker">
            Where would your offer land?
          </label>
          <div className="dist-probe-row">
            <input
              id="probe"
              type="range"
              min={0}
              max={maxL}
              step={0.5}
              value={probeInr / 100_000}
              onChange={(e) => setProbe(Number(e.target.value) * 100_000)}
              style={{ ["--fill" as string]: `${(probeInr / 100_000 / maxL) * 100}%` }}
            />
            <output htmlFor="probe" className="dist-probe-out">
              <span>
                <b>₹{lakhs(probeInr)} LPA</b> beats <b>{probeStats.pct}%</b> of offers
              </span>
              <small>
                {probeStats.below} of {total} students got less
              </small>
            </output>
          </div>
        </div>

        <div className="dist-legend">
          <span>● ONE DOT = ONE STUDENT</span>
          <span>
            <i style={{ background: "var(--amber)" }} />
            HALF EARN LESS, HALF MORE
          </span>
          <span>
            <i style={{ background: "var(--sky)" }} />
            PULLED UP BY TOP OFFERS
          </span>
        </div>
      </div>

      <aside className="dist-side" aria-live="polite">
        {activeBin ? (
          <div className="dist-card">
            <p className="kicker">This column</p>
            <p className="dist-card-figure">
              ₹{lakhs(activeBin.groups[0].ctc_inr)}
              {activeBin.groups.some((g) => g.ctc_inr !== activeBin.groups[0].ctc_inr) && "+"} <span>LPA</span>
            </p>
            <p className="dist-card-sub">
              {activeBin.total} {activeBin.total === 1 ? "student" : "students"} ·{" "}
              {percentBelow(offers, total, activeBin.groups[0].ctc_inr).pct}% of offers are lower
            </p>
            <ul className="dist-who">
              {activeBin.groups.map((g) => (
                <li key={`${g.driveId}-${g.role}`}>
                  <Link href={`/drives/${g.driveId}`}>
                    <span>
                      <b>{g.company}</b>
                      <small>
                        {g.role} · ₹{lakhs(g.ctc_inr)} LPA
                      </small>
                    </span>
                    <em>×{g.count}</em>
                  </Link>
                </li>
              ))}
            </ul>
            <button className="link-btn" onClick={() => setActive(null)}>
              ← All recruiters
            </button>
          </div>
        ) : (
          <div className="dist-card">
            <p className="kicker">Biggest recruiters · tap to highlight</p>
            <ul className="dist-recruiters">
              {companies.slice(0, 6).map((c) => (
                <li key={c.name}>
                  <button
                    className={company === c.name ? "is-on" : ""}
                    aria-pressed={company === c.name}
                    onClick={() => setCompany((cur) => (cur === c.name ? null : c.name))}
                  >
                    <span className="dist-rec-name">
                      {c.name}
                      <small>up to ₹{lakhs(c.best)}L</small>
                    </span>
                    <span className="dist-rec-bar">
                      <i style={{ width: `${(c.count / companies[0].count) * 100}%` }} />
                    </span>
                    <span className="dist-rec-count">{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="dist-hint">
              {company ? (
                <button className="link-btn" onClick={() => setCompany(null)}>
                  Show everyone
                </button>
              ) : (
                "Hover or tap a column to see who got that package."
              )}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
