"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { DriveDetail, DriveStatus, Role, Round, RoundStatus } from "@/lib/api";
import { admin } from "@/lib/client";
import {
  DRIVE_BOARD_STATUS,
  formatTimestamp,
  JOB_TYPE_LABELS,
  ROUND_BOARD_STATUS,
  ROUND_CODES,
  ROUND_NAMES,
  rolePay,
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
  cancelled: "tone-grey",
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

const toLakhs = (inr: number | null) => (inr === null ? "" : String(inr / 100_000));

function RoleRow({ role, run }: { role: Role; run: Run }) {
  const [count, setCount] = useState(String(role.selected_count));
  const [base, setBase] = useState(toLakhs(role.base_inr));
  const hasCtc = role.ctc_inr !== null;
  const countDirty = count !== String(role.selected_count) && count !== "";
  const baseDirty = hasCtc && base !== toLakhs(role.base_inr);
  const baseTooHigh = base !== "" && role.ctc_inr !== null && Number(base) * 100_000 > role.ctc_inr;
  const pay = rolePay(role);

  function save() {
    const body: { selected_count?: number; base_inr?: number | null } = {};
    if (countDirty) body.selected_count = Number(count);
    if (baseDirty) body.base_inr = base === "" ? null : Math.round(Number(base) * 100_000);
    return run(`${role.title} saved`, () => admin.patchRole(role.id, body));
  }

  return (
    <div className="ed-role">
      <div className="ed-role-name">
        {role.title}
        <small>
          {[JOB_TYPE_LABELS[role.job_type], pay.main, ...pay.extra, role.location].filter(Boolean).join(" · ")}
        </small>
      </div>
      {hasCtc && (
        <label className="ed-mini">
          <span>BASE (LPA)</span>
          <input
            type="number"
            min={0}
            step="0.1"
            inputMode="decimal"
            placeholder="—"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            aria-invalid={baseTooHigh}
          />
        </label>
      )}
      <label className="ed-mini ed-placed">
        <span>PLACED</span>
        <input type="number" min={0} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
      </label>
      <button className="btn btn-small" disabled={(!countDirty && !baseDirty) || baseTooHigh} onClick={save}>
        SAVE
      </button>
    </div>
  );
}

function DeleteDrive({ drive, notify, onDeleted }: { drive: DriveDetail; notify: Notify; onDeleted: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await admin.deleteDrive(drive.id);
      notify("ok", `${drive.company.name} drive deleted`);
      onDeleted();
    } catch (err) {
      notify("error", err);
      setBusy(false);
    }
  }

  return (
    <section className="ed-card ed-danger">
      <h3 className="ed-title">Delete drive</h3>
      {asking ? (
        <>
          <p className="ed-help">
            This removes the {drive.company.name} drive with all its roles, rounds, results and announcements. It
            can&apos;t be undone. To pause a drive instead, set its status to On hold.
          </p>
          <div className="ed-inline">
            <button className="btn btn-small btn-danger" disabled={busy} onClick={remove}>
              {busy ? "DELETING…" : "YES, DELETE IT"}
            </button>
            <button className="btn btn-small" disabled={busy} onClick={() => setAsking(false)}>
              KEEP IT
            </button>
          </div>
        </>
      ) : (
        <div className="ed-inline ed-between">
          <span className="ed-help">Added by mistake? Remove it from the site completely.</span>
          <button className="btn btn-small btn-danger" onClick={() => setAsking(true)}>
            DELETE DRIVE
          </button>
        </div>
      )}
    </section>
  );
}

export function DriveEditor({
  id,
  notify,
  onChanged,
  onDeleted,
}: {
  id: number;
  notify: Notify;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [drive, setDrive] = useState<DriveDetail | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [visit, setVisit] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<string | null>(null);

  const load = useCallback(
    () =>
      admin.drive(id).then((d) => {
        setDrive(d);
        setVisit(d.visit_date ?? "");
        setDetails(d.details ?? "");
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
  const detailsDirty = details !== null && details.trim() !== (drive.details ?? "");

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
        <h3 className="ed-title">Drive status</h3>
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
            onClick={() => run("Visit date saved", () => admin.patchDrive(drive.id, { visit_date: visit || null }))}
          >
            SAVE
          </button>
        </div>
      </section>

      <section className="ed-card">
        <h3 className="ed-title">Details &amp; eligibility</h3>
        <p className="ed-help">Shown on the drive page. CGPA cut-off, branches, bond, anything students should know.</p>
        <textarea
          className="ed-text"
          rows={3}
          maxLength={2000}
          placeholder={"e.g. CGPA cut-off 7.5 (internal)\nBranches: CSE, ECE"}
          value={details ?? ""}
          onChange={(e) => setDetails(e.target.value)}
        />
        <div className="ed-inline ed-between">
          <span className="ed-count">{(details ?? "").length}/2000</span>
          <button
            className="btn btn-small"
            disabled={!detailsDirty || busy}
            onClick={() => run("Details saved", () => admin.patchDrive(drive.id, { details: details?.trim() || null }))}
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

      <DeleteDrive drive={drive} notify={notify} onDeleted={onDeleted} />
    </div>
  );
}
