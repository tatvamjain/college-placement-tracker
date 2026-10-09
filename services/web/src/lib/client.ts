// Browser-side API calls. Same origin as the site: Caddy routes /api/* to the services
// in production, and next.config.ts rewrites do the same during `npm run dev`.
import type { Company, DriveDetail, DriveStatus, JobType, RoundStatus, RoundType, SeasonDrives } from "./api";

const AUTH = "/api/auth/auth";
const PLACEMENT = "/api/placement";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      const first = body.detail[0];
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  } catch {}
  return `Request failed (${res.status})`;
}

function send(url: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-CSRF", "1");
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers, credentials: "same-origin", cache: "no-store" });
}

// Refresh tokens rotate and reuse is treated as theft, so two tabs or two parallel
// requests must never refresh with the same token. Every caller shares one attempt.
let refreshing: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  refreshing ??= send(`${AUTH}/refresh`, { method: "POST" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res = await send(url, init);
  if (res.status === 401 && !url.startsWith(`${AUTH}/otp`) && (await refreshOnce())) {
    res = await send(url, init);
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

// ---------- auth ----------

// email and display_name come from the database; older auth builds only sent the first three.
export type Me = { user_id: string; pseudo_id: string; role: string; email?: string; display_name?: string };

export const auth = {
  requestCode: (email: string) => request<{ message: string }>(`${AUTH}/otp/request`, json("POST", { email })),
  verifyCode: (email: string, code: string) =>
    request<{ display_name: string; is_new_user: boolean }>(`${AUTH}/otp/verify`, json("POST", { email, code })),
  me: () => request<Me>(`${AUTH}/me`),
  logout: () => request<void>(`${AUTH}/logout`, { method: "POST" }),
};

// ---------- admin ----------

export type RoleDraft = {
  title: string;
  job_type: JobType;
  ctc_inr: number | null;
  base_inr: number | null;
  stipend_inr: number | null;
  location: string | null;
};
export type RoundDraft = { round_type: RoundType; scheduled_on: string | null };

export const admin = {
  currentSeason: () => request<SeasonDrives>(`${PLACEMENT}/seasons/current`),
  drive: (id: number) => request<DriveDetail>(`${PLACEMENT}/drives/${id}`),
  companies: () => request<Company[]>(`${PLACEMENT}/admin/companies`),
  createCompany: (name: string, sector: string | null) =>
    request<Company>(`${PLACEMENT}/admin/companies`, json("POST", { name, sector })),
  createDrive: (body: {
    season_label: string;
    company_id: number;
    visit_date: string | null;
    details: string | null;
    roles: RoleDraft[];
    rounds: RoundDraft[];
  }) => request<DriveDetail>(`${PLACEMENT}/admin/drives`, json("POST", body)),
  patchDrive: (id: number, body: { status?: DriveStatus; visit_date?: string | null; details?: string | null }) =>
    request<unknown>(`${PLACEMENT}/admin/drives/${id}`, json("PATCH", body)),
  patchRound: (
    driveId: number,
    order: number,
    body: { status?: RoundStatus; shortlisted_count?: number | null; scheduled_on?: string | null },
  ) => request<unknown>(`${PLACEMENT}/admin/drives/${driveId}/rounds/${order}`, json("PATCH", body)),
  patchRole: (id: number, body: { selected_count?: number; base_inr?: number | null }) =>
    request<unknown>(`${PLACEMENT}/admin/roles/${id}`, json("PATCH", body)),
  deleteDrive: (id: number) => request<void>(`${PLACEMENT}/admin/drives/${id}`, { method: "DELETE" }),
  postUpdate: (driveId: number, message: string) =>
    request<unknown>(`${PLACEMENT}/admin/drives/${driveId}/updates`, json("POST", { message })),
};
