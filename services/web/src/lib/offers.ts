import type { DriveSummary } from "./api";

// One group per full-time role with results, matching how the API computes stats.
// `count` students got `ctc_inr`; the chart draws one dot per student.
export type OfferGroup = {
  ctc_inr: number;
  count: number;
  company: string;
  role: string;
  driveId: number;
};

export function fteOffers(drives: DriveSummary[]): OfferGroup[] {
  const groups: OfferGroup[] = [];
  for (const drive of drives) {
    if (drive.status === "cancelled") continue;
    for (const role of drive.roles) {
      if (role.job_type !== "fte" || role.ctc_inr === null || role.selected_count === 0) continue;
      groups.push({
        ctc_inr: role.ctc_inr,
        count: role.selected_count,
        company: drive.company.name,
        role: role.title,
        driveId: drive.id,
      });
    }
  }
  return groups.sort((a, b) => a.ctc_inr - b.ctc_inr);
}

export function topCtc(drive: DriveSummary): number | null {
  const ctcs = drive.roles.map((r) => r.ctc_inr).filter((c): c is number => c !== null);
  return ctcs.length > 0 ? Math.max(...ctcs) : null;
}

export function selectedCount(drive: DriveSummary): number {
  return drive.roles.reduce((sum, r) => sum + r.selected_count, 0);
}
