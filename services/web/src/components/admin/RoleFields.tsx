"use client";

import type { JobType, Role } from "@/lib/api";
import type { RoleDraft } from "@/lib/client";
import { JOB_TYPE_LABELS } from "@/lib/format";

// Form state keeps what the admin typed (lakhs, rupees per month) as strings.
export type RoleForm = {
  title: string;
  job_type: JobType;
  lpa: string;
  base: string;
  stipend: string;
  location: string;
};

const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as JobType[];
const lakhsText = (inr: number | null) => (inr === null ? "" : String(inr / 100_000));

export const blankRole = (): RoleForm => ({
  title: "",
  job_type: "fte",
  lpa: "",
  base: "",
  stipend: "",
  location: "",
});

export function roleToForm(r: Role): RoleForm {
  return {
    title: r.title,
    job_type: r.job_type,
    lpa: lakhsText(r.ctc_inr),
    base: lakhsText(r.base_inr),
    stipend: r.stipend_inr === null ? "" : String(r.stipend_inr),
    location: r.location ?? "",
  };
}

// Internships have no CTC and full-time roles have no stipend, so those are sent as null.
export function toDraft(r: RoleForm): RoleDraft {
  return {
    title: r.title.trim(),
    job_type: r.job_type,
    ctc_inr: r.job_type === "intern" || r.lpa === "" ? null : Math.round(Number(r.lpa) * 100_000),
    base_inr: r.job_type === "intern" || r.base === "" ? null : Math.round(Number(r.base) * 100_000),
    stipend_inr: r.job_type === "fte" || r.stipend === "" ? null : Math.round(Number(r.stipend)),
    location: r.location.trim() || null,
  };
}

export const baseTooHigh = (r: RoleForm) => r.lpa !== "" && r.base !== "" && Number(r.base) > Number(r.lpa);
export const roleValid = (r: RoleForm) => r.title.trim() !== "" && !baseTooHigh(r);

export function RoleFields({ value: r, onChange }: { value: RoleForm; onChange: (patch: Partial<RoleForm>) => void }) {
  return (
    <div className="ed-grid">
      <label className="ed-field ed-span">
        <span>TITLE</span>
        <input
          value={r.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Software Engineer"
        />
      </label>
      <label className="ed-field">
        <span>TYPE</span>
        <select value={r.job_type} onChange={(e) => onChange({ job_type: e.target.value as JobType })}>
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
          onChange={(e) => onChange({ location: e.target.value })}
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
            onChange={(e) => onChange({ lpa: e.target.value })}
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
            onChange={(e) => onChange({ base: e.target.value })}
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
            onChange={(e) => onChange({ stipend: e.target.value })}
            placeholder="e.g. 80000"
          />
        </label>
      )}
    </div>
  );
}
