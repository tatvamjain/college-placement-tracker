import { api } from "@/lib/api";
import { DRIVE_BOARD_STATUS, formatDay, formatLPA, formatStipend } from "@/lib/format";

type Item = { key: string; company: string; detail: string; amount: string; tail: string };

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
      <div className="ticker-track">
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
