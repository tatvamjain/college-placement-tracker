// Shared pieces for the link-preview images (WhatsApp, LinkedIn, Slack...).
export const OG_SIZE = { width: 1200, height: 630 };

export const C = {
  ink: "#0a0c0f",
  panel: "#111419",
  flap: "#181c22",
  line: "#242a33",
  text: "#ece9e2",
  muted: "#8b919b",
  amber: "#ffb000",
  green: "#3ddc97",
  sky: "#6cb8ff",
  red: "#ff5a5f",
  paper: "#f3efe6",
  paperInk: "#16181c",
  paperMuted: "#6b6a66",
};

export function BrandMark({ size = 14 }: { size?: number }) {
  const cell = (opacity: number) => (
    <div style={{ width: size, height: size, background: C.amber, opacity, borderRadius: 2 }} />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {cell(1)}
        {cell(0.35)}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {cell(0.35)}
        {cell(1)}
      </div>
    </div>
  );
}

// Split-flap tiles for a short word, drawn with plain boxes.
export function FlapWord({ text, size = 64 }: { text: string; size?: number }) {
  return (
    <div style={{ display: "flex", gap: Math.round(size * 0.08) }}>
      {text.split("").map((ch, i) =>
        ch === " " ? (
          <div key={i} style={{ width: size * 0.4 }} />
        ) : (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: size * 0.78,
              height: size * 1.1,
              background: C.flap,
              borderRadius: 6,
              color: C.amber,
              fontSize: size * 0.8,
              fontWeight: 700,
              position: "relative",
            }}
          >
            {ch}
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: C.ink }} />
          </div>
        ),
      )}
    </div>
  );
}
