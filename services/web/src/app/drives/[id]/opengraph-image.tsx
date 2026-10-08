import { ImageResponse } from "next/og";

import { api, type DriveStatus } from "@/lib/api";
import { DRIVE_BOARD_STATUS, formatDay, formatLPA, formatStipend, JOB_TYPE_LABELS } from "@/lib/format";
import { BrandMark, C, OG_SIZE } from "@/lib/og";
import { selectedCount, topCtc } from "@/lib/offers";

export const alt = "Campus drive summary";
export const size = OG_SIZE;
export const contentType = "image/png";

const TONE: Record<DriveStatus, string> = {
  announced: C.sky,
  ongoing: C.amber,
  completed: "#1f9d68",
  cancelled: C.red,
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const drive = /^\d+$/.test(id) ? await api.drive(id).catch(() => null) : null;

  if (drive === null) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.ink, color: C.text, fontSize: 60, fontWeight: 800 }}>
          Placement Board
        </div>
      ),
      size,
    );
  }

  const top = topCtc(drive);
  const stipends = drive.roles.map((r) => r.stipend_inr).filter((s): s is number => s !== null);
  const pay = top !== null ? formatLPA(top) : stipends.length ? formatStipend(Math.max(...stipends)) : "TBA";
  const placed = selectedCount(drive);
  const tone = TONE[drive.status];
  const fields = [
    { label: "VISIT", value: drive.visit_date ? formatDay(drive.visit_date) : "TBA" },
    { label: "TOP PACKAGE", value: pay },
    { label: "ROLES", value: String(drive.roles.length) },
    { label: "PLACED", value: placed > 0 ? String(placed) : "—" },
  ];
  const roleLine = drive.roles
    .slice(0, 3)
    .map((r) => `${r.title} (${JOB_TYPE_LABELS[r.job_type]})`)
    .join("  ·  ");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 44, background: C.ink }}>
        <div style={{ flex: 1, display: "flex", background: C.paper, borderRadius: 26, overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 46px", color: C.paperInk }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingBottom: 18,
                borderBottom: `3px solid ${C.paperInk}`,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 5,
              }}
            >
              <div style={{ display: "flex" }}>CAMPUS DRIVE</div>
              <div style={{ display: "flex" }}>SEASON {drive.season.label}</div>
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: drive.company.name.length > 14 ? 74 : 98, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
              {drive.company.name}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 24, color: C.paperMuted }}>{roleLine}</div>
            <div style={{ display: "flex", gap: 46, marginTop: "auto" }}>
              {fields.map((f) => (
                <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 17, letterSpacing: 4, color: C.paperMuted }}>{f.label}</div>
                  <div style={{ fontSize: 40, fontWeight: 800 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              width: 250,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "40px 24px",
              borderLeft: `3px dashed ${C.paperMuted}`,
              background: "#ebe5d8",
            }}
          >
            <BrandMark size={20} />
            <div
              style={{
                display: "flex",
                padding: "12px 18px",
                borderRadius: 8,
                background: tone,
                color: drive.status === "ongoing" ? C.ink : "#fff",
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 4,
              }}
            >
              {DRIVE_BOARD_STATUS[drive.status].label}
            </div>
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: C.paperMuted }}>
              NO. {String(drive.id).padStart(4, "0")}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
