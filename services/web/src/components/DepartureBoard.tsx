"use client";

import Link from "next/link";
import { useState } from "react";

import type { DriveSummary } from "@/lib/api";
import { formatDay, formatLPA, formatStipend } from "@/lib/format";
import { selectedCount, topCtc } from "@/lib/offers";

import { Flaps } from "./Flaps";
import { DriveStatusTag } from "./StatusTag";

type Filter = "all" | "fte" | "intern" | "ongoing" | "upcoming" | "results" | "hold";

const FILTERS: { id: Filter; label: string; test: (d: DriveSummary) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "ongoing", label: "Ongoing", test: (d) => d.status === "ongoing" },
  { id: "upcoming", label: "Upcoming", test: (d) => d.status === "announced" },
  { id: "results", label: "Results out", test: (d) => d.status === "completed" },
  { id: "hold", label: "On hold", test: (d) => d.status === "cancelled" },
  { id: "fte", label: "Full-time", test: (d) => d.roles.some((r) => r.job_type !== "intern") },
  { id: "intern", label: "Internships", test: (d) => d.roles.some((r) => r.job_type !== "fte") },
];

function headline(drive: DriveSummary): string {
  const ctc = topCtc(drive);
  if (ctc !== null) return formatLPA(ctc);
  const stipends = drive.roles.map((r) => r.stipend_inr).filter((s): s is number => s !== null);
  return stipends.length > 0 ? formatStipend(Math.max(...stipends)) : "—";
}

function matches(drive: DriveSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [drive.company.name, drive.company.sector ?? "", ...drive.roles.flatMap((r) => [r.title, r.location ?? ""])]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function DepartureBoard({ drives }: { drives: DriveSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const active = FILTERS.find((f) => f.id === filter)!;
  const shown = drives.filter((d) => active.test(d) && matches(d, query.trim()));
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, drives.filter(f.test).length]));

  return (
    <>
      {drives.length > 0 && (
        <div className="board-tools">
          <label className="board-search">
            <span className="sr-only">Search companies, roles or cities</span>
            <span aria-hidden className="board-search-icon">⌕</span>
            <input
              type="search"
              placeholder="Search company, role or city"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="chips" role="group" aria-label="Filter drives">
            {FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0).map((f) => (
              <button
                key={f.id}
                className={`chip${filter === f.id ? " is-on" : ""}${f.id === "ongoing" ? " chip-live" : ""}`}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className="chip-count">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
        ) : shown.length === 0 ? (
          <div className="board-empty">
            <Flaps text="NO MATCHES" />
            <p className="board-note">
              Nothing matches that.{" "}
              <button
                className="link-btn"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            </p>
          </div>
        ) : (
          shown.map((drive, row) => {
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
    </>
  );
}
