import type { Round } from "@/lib/api";
import { formatDay, ROUND_CODES, ROUND_NAMES } from "@/lib/format";

// The selection process drawn as a metro line: each round is a stop.
export function RouteLine({ rounds }: { rounds: Round[] }) {
  if (rounds.length === 0) {
    return (
      <div className="route">
        <p className="kicker">Route not announced</p>
        <p style={{ marginTop: 8, color: "var(--muted)" }}>
          Rounds appear here once the placement cell shares the schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="route">
      <ol className="route-track">
        {rounds.map((round) => {
          const state =
            round.status === "completed" ? " is-done" : round.status === "ongoing" ? " is-live" : "";
          return (
            <li key={round.round_order} className={`stop${state}`}>
              <span className="stop-node" aria-hidden />
              <p className="stop-code">
                STOP {round.round_order} · {ROUND_CODES[round.round_type]}
              </p>
              <p className="stop-name">{ROUND_NAMES[round.round_type]}</p>
              <p className="stop-date">
                {round.scheduled_on ? formatDay(round.scheduled_on) : "DATE TBA"}
                {round.status === "ongoing" && " · NOW"}
              </p>
              {round.shortlisted_count !== null && (
                <p className="stop-count">
                  {round.shortlisted_count}
                  <small>SHORTLISTED</small>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
