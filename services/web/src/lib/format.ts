import type { DriveStatus, JobType, RoundStatus, RoundType } from "./api";

const IST = "Asia/Kolkata";

export function lakhs(inr: number): string {
  const value = inr / 100_000;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatLPA(inr: number | null): string {
  return inr === null ? "—" : `₹${lakhs(inr)} LPA`;
}

export function formatStipend(inr: number | null): string {
  if (inr === null) return "—";
  return `₹${inr >= 100_000 ? `${lakhs(inr)}L` : `${Math.round(inr / 1000)}k`}/mo`;
}

export function formatDay(isoDate: string): string {
  return new Date(isoDate)
    .toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: IST })
    .toUpperCase();
}

export function formatLongDay(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: IST,
  });
}

export function formatTimestamp(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: IST,
    })
    .toUpperCase();
}

export const DRIVE_BOARD_STATUS: Record<DriveStatus, { label: string; hint: string }> = {
  announced: { label: "UPCOMING", hint: "Drive announced, rounds not started" },
  ongoing: { label: "ONGOING", hint: "Rounds in progress" },
  completed: { label: "RESULTS OUT", hint: "Process finished, results out" },
  cancelled: { label: "CANCELLED", hint: "Company called it off" },
};

export const ROUND_BOARD_STATUS: Record<RoundStatus, string> = {
  scheduled: "SCHEDULED",
  ongoing: "ONGOING",
  completed: "DONE",
};

export const ROUND_NAMES: Record<RoundType, string> = {
  ppt: "Pre-placement talk",
  oa: "Online assessment",
  gd: "Group discussion",
  technical: "Technical interview",
  hr: "HR interview",
};

export const ROUND_CODES: Record<RoundType, string> = {
  ppt: "PPT",
  oa: "OA",
  gd: "GD",
  technical: "TECH",
  hr: "HR",
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  fte: "Full-time",
  intern: "Internship",
  intern_ppo: "Intern + PPO",
};
