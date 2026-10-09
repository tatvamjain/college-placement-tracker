"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { Company, DriveDetail, DriveStatus, DriveUpdate, Role, Round, RoundStatus, RoundType } from "@/lib/api";
import { admin } from "@/lib/client";
import {
  DRIVE_BOARD_STATUS,
  formatTimestamp,
  JOB_TYPE_LABELS,
  ROUND_BOARD_STATUS,
  ROUND_NAMES,
  rolePay,
} from "@/lib/format";

import type { Notify } from "./ControlTower";
import { blankRole, RoleFields, type RoleForm, roleToForm, roleValid, toDraft } from "./RoleFields";

const DRIVE_STATUSES: DriveStatus[] = ["announced", "ongoing", "completed", "cancelled"];
const ROUND_STATUSES: RoundStatus[] = ["scheduled", "ongoing", "completed"];
const ROUND_TYPES = Object.keys(ROUND_NAMES) as RoundType[];
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

function RoundTypeSelect({
  value,
  onChange,
  label,
}: {
  value: RoundType;
  onChange: (t: RoundType) => void;
  label: string;
}) {
  return (
    <select
      className="ed-select"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as RoundType)}
    >
      {ROUND_TYPES.map((t) => (
        <option key={t} value={t}>
          {ROUND_NAMES[t]}
        </option>
      ))}
    </select>
  );
}

function RoundRow({ driveId, round, run }: { driveId: number; round: Round; run: Run }) {
  const [type, setType] = useState(round.round_type);
  const [day, setDay] = useState(round.scheduled_on ?? "");
  const [shortlisted, setShortlisted] = useState(round.shortlisted_count?.toString() ?? "");
  const [removing, setRemoving] = useState(false);
  const n = round.round_order;
  const dirty =
    type !== round.round_type ||
    day !== (round.scheduled_on ?? "") ||
    shortlisted !== (round.shortlisted_count?.toString() ?? "");

  function save() {
    const body: Parameters<typeof admin.patchRound>[2] = {
      scheduled_on: day || null,
      shortlisted_count: shortlisted === "" ? null : Number(shortlisted),
    };
    if (type !== round.round_type) body.round_type = type;
    return run(`Round ${n} saved`, () => admin.patchRound(driveId, n, body));
  }

  return (
    <div className={`ed-rnd${removing ? " is-removing" : ""}`}>
      <div className="ed-rnd-top">
        <span className="ed-gate">R{n}</span>
        <RoundTypeSelect label={`Round ${n} type`} value={type} onChange={setType} />
        <Segmented
          label={`Round ${n} status`}
          value={round.status}
          options={ROUND_STATUSES.map((s) => ({ value: s, label: ROUND_BOARD_STATUS[s], tone: ROUND_TONES[s] }))}
          onChange={(status) =>
            run(`Round ${n} is now ${ROUND_BOARD_STATUS[status]}`, () => admin.patchRound(driveId, n, { status }))
          }
        />
        <button
          className="ed-x"
          aria-label={`Remove round ${n}`}
          title="Remove round"
          onClick={() => setRemoving(true)}
        >
          ✕
        </button>
      </div>
      {removing ? (
        <div className="ed-confirm">
          <span>
            Remove round {n} ({ROUND_NAMES[round.round_type]})? Later rounds move up one place.
          </span>
          <button
            className="btn btn-small btn-danger"
            onClick={() => run(`Round ${n} removed`, () => admin.deleteRound(driveId, n))}
          >
            REMOVE
          </button>
          <button className="btn btn-small" onClick={() => setRemoving(false)}>
            KEEP
          </button>
        </div>
      ) : (
        <div className="ed-rnd-fields">
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
          <button className="btn btn-small" disabled={!dirty} onClick={save}>
            SAVE
          </button>
        </div>
      )}
    </div>
  );
}

