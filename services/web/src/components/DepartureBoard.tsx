import Link from "next/link";

import type { DriveSummary } from "@/lib/api";
import { formatDay, formatLPA, formatStipend } from "@/lib/format";
import { selectedCount, topCtc } from "@/lib/offers";

import { Flaps } from "./Flaps";
import { DriveStatusTag } from "./StatusTag";

function headline(drive: DriveSummary): string {
  const ctc = topCtc(drive);
  if (ctc !== null) return formatLPA(ctc);
  const stipends = drive.roles.map((r) => r.stipend_inr).filter((s): s is number => s !== null);
  return stipends.length > 0 ? formatStipend(Math.max(...stipends)) : "—";
}

export function DepartureBoard({ drives }: { drives: DriveSummary[] }) {
  return (
    <>
      <div className="board">
        <div className="board-head" aria-hidden>
          <span>DATE</span>
          <span>COMPANY</span>
          <span>ROLES</span>
          <span>TOP PACKAGE</span>
          <span>PLACED</span>
          <span>STATUS</span>
        </div>

        {drives.length === 0 ? (
          <div className="board-empty">
            <Flaps text="NO DRIVES YET" />
            <p className="board-note">The first company will show up here as soon as it&apos;s announced.</p>
          </div>
        ) : (
          drives.map((drive, row) => {
            const placed = selectedCount(drive);
            const day = drive.visit_date ? formatDay(drive.visit_date) : "TBA";
            const money = headline(drive);
            return (
              <Link
                key={drive.id}
                href={`/drives/${drive.id}`}
                className={`board-row${drive.status === "cancelled" ? " is-cancelled" : ""}`}
              >
                <span className="date">{day}</span>
                <span className="company">
                  <Flaps text={drive.company.name} width={14} delay={row * 70} />
                </span>
                <span className="roles">{drive.roles.map((r) => r.title).join(" · ")}</span>
                <span className="ctc">{money}</span>
                <span className="sel">{placed > 0 ? <b>{placed}</b> : "—"}</span>
                <span className="status">
                  <DriveStatusTag status={drive.status} />
                  <span className="go" aria-hidden>
                    →
                  </span>
                </span>
                <span className="mobile-meta">
                  {day} · <b>{money}</b>
                  {placed > 0 ? ` · ${placed} placed` : ""}
                </span>
              </Link>
            );
          })
        )}
      </div>
      <p className="board-note">
        SCHEDULED = ANNOUNCED · BOARDING = ROUNDS IN PROGRESS · DEPARTED = RESULTS OUT
      </p>
    </>
  );
}
