import Link from "next/link";
import { Suspense } from "react";

import { Flaps } from "@/components/Flaps";
import { RoundStatusTag } from "@/components/StatusTag";
import { api } from "@/lib/api";
import { formatLongDay, ROUND_CODES, ROUND_NAMES } from "@/lib/format";

export const metadata = { title: "Today" };

async function TodayBoard() {
  const today = await api.today();
  const rounds = today?.rounds ?? [];
  const live = rounds.filter((r) => r.status === "ongoing").length;

  return (
    <>
      <section className="today-hero">
        <p className="kicker">
          {live > 0 && <span className="live-dot" aria-hidden />}
          {live > 0 ? `${live} boarding now` : "Today's schedule"}
        </p>
        <h1 className="today-title">
          Today&apos;s <span>departures</span>
        </h1>
        {today && <p className="today-date">{formatLongDay(today.day)}</p>}
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="board today-board">
          <div className="board-head" aria-hidden>
            <span>GATE</span>
            <span>COMPANY</span>
            <span>ROUND</span>
            <span>STATUS</span>
          </div>
          {rounds.length === 0 ? (
            <div className="board-empty">
              <Flaps text="NO DEPARTURES TODAY" />
              <p className="board-note">No rounds are scheduled for today. Check the live board for what&apos;s next.</p>
            </div>
          ) : (
            rounds.map((round, row) => (
              <Link
                key={`${round.drive_id}-${round.round_order}`}
                href={`/drives/${round.drive_id}`}
                className="board-row"
              >
                <span className="gate">R{round.round_order}</span>
                <span className="company">
                  <Flaps text={round.company} width={14} delay={row * 90} />
                </span>
                <span className="round-name">
                  {ROUND_NAMES[round.round_type]}
                  <small>
                    ROUND {round.round_order} · {ROUND_CODES[round.round_type]}
                  </small>
                </span>
                <span className="status">
                  <RoundStatusTag status={round.status} />
                  <span className="go" aria-hidden>
                    →
                  </span>
                </span>
                <span className="mobile-meta">
                  Round {round.round_order} · <b>{ROUND_NAMES[round.round_type]}</b>
                </span>
              </Link>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function TodaySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading today">
      <div className="skeleton" style={{ height: 120, width: "70%", marginTop: 56 }} />
      <div className="skeleton" style={{ height: 320, marginTop: 40 }} />
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayBoard />
    </Suspense>
  );
}
