import { ImageResponse } from "next/og";

import { api } from "@/lib/api";
import { lakhs } from "@/lib/format";
import { BrandMark, C, FlapWord, OG_SIZE } from "@/lib/og";

export const alt = "Placement Board: live campus placements";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const live = await api.currentSeason().catch(() => null);
  const stats = live ? await api.seasonStats(live.season.label).catch(() => null) : null;
  const boarding = live?.drives.filter((d) => d.status === "ongoing").length ?? 0;

  const figures = stats
    ? [
        { label: "MEDIAN", value: stats.median_ctc_inr != null ? `₹${lakhs(stats.median_ctc_inr)} LPA` : "—" },
        { label: "COMPANIES", value: String(stats.companies) },
        { label: "FULL-TIME OFFERS", value: String(stats.fte_offers) },
      ]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: `radial-gradient(900px 500px at 90% -10%, rgba(255,176,0,0.16), transparent 60%), ${C.ink}`,
          color: C.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <BrandMark size={16} />
          <div style={{ fontSize: 26, letterSpacing: 6, fontWeight: 700 }}>PLACEMENT BOARD</div>
          {live && (
            <div style={{ marginLeft: "auto", fontSize: 24, color: C.muted, letterSpacing: 4 }}>
              {`SEASON ${live.season.label}`}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <FlapWord text={boarding > 0 ? "LIVE NOW" : "PLACEMENTS"} size={70} />
          <div style={{ fontSize: 50, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, maxWidth: 900 }}>
            {boarding > 0
              ? `${boarding} ${boarding === 1 ? "company is" : "companies are"} hiring on campus right now`
              : "Every company, round, package and result from campus placements"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 56 }}>
          {figures.map((f) => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 20, letterSpacing: 4, color: C.muted }}>{f.label}</div>
              <div style={{ fontSize: 46, fontWeight: 800, color: f.label === "MEDIAN" ? C.amber : C.text }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
