import { api } from "@/lib/api";
import { DRIVE_BOARD_STATUS, formatDay, formatLPA, formatStipend } from "@/lib/format";

type Item = { key: string; company: string; detail: string; amount: string; tail: string };

// Constant reading speed no matter how many drives there are: the loop's duration grows
// with its length. Width is estimated from the text (12px monospace ≈ 8.2px per character
// with the letter-spacing) plus each item's padding, gaps and separator.
const PX_PER_SECOND = 45;
const CHAR_PX = 8.2;
const ITEM_PX = 110;

function stripSeconds(items: Item[]): number {
  const px = items.reduce(
    (sum, i) => sum + ITEM_PX + CHAR_PX * (i.company.length + i.detail.length + i.amount.length + i.tail.length),
    0,
  );
  return Math.max(20, Math.round(px / PX_PER_SECOND));
}

async function tickerItems(): Promise<Item[]> {
  try {
    const current = await api.currentSeason();
    if (!current) return [];
    const items: Item[] = [];
    for (const drive of current.drives) {
      const placed = drive.roles.filter((r) => r.selected_count > 0);
      if (placed.length > 0) {
        for (const role of placed) {
          items.push({
            key: `r${role.id}`,
            company: drive.company.name,
            detail: role.title,
            amount: role.ctc_inr !== null ? formatLPA(role.ctc_inr) : formatStipend(role.stipend_inr),
            tail: `×${role.selected_count} PLACED`,
          });
        }
      } else {
        items.push({
          key: `d${drive.id}`,
          company: drive.company.name,
          detail: drive.visit_date ? formatDay(drive.visit_date) : "DATE TBA",
          amount: DRIVE_BOARD_STATUS[drive.status].label,
          tail: "",
        });
      }
    }
    return items;
  } catch {
    // The ticker is decoration: if the API is down, the page should still render.
    return [];
  }
}

export async function Ticker() {
  const items = await tickerItems();
  if (items.length === 0) return <div className="ticker" aria-hidden />;

  // Repeat until the strip is long enough, then twice more for a seamless loop.
  const base = Array.from({ length: Math.ceil(8 / items.length) }, () => items).flat();
  const loop = [...base, ...base];

  return (
    <div className="ticker" aria-label="Latest placement results">
      <div className="ticker-track" style={{ animationDuration: `${stripSeconds(base)}s` }}>
        {loop.map((item, i) => (
          <span key={`${item.key}-${i}`} className="ticker-item" aria-hidden={i >= base.length}>
            <strong>{item.company.toUpperCase()}</strong>
            <span>{item.detail}</span>
            <span className="amount">{item.amount}</span>
            {item.tail && <span>{item.tail}</span>}
            <span className="sep">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
