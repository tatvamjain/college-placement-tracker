"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { DriveDetail, DriveStatus, Role, Round, RoundStatus } from "@/lib/api";
import { admin } from "@/lib/client";
import {
  DRIVE_BOARD_STATUS,
  formatLPA,
  formatStipend,
  formatTimestamp,
  JOB_TYPE_LABELS,
  ROUND_BOARD_STATUS,
  ROUND_CODES,
  ROUND_NAMES,
} from "@/lib/format";

import type { Notify } from "./ControlTower";

const DRIVE_STATUSES: DriveStatus[] = ["announced", "ongoing", "completed", "cancelled"];
const ROUND_STATUSES: RoundStatus[] = ["scheduled", "ongoing", "completed"];
const MAX_UPDATE = 2000;

function Segmented<T extends string>({
  value,
  options,
  label,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string; tone: string }[];
  label: string;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={`seg-opt ${o.tone}${o.value === value ? " is-on" : ""}`}
          disabled={disabled}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const DRIVE_TONES: Record<DriveStatus, string> = {
  announced: "tone-sky",
  ongoing: "tone-amber",
  completed: "tone-green",
  cancelled: "tone-red",
};
const ROUND_TONES: Record<RoundStatus, string> = {
  scheduled: "tone-sky",
  ongoing: "tone-amber",
  completed: "tone-green",
};

type Run = (done: string, fn: () => Promise<unknown>) => Promise<boolean>;

function RoundRow({ driveId, round, run }: { driveId: number; round: Round; run: Run }) {
  const [day, setDay] = useState(round.scheduled_on ?? "");
  const [shortlisted, setShortlisted] = useState(round.shortlisted_count?.toString() ?? "");
  const dirty = day !== (round.scheduled_on ?? "") || shortlisted !== (round.shortlisted_count?.toString() ?? "");

  return (
    <div className="ed-round">
      <span className="ed-gate">R{round.round_order}</span>
      <div className="ed-round-name">
        {ROUND_NAMES[round.round_type]}
        <small>{ROUND_CODES[round.round_type]}</small>
      </div>
      <Segmented
        label={`Round ${round.round_order} status`}
        value={round.status}
        options={ROUND_STATUSES.map((s) => ({ value: s, label: ROUND_BOARD_STATUS[s], tone: ROUND_TONES[s] }))}
        onChange={(status) =>
          run(`Round ${round.round_order} is now ${ROUND_BOARD_STATUS[status]}`, () =>
            admin.patchRound(driveId, round.round_order, { status }),
          )
        }
      />
      <label className="ed-mini">
        <span>DATE</span>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="ed-mini">
        <span>SHORTLISTED</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="—"
          value={shortlisted}
          onChange={(e) => setShortlisted(e.target.value)}
        />
      </label>
      <button
        className="btn btn-small"
        disabled={!dirty}
        onClick={() =>
          run(`Round ${round.round_order} saved`, () =>
            admin.patchRound(driveId, round.round_order, {
              scheduled_on: day || null,
              shortlisted_count: shortlisted === "" ? null : Number(shortlisted),
            }),
          )
        }
      >
        SAVE
      </button>
    </div>
  );
}

function RoleRow({ role, run }: { role: Role; run: Run }) {
  const [count, setCount] = useState(String(role.selected_count));
  const dirty = count !== String(role.selected_count) && count !== "";

  return (
    <div className="ed-role">
      <div className="ed-role-name">
        {role.title}
        <small>
          {JOB_TYPE_LABELS[role.job_type]} ·{" "}
          {role.ctc_inr !== null ? formatLPA(role.ctc_inr) : formatStipend(role.stipend_inr)}
          {role.location ? ` · ${role.location}` : ""}
        </small>
      </div>
      <label className="ed-mini ed-placed">
        <span>PLACED</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </label>
      <button
        className="btn btn-small"
        disabled={!dirty}
        onClick={() =>
          run(`${role.title}: ${count} placed`, () => admin.patchRole(role.id, { selected_count: Number(count) }))
        }
      >
        PUBLISH
      </button>
    </div>
  );
}

export function DriveEditor({
  id,
  notify,
  onChanged,
}: {
  id: number;
  notify: Notify;
  onChanged: () => void;
}) {
  const [drive, setDrive] = useState<DriveDetail | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [visit, setVisit] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(
    () =>
      admin.drive(id).then((d) => {
        setDrive(d);
        setVisit(d.visit_date ?? "");
        setVersion((v) => v + 1);
      }),
    [id],
  );

  useEffect(() => {
    load().catch((err) => notify("error", err));
  }, [load, notify]);

  const run: Run = async (done, fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged();
      notify("ok", done);
      return true;
    } catch (err) {
      notify("error", err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!drive) {
    return <div className="skeleton" style={{ height: 520 }} aria-busy="true" aria-label="Loading drive" />;
  }

  const visitDirty = visit !== null && visit !== (drive.visit_date ?? "");

  return (
    <div className={`editor${busy ? " is-busy" : ""}`}>
      <header className="ed-head">
        <div>
          <p className="kicker">
            Drive no. {String(drive.id).padStart(4, "0")} · season {drive.season.label}
          </p>
          <h2 className="ed-company">{drive.company.name}</h2>
          {drive.company.sector && <p className="ed-sector">{drive.company.sector}</p>}
        </div>
        <Link href={`/drives/${drive.id}`} className="ed-public" target="_blank">
          PUBLIC PAGE ↗
        </Link>
      </header>

      <section className="ed-card">
        <h3 className="ed-title">Flight status</h3>
        <Segmented
          label="Drive status"
          value={drive.status}
          disabled={busy}
          options={DRIVE_STATUSES.map((s) => ({
            value: s,
            label: DRIVE_BOARD_STATUS[s].label,
            tone: DRIVE_TONES[s],
          }))}
          onChange={(status) =>
            run(`${drive.company.name} is now ${DRIVE_BOARD_STATUS[status].label}`, () =>
              admin.patchDrive(drive.id, { status }),
            )
          }
        />
        <p className="ed-help">{DRIVE_BOARD_STATUS[drive.status].hint}.</p>
        <div className="ed-inline">
          <label className="ed-mini">
            <span>VISIT DATE</span>
            <input type="date" value={visit ?? ""} onChange={(e) => setVisit(e.target.value)} />
          </label>
          <button
            className="btn btn-small"
            disabled={!visitDirty || busy}
            onClick={() =>
              run("Visit date saved", () => admin.patchDrive(drive.id, { visit_date: visit || null }))
            }
          >
            SAVE
          </button>
        </div>
      </section>

      <section className="ed-card">
        <h3 className="ed-title">Rounds</h3>
        {drive.rounds.length === 0 ? (
          <p className="ed-help">No rounds were added to this drive.</p>
        ) : (
          drive.rounds.map((r) => (
            <RoundRow key={`${version}-${r.round_order}`} driveId={drive.id} round={r} run={run} />
          ))
        )}
      </section>

      <section className="ed-card">
        <h3 className="ed-title">Results</h3>
        <p className="ed-help">Publishing a count updates the season&apos;s offer stats straight away.</p>
        {drive.roles.map((r) => (
          <RoleRow key={`${version}-${r.id}`} role={r} run={run} />
        ))}
      </section>

      <section className="ed-card">
        <h3 className="ed-title">Announce</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("Update posted to the board", () => admin.postUpdate(drive.id, message.trim()))) {
              setMessage("");
            }
          }}
        >
          <textarea
            className="ed-text"
            rows={3}
            maxLength={MAX_UPDATE}
            placeholder="e.g. Technical interviews start at 10:00 in Block C. Carry your college ID."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="ed-inline ed-between">
            <span className="ed-count">
              {message.length}/{MAX_UPDATE}
            </span>
            <button className="btn btn-solid btn-small" disabled={!message.trim() || busy}>
              POST UPDATE
            </button>
          </div>
        </form>
        {drive.updates.length > 0 && (
          <ol className="log ed-log">
            {drive.updates.slice(0, 5).map((u) => (
              <li key={u.posted_at} className="log-item">
                <span className="log-time">{formatTimestamp(u.posted_at)}</span>
                <p className="log-msg">{u.message}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
