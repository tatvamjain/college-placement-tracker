import Link from "next/link";

import type { DriveSummary } from "@/lib/api";
import type { Headline } from "@/lib/headlines";

import { Flaps } from "./Flaps";
import { TimeAgo } from "./TimeAgo";

const KIND_LABEL: Record<Headline["kind"], string> = {
  update: "Announcement",
  results: "Results",
};

export function Headlines({
  seasonLabel,
  items,
  boarding,
}: {
  seasonLabel: string;
  items: Headline[];
  boarding: DriveSummary[];
}) {
  const [lead, ...rest] = items;

  return (
    <div className="news">
      <div className="news-top">
        <p className="kicker">
          <span className="live-dot" aria-hidden />
          Season {seasonLabel} · Live
        </p>
        {boarding.length > 0 && (
          <div className="news-boarding" aria-label="Companies hiring on campus now">
            <span className="news-boarding-label">ONGOING NOW</span>
            {boarding.map((d) => (
              <Link key={d.id} href={`/drives/${d.id}`} className="news-gate">
                {d.company.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <h1 className="news-title">
        <Flaps text="HEADLINES" />
      </h1>

      {lead ? (
        <>
          <Link href={`/drives/${lead.driveId}`} className={`news-lead kind-${lead.kind}`}>
            <span className="news-meta">
              <span className="news-kind">{KIND_LABEL[lead.kind]}</span>
              <span className="news-company">{lead.company}</span>
              <span className="news-time">
                <TimeAgo iso={lead.at} />
              </span>
            </span>
            <span className="news-lead-text">{lead.text}</span>
            <span className="news-more">OPEN {lead.company.toUpperCase()} →</span>
          </Link>

          {rest.length > 0 && (
            <ol className="news-list">
              {rest.map((h) => (
                <li key={h.key}>
                  <Link href={`/drives/${h.driveId}`} className={`news-item kind-${h.kind}`}>
                    <span className="news-time">
                      <TimeAgo iso={h.at} />
                    </span>
                    <span className="news-item-body">
                      <span className="news-company">
                        {h.company}
                        {h.kind === "results" && <span className="news-badge">RESULTS</span>}
                      </span>
                      <span className="news-item-text">{h.text}</span>
                    </span>
                    <span className="news-arrow" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <div className="news-empty">
          <p className="news-lead-text">No announcements yet.</p>
          <p className="news-empty-hint">
            Announcements and results from the placement cell show up here the moment they&apos;re posted.
          </p>
        </div>
      )}
    </div>
  );
}
