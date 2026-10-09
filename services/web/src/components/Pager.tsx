import Link from "next/link";

// Page numbers with gaps: 1 … 4 5 6 … 12. Always shows the first, last and neighbours.
function pageList(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  if (page <= 3) [2, 3, 4].forEach((p) => p <= pages && keep.add(p));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => p >= 1 && keep.add(p));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

// Works two ways: give `hrefFor` for real links (server pages, shareable URLs),
// or `onPage` for buttons that change client state.
export function Pager({
  page,
  pages,
  label,
  hrefFor,
  onPage,
}: {
  page: number;
  pages: number;
  label: string;
  hrefFor?: (page: number) => string;
  onPage?: (page: number) => void;
}) {
  if (pages <= 1) return null;

  const item = (p: number, text: React.ReactNode, cls: string, aria?: string) => {
    const disabled = p < 1 || p > pages;
    const current = p === page && cls === "pager-num";
    const className = `${cls}${current ? " is-on" : ""}`;
    if (disabled) {
      return (
        <span className={`${className} is-off`} aria-hidden>
          {text}
        </span>
      );
    }
    if (hrefFor) {
      return (
        <Link href={hrefFor(p)} className={className} aria-label={aria} aria-current={current ? "page" : undefined}>
          {text}
        </Link>
      );
    }
    return (
      <button
        type="button"
        className={className}
        aria-label={aria}
        aria-current={current ? "page" : undefined}
        onClick={() => onPage?.(p)}
      >
        {text}
      </button>
    );
  };

  return (
    <nav className="pager" aria-label={label}>
      {item(page - 1, "← PREV", "pager-step", "Previous page")}
      <span className="pager-nums">
        {pageList(page, pages).map((p, i) =>
          p === "gap" ? (
            <span key={`g${i}`} className="pager-gap" aria-hidden>
              …
            </span>
          ) : (
            <span key={p}>{item(p, p, "pager-num", `Page ${p}`)}</span>
          ),
        )}
      </span>
      <span className="pager-of">
        PAGE {page} OF {pages}
      </span>
      {item(page + 1, "NEXT →", "pager-step", "Next page")}
    </nav>
  );
}
