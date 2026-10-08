"use client";

import { useState } from "react";

import type { Company, JobType, RoundType } from "@/lib/api";
import { admin, ApiError, type RoleDraft } from "@/lib/client";
import { JOB_TYPE_LABELS, ROUND_NAMES } from "@/lib/format";

import type { Notify } from "./ControlTower";

type RoleForm = { title: string; job_type: JobType; lpa: string; base: string; stipend: string; location: string };
type RoundForm = { round_type: RoundType; scheduled_on: string };

const blankRole = (): RoleForm => ({ title: "", job_type: "fte", lpa: "", base: "", stipend: "", location: "" });
const MAX_DETAILS = 2000;
const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as JobType[];
const ROUND_TYPES = Object.keys(ROUND_NAMES) as RoundType[];

function toDraft(r: RoleForm): RoleDraft {
  return {
    title: r.title.trim(),
    job_type: r.job_type,
    ctc_inr: r.job_type === "intern" || r.lpa === "" ? null : Math.round(Number(r.lpa) * 100_000),
    base_inr: r.job_type === "intern" || r.base === "" ? null : Math.round(Number(r.base) * 100_000),
    stipend_inr: r.job_type === "fte" || r.stipend === "" ? null : Math.round(Number(r.stipend)),
    location: r.location.trim() || null,
  };
}