function AddRound({ driveId, next, run }: { driveId: number; next: number; run: Run }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RoundType>(next === 1 ? "ppt" : "technical");
  const [day, setDay] = useState("");

  if (!open) {
    return (
      <button className="link-btn ed-add" onClick={() => setOpen(true)}>
        + Add a round
      </button>
    );
  }
  return (
    <div className="ed-rnd ed-rnd-new">
      <div className="ed-rnd-top">
        <span className="ed-gate">R{next}</span>
        <RoundTypeSelect label="New round type" value={type} onChange={setType} />
        <label className="ed-mini">
          <span>DATE</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
      </div>
      <div className="ed-rnd-fields">
        <button
          className="btn btn-small btn-solid"
          onClick={async () => {
            if (
              await run(`Round ${next} added`, () =>
                admin.addRound(driveId, { round_type: type, scheduled_on: day || null }),
              )
            ) {
              setOpen(false);
              setDay("");
            }
          }}
        >
          ADD ROUND
        </button>
        <button className="btn btn-small" onClick={() => setOpen(false)}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

const toLakhs = (inr: number | null) => (inr === null ? "" : String(inr / 100_000));

// Only the fields the admin actually changed are sent, so an unchanged CTC never gets rewritten.
function changedFields(role: Role, form: RoleForm) {
  const next = toDraft(form);
  const body: Partial<typeof next> = {};
  (Object.keys(next) as (keyof typeof next)[]).forEach((k) => {
    if (next[k] !== role[k]) Object.assign(body, { [k]: next[k] });
  });
  return body;
}

function RoleRow({ role, run, onlyRole }: { role: Role; run: Run; onlyRole: boolean }) {
  const [count, setCount] = useState(String(role.selected_count));
  const [base, setBase] = useState(toLakhs(role.base_inr));
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RoleForm>(() => roleToForm(role));
  const [removing, setRemoving] = useState(false);
  const hasCtc = role.ctc_inr !== null;
  const countDirty = count !== String(role.selected_count) && count !== "";
  const baseDirty = hasCtc && base !== toLakhs(role.base_inr);
  const baseTooHigh = base !== "" && role.ctc_inr !== null && Number(base) * 100_000 > role.ctc_inr;
  const pay = rolePay(role);
  const changes = changedFields(role, form);
  const formDirty = Object.keys(changes).length > 0;

  function save() {
    const body: { selected_count?: number; base_inr?: number | null } = {};
    if (countDirty) body.selected_count = Number(count);
    if (baseDirty) body.base_inr = base === "" ? null : Math.round(Number(base) * 100_000);
    return run(`${role.title} saved`, () => admin.patchRole(role.id, body));
  }

  return (
    <div className={`ed-role-wrap${editing ? " is-editing" : ""}`}>
      <div className="ed-role">
        <div className="ed-role-name">
          {role.title}
          <small>
            {[JOB_TYPE_LABELS[role.job_type], pay.main, ...pay.extra, role.location].filter(Boolean).join(" · ")}
          </small>
          <button className="link-btn ed-edit-link" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? "Close editor" : "Edit role"}
          </button>
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

      {editing && (
        <div className="ed-role-edit">
          <RoleFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
          {removing ? (
            <div className="ed-confirm">
              <span>
                Remove {role.title}
                {role.selected_count > 0 ? ` and its ${role.selected_count} placed students` : ""} from this drive?
              </span>
              <button
                className="btn btn-small btn-danger"
                onClick={() => run(`${role.title} removed`, () => admin.deleteRole(role.id))}
              >
                REMOVE
              </button>
              <button className="btn btn-small" onClick={() => setRemoving(false)}>
                KEEP
              </button>
            </div>
          ) : (
            <div className="ed-inline ed-between">
              <button
                className="link-btn ed-remove"
                disabled={onlyRole}
                title={onlyRole ? "A drive needs at least one role" : undefined}
                onClick={() => setRemoving(true)}
              >
                Remove role
              </button>
              <span className="ed-inline">
                <button
                  className="btn btn-small"
                  onClick={() => {
                    setForm(roleToForm(role));
                    setEditing(false);
                  }}
                >
                  CANCEL
                </button>
                <button
                  className="btn btn-small btn-solid"
                  disabled={!formDirty || !roleValid(form)}
                  onClick={() =>
                    run(`${form.title.trim() || role.title} updated`, () => admin.patchRole(role.id, changes))
                  }
                >
                  SAVE ROLE
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddRole({ driveId, run }: { driveId: number; run: Run }) {
  const [form, setForm] = useState<RoleForm | null>(null);

  if (!form) {
    return (
      <button className="link-btn ed-add" onClick={() => setForm(blankRole())}>
        + Add a role
      </button>
    );
  }
  return (
    <div className="ed-role-edit ed-role-new">
      <p className="ed-sub">New role</p>
      <RoleFields value={form} onChange={(patch) => setForm((f) => f && { ...f, ...patch })} />
      <div className="ed-inline ed-between">
        <span />
        <span className="ed-inline">
          <button className="btn btn-small" onClick={() => setForm(null)}>
            CANCEL
          </button>
          <button
            className="btn btn-small btn-solid"
            disabled={!roleValid(form)}
            onClick={async () => {
              if (await run(`${form.title.trim()} added`, () => admin.addRole(driveId, toDraft(form)))) setForm(null);
            }}
          >
            ADD ROLE
          </button>
        </span>
      </div>
    </div>
  );
}

function AnnouncementItem({ update, run }: { update: DriveUpdate; run: Run }) {
  const [asking, setAsking] = useState(false);
  const id = update.id;

  return (
    <li className={`log-item ed-ann${asking ? " is-asking" : ""}`}>
      <div className="ed-ann-head">
        <span className="log-time">{formatTimestamp(update.posted_at)}</span>
        {id !== undefined && !asking && (
          <button className="link-btn ed-remove ed-ann-del" onClick={() => setAsking(true)}>
            Delete
          </button>
        )}
      </div>
      <p className="log-msg">{update.message}</p>
      {asking && id !== undefined && (
        <div className="ed-confirm">
          <span>Delete this announcement? It disappears from the drive page and headlines.</span>
          <button
            className="btn btn-small btn-danger"
            onClick={() => run("Announcement deleted", () => admin.deleteUpdate(id))}
          >
            DELETE
          </button>
          <button className="btn btn-small" onClick={() => setAsking(false)}>
            KEEP
          </button>
        </div>
      )}
    </li>
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
  companies,
  notify,
  onChanged,
  onDeleted,
}: {
  id: number;
  companies: Company[];
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
  const [companyId, setCompanyId] = useState<string>("");

  const load = useCallback(
    () =>
      admin.drive(id).then((d) => {
        setDrive(d);
        setVisit(d.visit_date ?? "");
        setDetails(d.details ?? "");
        setCompanyId(String(d.company.id));
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
        <h3 className="ed-title">Drive</h3>
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
        <div className="ed-inline ed-wrap">
          <label className="ed-mini ed-company-pick">
            <span>COMPANY</span>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-small"
            disabled={companyId === String(drive.company.id) || busy}
            onClick={() => run("Company changed", () => admin.patchDrive(drive.id, { company_id: Number(companyId) }))}
          >
            SAVE
          </button>
        </div>
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
          <p className="ed-help">No rounds yet. Add them in the order they happen.</p>
        ) : (
          drive.rounds.map((r) => (
            <RoundRow key={`${version}-${r.round_order}`} driveId={drive.id} round={r} run={run} />
          ))
        )}
        <AddRound key={`add-${version}`} driveId={drive.id} next={drive.rounds.length + 1} run={run} />
      </section>

      <section className="ed-card">
        <h3 className="ed-title">Roles &amp; results</h3>
        <p className="ed-help">
          Publishing a placed count updates the season&apos;s offer stats straight away. Use Edit role to fix the title,
          type, package or location.
        </p>
        {drive.roles.map((r) => (
          <RoleRow key={`${version}-${r.id}`} role={r} run={run} onlyRole={drive.roles.length === 1} />
        ))}
        <AddRole key={`add-${version}`} driveId={drive.id} run={run} />
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
            {drive.updates.map((u) => (
              <AnnouncementItem key={u.id ?? u.posted_at} update={u} run={run} />
            ))}
          </ol>
        )}
      </section>

      <DeleteDrive drive={drive} notify={notify} onDeleted={onDeleted} />
    </div>
  );
}
