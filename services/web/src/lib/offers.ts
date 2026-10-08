import type { DriveSummary } from "./api";

// One entry per student placed in a full-time role, matching how the API computes stats.
export function fteOffers(drives: DriveSummary[]): number[] {
  const offers: number[] = [];
  for (const drive of drives) {
    if (drive.status === "cancelled") continue;
    for (const role of drive.roles) {
      if (role.job_type !== "fte" || role.ctc_inr === null) continue;
      for (let i = 0; i < role.selected_count; i++) offers.push(role.ctc_inr);
    }
  }
  return offers.sort((a, b) => a - b);
}

export function topCtc(drive: DriveSummary): number | null {
  const ctcs = drive.roles.map((r) => r.ctc_inr).filter((c): c is number => c !== null);
  return ctcs.length > 0 ? Math.max(...ctcs) : null;
}

export function selectedCount(drive: DriveSummary): number {
  return drive.roles.reduce((sum, r) => sum + r.selected_count, 0);
}
