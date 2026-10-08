import { cacheLife } from "next/cache";
import { connection } from "next/server";

// Server-only: no NEXT_PUBLIC_ prefix, so this address never reaches the browser.
const API = process.env.PLACEMENT_API_URL ?? "http://127.0.0.1:8002";

// ---------- types (mirror the placement service's Pydantic schemas) ----------

export type SeasonStatus = "active" | "archived";
export type DriveStatus = "announced" | "ongoing" | "completed" | "cancelled";
export type JobType = "fte" | "intern" | "intern_ppo" | "intern_fte";
export type RoundType = "ppt" | "oa" | "gd" | "technical" | "hr";
export type RoundStatus = "scheduled" | "ongoing" | "completed";

export type Season = { label: string; status: SeasonStatus };
export type Company = { id: number; name: string; sector: string | null; website: string | null };
export type Role = {
  id: number;
  title: string;
  job_type: JobType;
  ctc_inr: number | null;
  base_inr: number | null;
  stipend_inr: number | null;
  location: string | null;
  selected_count: number;
};
export type Round = {
  round_order: number;
  round_type: RoundType;
  scheduled_on: string | null;
  status: RoundStatus;
  shortlisted_count: number | null;
};
export type DriveUpdate = { message: string; posted_at: string };

export type DriveSummary = {
  id: number;
  company: Company;
  status: DriveStatus;
  visit_date: string | null;
  roles: Role[];
};
export type DriveDetail = DriveSummary & {
  season: Season;
  results_published_at: string | null;
  details: string | null;
  rounds: Round[];
  updates: DriveUpdate[];
};
export type SeasonDrives = { season: Season; drives: DriveSummary[] };
export type SeasonStats = {
  season: string;
  companies: number;
  fte_offers: number;
  intern_offers: number;
  highest_ctc_inr: number | null;
  median_ctc_inr: number | null;
  average_ctc_inr: number | null;
};
export type TodayRound = {
  drive_id: number;
  company: string;
  round_order: number;
  round_type: RoundType;
  status: RoundStatus;
};
export type Today = { day: string; rounds: TodayRound[] };

// ---------- fetching ----------

// Cached on the Next.js server for 30 s. Redis behind the API is the second layer.
async function get<T>(path: string): Promise<T | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 300 });

  const res = await fetch(`${API}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Placement API ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

// connection() keeps these out of the build: data is fetched when a student visits,
// so `npm run build` works even when the API isn't running.
async function live<T>(path: string): Promise<T | null> {
  await connection();
  return get<T>(path);
}

export const api = {
  seasons: () => live<Season[]>("/seasons"),
  currentSeason: () => live<SeasonDrives>("/seasons/current"),
  season: (label: string) => live<SeasonDrives>(`/seasons/${encodeURIComponent(label)}`),
  seasonStats: (label: string) => live<SeasonStats>(`/seasons/${encodeURIComponent(label)}/stats`),
  drive: (id: string) => live<DriveDetail>(`/drives/${encodeURIComponent(id)}`),
  today: () => live<Today>("/today"),
};