export function NewDrive({
  seasonLabel,
  companies,
  notify,
  onCancel,
  onCreated,
}: {
  seasonLabel: string;
  companies: Company[];
  notify: Notify;
  onCancel: () => void;
  onCreated: (id: number) => void;
}) {
  const [companyId, setCompanyId] = useState<string>(companies[0] ? String(companies[0].id) : "new");
  const [newName, setNewName] = useState("");
  const [newSector, setNewSector] = useState("");
  const [visit, setVisit] = useState("");
  const [details, setDetails] = useState("");
  const [roles, setRoles] = useState<RoleForm[]>([blankRole()]);
  const [rounds, setRounds] = useState<RoundForm[]>([]);
  const [busy, setBusy] = useState(false);

  const isNew = companyId === "new";
  const baseTooHigh = (r: RoleForm) => r.lpa !== "" && r.base !== "" && Number(r.base) > Number(r.lpa);
  const valid =
    (isNew ? newName.trim() : companyId) && roles.length > 0 && roles.every((r) => r.title.trim() && !baseTooHigh(r));

  const editRole = (i: number, patch: Partial<RoleForm>) =>
    setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const editRound = (i: number, patch: Partial<RoundForm>) =>
    setRounds((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let id = Number(companyId);
      if (isNew) {
        try {
          id = (await admin.createCompany(newName.trim(), newSector.trim() || null)).id;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            notify("error", `${newName.trim()} already exists. Pick it from the company list.`);
            return;
          }
          throw err;
        }
      }
      const drive = await admin.createDrive({
        season_label: seasonLabel,
        company_id: id,
        visit_date: visit || null,
        details: details.trim() || null,
        roles: roles.map(toDraft),
        rounds: rounds.map((r) => ({ round_type: r.round_type, scheduled_on: r.scheduled_on || null })),
      });
      notify("ok", "Drive added to the board");
      onCreated(drive.id);
    } catch (err) {
      notify("error", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`editor${busy ? " is-busy" : ""}`} onSubmit={submit}>
      <header className="ed-head">
        <div>
          <p className="kicker">New drive · season {seasonLabel}</p>
          <h2 className="ed-company">Add a drive</h2>
        </div>
        <button type="button" className="ed-public" onClick={onCancel}>
          CANCEL ✕
        </button>
      </header>

      <section className="ed-card">
        <h3 className="ed-title">Company</h3>
        <div className="ed-grid">
          <label className="ed-field ed-span">
            <span>COMPANY</span>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="new">+ New company…</option>
            </select>
          </label>
          {isNew && (
            <>
              <label className="ed-field">
                <span>NAME</span>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Atlassian" />
              </label>
              <label className="ed-field">
                <span>SECTOR</span>
                <input value={newSector} onChange={(e) => setNewSector(e.target.value)} placeholder="e.g. Technology" />
              </label>
            </>
          )}
          <label className="ed-field">
            <span>VISIT DATE</span>
            <input type="date" value={visit} onChange={(e) => setVisit(e.target.value)} />
          </label>
          <label className="ed-field ed-span">
            <span>DETAILS &amp; ELIGIBILITY (OPTIONAL)</span>
            <textarea
              className="ed-text"
              rows={3}
              maxLength={MAX_DETAILS}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={"e.g. CGPA cut-off 7.5 (internal)\nBranches: CSE, ECE\n1-year service bond"}
            />
          </label>
        </div>
      </section>

      <section className="ed-card">
        <h3 className="ed-title">Roles</h3>
        {roles.map((r, i) => (
          <div key={i} className="ed-repeat">
            <div className="ed-grid">
              <label className="ed-field ed-span">
                <span>TITLE</span>
                <input
                  value={r.title}
                  onChange={(e) => editRole(i, { title: e.target.value })}
                  placeholder="e.g. Software Engineer"
                />
              </label>
              <label className="ed-field">
                <span>TYPE</span>
                <select value={r.job_type} onChange={(e) => editRole(i, { job_type: e.target.value as JobType })}>
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {JOB_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ed-field">
                <span>LOCATION</span>
                <input
                  value={r.location}
                  onChange={(e) => editRole(i, { location: e.target.value })}
                  placeholder="e.g. Bengaluru"
                />
              </label>
              {r.job_type !== "intern" && (
                <label className="ed-field">
                  <span>CTC (LPA)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={r.lpa}
                    onChange={(e) => editRole(i, { lpa: e.target.value })}
                    placeholder="e.g. 12.5"
                  />
                </label>
              )}
              {r.job_type !== "intern" && (
                <label className="ed-field">
                  <span>BASE SALARY (LPA)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={r.base}
                    onChange={(e) => editRole(i, { base: e.target.value })}
                    placeholder="e.g. 9"
                  />
                  {baseTooHigh(r) && <em className="ed-warn">Base can&apos;t be more than the CTC</em>}
                </label>
              )}
              {r.job_type !== "fte" && (
                <label className="ed-field">
                  <span>STIPEND (₹/MONTH)</span>
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    value={r.stipend}
                    onChange={(e) => editRole(i, { stipend: e.target.value })}
                    placeholder="e.g. 80000"
                  />
                </label>
              )}
            </div>
            {roles.length > 1 && (
              <button type="button" className="link-btn" onClick={() => setRoles((rs) => rs.filter((_, j) => j !== i))}>
                Remove role
              </button>
            )}
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => setRoles((rs) => [...rs, blankRole()])}>
          + Add another role
        </button>
      </section>

      <section className="ed-card">
        <h3 className="ed-title">Rounds</h3>
        <p className="ed-help">In order. Leave the date empty if it isn&apos;t announced yet.</p>
        {rounds.map((r, i) => (
          <div key={i} className="ed-round-new">
            <span className="ed-gate">R{i + 1}</span>
            <select value={r.round_type} onChange={(e) => editRound(i, { round_type: e.target.value as RoundType })}>
              {ROUND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ROUND_NAMES[t]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={r.scheduled_on}
              onChange={(e) => editRound(i, { scheduled_on: e.target.value })}
            />
            <button
              type="button"
              className="link-btn"
              aria-label={`Remove round ${i + 1}`}
              onClick={() => setRounds((rs) => rs.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="link-btn"
          onClick={() =>
            setRounds((rs) => [...rs, { round_type: rs.length === 0 ? "ppt" : "technical", scheduled_on: "" }])
          }
        >
          + Add a round
        </button>
      </section>

      <div className="ed-inline ed-between">
        <span className="ed-help">It appears on the live board as soon as you add it.</span>
        <button className="btn btn-solid" disabled={!valid || busy}>
          {busy ? "ADDING…" : "ADD TO BOARD →"}
        </button>
      </div>
    </form>
  );
}
