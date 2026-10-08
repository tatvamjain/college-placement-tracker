import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Barcode } from "@/components/Barcode";
import { RouteLine } from "@/components/RouteLine";
import { DriveStatusTag } from "@/components/StatusTag";
import { api } from "@/lib/api";
import {
  DRIVE_BOARD_STATUS,
  formatDay,
  formatLPA,
  formatStipend,
  formatTimestamp,
  JOB_TYPE_LABELS,
} from "@/lib/format";
import { selectedCount, topCtc } from "@/lib/offers";

type Params = PageProps<"/drives/[id]">["params"];

async function Drive({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const drive = await api.drive(id);
  if (drive === null) notFound();

  const placed = selectedCount(drive);
  const top = topCtc(drive);
  const seasonHref = drive.season.status === "active" ? "/" : `/seasons/${drive.season.label}`;

  return (
    <>
      <Link href={seasonHref} className="back-link">
        ← SEASON {drive.season.label}
      </Link>

      <article className="pass" aria-label={`${drive.company.name} drive`}>
        <div className="pass-main">
          <div className="pass-band">
            <span>CAMPUS DRIVE</span>
            <span>NO. {String(drive.id).padStart(4, "0")}</span>
          </div>

          <h1 className="pass-company">{drive.company.name}</h1>
          {drive.company.sector && <p className="pass-sector">{drive.company.sector}</p>}

          <div className="pass-fields">
            <div className="pass-field">
              <label>VISIT</label>
              <div>{drive.visit_date ? formatDay(drive.visit_date) : "TBA"}</div>
            </div>
            <div className="pass-field">
              <label>SEASON</label>
              <div>{drive.season.label}</div>
            </div>
            <div className="pass-field">
              <label>ROLES</label>
              <div>{drive.roles.length}</div>
            </div>
            <div className="pass-field">
              <label>STATUS</label>
              <div>
                <DriveStatusTag status={drive.status} />
              </div>
            </div>
          </div>

          <div className="fares">
            {drive.roles.map((role) => (
              <div key={role.id} className="fare">
                <span className="fare-title">{role.title}</span>
                <span className="fare-type">{JOB_TYPE_LABELS[role.job_type]}</span>
                <span className="fare-money">
                  {role.ctc_inr !== null ? formatLPA(role.ctc_inr) : formatStipend(role.stipend_inr)}
                </span>
                <span className="fare-loc">{role.location ?? "Location TBA"}</span>
                <span className="fare-sel">
                  {role.selected_count}
                  <small>PLACED</small>
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="pass-stub">
          <div>
            <p className="stub-label">STUDENTS PLACED</p>
            <p className="stub-big">{placed}</p>
          </div>
          <div>
            <p className="stub-label">TOP PACKAGE</p>
            <p className="stub-top">{formatLPA(top)}</p>
          </div>
          <Barcode seed={drive.id} />
        </aside>
      </article>

      <section className="section" style={{ marginTop: 24 }}>
        <div className="section-head">
          <h2 className="section-title">Rounds</h2>
          {drive.rounds.some((r) => r.scheduled_on) ? (
            <a href={`/drives/${drive.id}/calendar`} className="cal-link" download>
              + ADD ROUNDS TO CALENDAR
            </a>
          ) : (
            <span className="kicker">{drive.rounds.length} rounds</span>
          )}
        </div>
        <RouteLine rounds={drive.rounds} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Announcements</h2>
          <span className="kicker">Newest first · IST</span>
        </div>
        {drive.updates.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No announcements yet.</p>
        ) : (
          <ol className="log">
            {drive.updates.map((update) => (
              <li key={update.posted_at + update.message} className="log-item">
                <p className="log-time">{formatTimestamp(update.posted_at)}</p>
                <p className="log-msg">{update.message}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function PassSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading drive">
      <div className="skeleton" style={{ height: 14, width: 160, marginTop: 34 }} />
      <div className="skeleton" style={{ height: 420, marginTop: 20, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 200, marginTop: 40 }} />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<"/drives/[id]">): Promise<Metadata> {
  const { id } = await params;
  const drive = /^\d+$/.test(id) ? await api.drive(id) : null;
  if (drive === null) return { title: "Drive not found" };

  const top = topCtc(drive);
  const placed = selectedCount(drive);
  const facts = [
    DRIVE_BOARD_STATUS[drive.status].label,
    drive.visit_date ? `Visit ${formatDay(drive.visit_date)}` : null,
    top !== null ? `Up to ${formatLPA(top)}` : null,
    placed > 0 ? `${placed} placed` : null,
  ].filter(Boolean);

  const title = `${drive.company.name} · ${drive.season.label}`;
  const description = `${facts.join(" · ")}. Roles: ${drive.roles.map((r) => r.title).join(", ")}.`;
  return {
    title,
    description,
    openGraph: { title: `${title} · Placement Board`, description, siteName: "Placement Board", type: "website" },
  };
}

export default function DrivePage({ params }: PageProps<"/drives/[id]">) {
  return (
    <Suspense fallback={<PassSkeleton />}>
      <Drive params={params} />
    </Suspense>
  );
}
