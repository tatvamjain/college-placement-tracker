import type { DriveSummary, JobType } from "./api";

// One group per role with results and a CTC: full-time, Intern + FTE and Intern + PPO alike.
// Stipends are never plotted, so a role without a CTC is left out.
// `count` students got `ctc_inr`; the chart draws one dot per student.
export type OfferGroup = {
  ctc_inr: number;
  count: number;
  company: string;
  role: string;
  jobType: JobType;
  driveId: number;
};

export function ctcOffers(drives: DriveSummary[]): OfferGroup[] {
  const groups: OfferGroup[] = [];
  for (const drive of drives) {
    if (drive.status === "cancelled") continue;
    for (const role of drive.roles) {
      if (role.ctc_inr === null || role.selected_count === 0) continue;
      groups.push({
        ctc_inr: role.ctc_inr,
        count: role.selected_count,
        company: drive.company.name,
        role: role.title,
        jobType: role.job_type,
        driveId: drive.id,
      });
    }
  }
  return groups.sort((a, b) => a.ctc_inr - b.ctc_inr);
}

// Median and average over every student in the groups (groups are sorted by CTC).
export function offerStats(groups: OfferGroup[]): { median: number | null; average: number | null } {
  const total = groups.reduce((n, g) => n + g.count, 0);
  if (total === 0) return { median: null, average: null };
  const at = (k: number) => {
    let seen = 0;
    for (const g of groups) {
      seen += g.count;
      if (k < seen) return g.ctc_inr;
    }
    return groups[groups.length - 1].ctc_inr;
  };
  const median = total % 2 === 1 ? at((total - 1) / 2) : Math.round((at(total / 2 - 1) + at(total / 2)) / 2);
  const average = Math.round(groups.reduce((sum, g) => sum + g.ctc_inr * g.count, 0) / total);
  return { median, average };
}

export function topCtc(drive: DriveSummary): number | null {
  const ctcs = drive.roles.map((r) => r.ctc_inr).filter((c): c is number => c !== null);
  return ctcs.length > 0 ? Math.max(...ctcs) : null;
}

export function selectedCount(drive: DriveSummary): number {
  return drive.roles.reduce((sum, r) => sum + r.selected_count, 0);
}
