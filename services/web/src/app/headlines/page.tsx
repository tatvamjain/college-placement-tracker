import Link from "next/link";
import { Suspense } from "react";

import { Flaps } from "@/components/Flaps";
import { Pager } from "@/components/Pager";
import { TimeAgo } from "@/components/TimeAgo";
import { api } from "@/lib/api";
import { formatLongDay } from "@/lib/format";
import { allHeadlines, type Headline } from "@/lib/headlines";

export const metadata = { title: "Headlines" };

const PAGE_SIZE = 15;
const KINDS = [
  { id: "all", label: "All" },
  { id: "update", label: "Announcements" },
  { id: "results", label: "Results" },
] as const;
type Kind = (typeof KINDS)[number]["id"];

const IST = "Asia/Kolkata";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST });

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return formatLongDay(key);
}

function groupByDay(items: Headline[]): { key: string; items: Headline[] }[] {
  const groups: { key: string; items: Headline[] }[] = [];
  for (const h of items) {
    const key = dayKey(h.at);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(h);
    else groups.push({ key, items: [h] });
  }
  return groups;
}

function href(kind: Kind, page: number): string {
  const q = new URLSearchParams();
  if (kind !== "all") q.set("kind", kind);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/headlines?${s}` : "/headlines";
}

async function HeadlineList({ searchParams }: { searchParams: PageProps<"/headlines">["searchParams"] }) {
  const sp = await searchParams;
  const kind: Kind = KINDS.some((k) => k.id === sp.kind) ? (sp.kind as Kind) : "all";
  const requested = Number(sp.page);

  const season = await api.currentSeason();
  const all = season ? await allHeadlines(season) : [];
  const counts: Record<Kind, number> = {
    all: all.length,
    update: all.filter((h) => h.kind === "update").length,
    results: all.filter((h) => h.kind === "results").length,
  };
  const items = kind === "all" ? all : all.filter((h) => h.kind === kind);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, pages) : 1;
  const shown = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <section className="today-hero">
        <p className="kicker">
          <span className="live-dot" aria-hidden />
          {season ? `Season ${season.season.label} · ${all.length} posts` : "Between seasons"}
        </p>
        <h1 className="today-title">
          All <span>headlines</span>
        </h1>
        <p className="today-date">Announcements and results from the placement cell, newest first.</p>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="board-tools">
          <div className="chips" role="group" aria-label="Show">
            {KINDS.map((k) => (
              <Link
                key={k.id}
                href={href(k.id, 1)}
                className={`chip${kind === k.id ? " is-on" : ""}`}
                aria-current={kind === k.id ? "page" : undefined}
              >
                {k.label}
                <span className="chip-count">{counts[k.id]}</span>
              </Link>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="board">
            <div className="board-empty">
              <Flaps text="NOTHING YET" />
              <p className="board-note">
                Announcements and results show up here the moment the placement cell posts them.
              </p>
            </div>
          </div>
        ) : (
          <div className="feed">
            {groupByDay(shown).map((g) => (
              <section key={g.key} className="feed-day" aria-label={dayLabel(g.key)}>
                <h2 className="feed-date">
                  <span>{dayLabel(g.key)}</span>
                  <i aria-hidden />
                  <small>{g.items.length}</small>
                </h2>
                <ol className="feed-list">
                  {g.items.map((h) => (
                    <li key={h.key}>
                      <Link href={`/drives/${h.driveId}`} className={`feed-item kind-${h.kind}`}>
                        <span className="feed-time">
                          <b>{clock(h.at)}</b>
                          {Date.now() - Date.parse(h.at) < 86_400_000 && <TimeAgo iso={h.at} />}
                        </span>
                        <span className="feed-body">
                          <span className="feed-company">
                            {h.company}
                            <span className={`feed-badge badge-${h.kind}`}>
                              {h.kind === "results" ? "RESULTS" : "ANNOUNCEMENT"}
                            </span>
                          </span>
                          <span className="feed-text">{h.text}</span>
                        </span>
                        <span className="news-arrow" aria-hidden>
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="board-foot">
            <span className="board-range">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} of {items.length}
            </span>
            <Pager page={page} pages={pages} label="Headline pages" hrefFor={(p) => href(kind, p)} />
          </div>
        )}
      </section>
    </>
  );
}

function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading headlines">
      <div className="skeleton" style={{ height: 120, width: "55%", marginTop: 48 }} />
      <div className="skeleton" style={{ height: 520, marginTop: 30 }} />
    </div>
  );
}

export default function HeadlinesPage(props: PageProps<"/headlines">) {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <HeadlineList searchParams={props.searchParams} />
    </Suspense>
  );
}
