import { api, type DriveDetail, type SeasonDrives } from "./api";
import { formatLPA } from "./format";

export type Headline = {
  key: string;
  kind: "update" | "results";
  driveId: number;
  company: string;
  text: string;
  at: string;
};

function resultsLine(d: DriveDetail): string {
  const fte = d.roles.filter((r) => r.job_type === "fte").reduce((n, r) => n + r.selected_count, 0);
  const intern = d.roles.filter((r) => r.job_type !== "fte").reduce((n, r) => n + r.selected_count, 0);
  const top = Math.max(0, ...d.roles.filter((r) => r.selected_count > 0).map((r) => r.ctc_inr ?? 0));
  const parts = [
    fte > 0 && `${fte} full-time ${fte === 1 ? "offer" : "offers"}`,
    intern > 0 && `${intern} ${intern === 1 ? "internship" : "internships"}`,
  ].filter(Boolean);
  if (parts.length === 0) return "Results are out.";
  return `Results are out: ${parts.join(" and ")}${top > 0 ? `, up to ${formatLPA(top)}` : ""}.`;
}

// Announcements and results from every drive in the season, newest first.
// Drive details are cached for 30 s each (see api.ts), so this is cheap after the first visit.
export async function seasonHeadlines(season: SeasonDrives, limit = 6): Promise<Headline[]> {
  const live = season.drives.filter((d) => d.status !== "cancelled");
  const details = await Promise.all(live.map((d) => api.drive(String(d.id)).catch(() => null)));

  const items: Headline[] = [];
  for (const d of details) {
    if (!d) continue;
    for (const u of d.updates) {
      items.push({
        key: `u${d.id}-${u.posted_at}`,
        kind: "update",
        driveId: d.id,
        company: d.company.name,
        text: u.message,
        at: u.posted_at,
      });
    }
    if (d.results_published_at) {
      items.push({
        key: `r${d.id}`,
        kind: "results",
        driveId: d.id,
        company: d.company.name,
        text: resultsLine(d),
        at: d.results_published_at,
      });
    }
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
