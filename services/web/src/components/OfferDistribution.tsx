import { lakhs } from "@/lib/format";

const WIDTH = 1000;
const PLOT_HEIGHT = 190;
const AXIS_HEIGHT = 34;
const LABEL_SPACE = 34;

function niceMax(value: number): number {
  const steps = [5, 10, 20, 25, 50, 100, 200];
  const step = steps.find((s) => value / s <= 6) ?? 500;
  return Math.max(step, Math.ceil(value / step) * step);
}

// One dot per student placed, stacked by package. Shows where the median really sits.
export function OfferDistribution({
  offers,
  median,
  average,
}: {
  offers: number[];
  median: number | null;
  average: number | null;
}) {
  if (offers.length === 0) {
    return (
      <div className="dist">
        <p className="kicker">No full-time results yet</p>
        <p style={{ marginTop: 8, color: "var(--muted)" }}>
          Every placed student becomes a dot here once results are published.
        </p>
      </div>
    );
  }

  const maxL = niceMax(offers[offers.length - 1] / 100_000);
  const tickStep = maxL / 5;
  const binWidth = Math.max(0.5, maxL / 80);
  const x = (lakh: number) => (lakh / maxL) * WIDTH;

  const bins = new Map<number, number>();
  for (const inr of offers) {
    const bin = Math.round(inr / 100_000 / binWidth);
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }
  const tallest = Math.max(...bins.values());
  const step = Math.min(13, PLOT_HEIGHT / tallest);
  const r = Math.max(2.2, Math.min(5.5, step / 2 - 0.4));
  const top = offers[offers.length - 1];
  const baseline = LABEL_SPACE + PLOT_HEIGHT;
  const height = baseline + AXIS_HEIGHT;

  const dots: { cx: number; cy: number; isTop: boolean; key: string }[] = [];
  for (const [bin, count] of bins) {
    const lakh = bin * binWidth;
    for (let k = 0; k < count; k++) {
      dots.push({
        key: `${bin}-${k}`,
        cx: x(lakh),
        cy: baseline - r - 2 - k * step,
        isTop: Math.abs(lakh * 100_000 - top) < binWidth * 100_000,
      });
    }
  }

  const ticks = Array.from({ length: 6 }, (_, i) => i * tickStep);
  const markers = [
    median !== null && { value: median, label: `MEDIAN ₹${lakhs(median)}L`, color: "var(--amber)", y: 12 },
    average !== null && { value: average, label: `AVERAGE ₹${lakhs(average)}L`, color: "var(--sky)", y: 28 },
  ].filter(Boolean) as { value: number; label: string; color: string; y: number }[];

  return (
    <div className="dist">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Distribution of ${offers.length} full-time offers from ₹${lakhs(offers[0])} to ₹${lakhs(top)} LPA`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={LABEL_SPACE} y2={baseline} stroke="var(--line-soft)" />
            <text
              x={x(t)}
              y={baseline + 22}
              textAnchor={t === 0 ? "start" : t === maxL ? "end" : "middle"}
              fill="var(--dim)"
              fontSize="12"
              fontFamily="var(--font-board)"
            >
              ₹{t}L
            </text>
          </g>
        ))}
        <line x1={0} x2={WIDTH} y1={baseline} y2={baseline} stroke="var(--line)" />
        {dots.map((d) => (
          <circle key={d.key} cx={d.cx} cy={d.cy} r={r} className={d.isTop ? "dot top" : "dot"} />
        ))}
        {markers.map((m) => {
          const mx = x(m.value / 100_000);
          const anchor = mx > WIDTH * 0.8 ? "end" : "start";
          return (
            <g key={m.label}>
              <line
                x1={mx}
                x2={mx}
                y1={m.y + 4}
                y2={baseline}
                stroke={m.color}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text
                x={anchor === "start" ? mx + 6 : mx - 6}
                y={m.y + 8}
                textAnchor={anchor}
                fill={m.color}
                fontSize="12"
                fontWeight="700"
                letterSpacing="1.5"
                fontFamily="var(--font-board)"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="dist-legend">
        <span>● ONE DOT = ONE STUDENT</span>
        <span>
          <i style={{ background: "var(--amber)" }} />
          HALF EARN LESS, HALF MORE
        </span>
        <span>
          <i style={{ background: "var(--sky)" }} />
          PULLED UP BY TOP OFFERS
        </span>
      </div>
    </div>
  );
}
