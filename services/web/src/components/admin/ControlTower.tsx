"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Flaps } from "@/components/Flaps";
import { DriveStatusTag } from "@/components/StatusTag";
import type { Company, SeasonDrives } from "@/lib/api";
import { ApiError, admin, auth } from "@/lib/client";
import { formatDay } from "@/lib/format";

import { DriveEditor } from "./DriveEditor";
import { NewDrive } from "./NewDrive";

type Gate = "checking" | "out" | "denied" | "ready";
// Pass a message string, or the caught error itself.
export type Notify = (kind: "ok" | "error", what: unknown) => void;

export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Can't reach the server. Check your connection.";
}

export function ControlTower() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("checking");
  const [season, setSeason] = useState<SeasonDrives | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string; at: number } | null>(null);

  const notify: Notify = useCallback((kind, what) => {
    if (what instanceof ApiError && what.status === 401) {
      setGate("out");
      return;
    }
    setToast({ kind, text: typeof what === "string" ? what : errorText(what), at: Date.now() });
  }, []);

  const reload = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([admin.currentSeason(), admin.companies()]);
      setSeason(s);
      setCompanies(c);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setSeason(null);
      else notify("error", err);
    }
  }, [notify]);

  useEffect(() => {
    auth
      .me()
      .then(async (me) => {
        if (me.role !== "admin") return setGate("denied");
        await reload();
        setGate("ready");
      })
      .catch(() => setGate("out"));
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function logout() {
    try {
      await auth.logout();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  if (gate === "checking") {
    return (
      <div aria-busy="true" aria-label="Checking your pass">
        <div className="skeleton" style={{ height: 110, width: "60%", marginTop: 56 }} />
        <div className="skeleton" style={{ height: 420, marginTop: 32 }} />
      </div>
    );
  }

  if (gate === "out" || gate === "denied") {
    return (
      <section className="notice">
        <Flaps text={gate === "out" ? "ADMINS ONLY" : "NO ACCESS"} />
        <h1>{gate === "out" ? "Sign in first" : "Admins only"}</h1>
        <p>
          {gate === "out"
            ? "The admin panel is for the placement cell. Sign in with your Thapar email."
            : "Your account can see the board but can't change it. Ask the placement cell if you should have access."}
        </p>
        <Link href={gate === "out" ? "/login" : "/"} className="btn">
          {gate === "out" ? "SIGN IN →" : "← BACK TO PLACEMENTS"}
        </Link>
      </section>
    );
  }

  const drives = season?.drives ?? [];

  return (
    <>
      <section className="tower-hero">
        <div>
          <p className="kicker">
            <span className="live-dot" aria-hidden />
            Placement cell{season ? ` · season ${season.season.label}` : ""}
          </p>
          <h1 className="today-title">
            Admin <span>panel</span>
          </h1>
        </div>
        <div className="tower-actions">
          <button className="btn btn-solid" onClick={() => setSelected("new")} disabled={!season}>
            + NEW DRIVE
          </button>
          <button className="btn" onClick={logout}>
            LOG OUT
          </button>
        </div>
      </section>

      {!season ? (
        <section className="notice">
          <Flaps text="NO ACTIVE SEASON" />
          <p>Create and activate a season first. New drives are added to the active season.</p>
        </section>
      ) : (
        <div className="tower">
          <nav className="tower-list" aria-label="Drives this season">
            <p className="tower-list-head">
              <span>{drives.length} DRIVES</span>
              <span>STATUS</span>
            </p>
            {drives.length === 0 && <p className="tower-empty">No drives yet. Add the first one.</p>}
            {drives.map((d) => (
              <button
                key={d.id}
                className={`tower-item${selected === d.id ? " is-active" : ""}`}
                onClick={() => setSelected(d.id)}
              >
                <span className="tower-item-main">
                  <span className="tower-item-name">{d.company.name}</span>
                  <span className="tower-item-date">
                    {d.visit_date ? formatDay(d.visit_date) : "DATE TBA"} · NO. {String(d.id).padStart(4, "0")}
                  </span>
                </span>
                <DriveStatusTag status={d.status} />
              </button>
            ))}
          </nav>

          <div className="tower-panel">
            {selected === null && (
              <div className="tower-idle">
                <Flaps text="SELECT A DRIVE" />
                <p>Pick a drive on the left to update its status, rounds and results, or add a new one.</p>
              </div>
            )}
            {selected === "new" && (
              <NewDrive
                seasonLabel={season.season.label}
                companies={companies}
                notify={notify}
                onCancel={() => setSelected(null)}
                onCreated={async (id) => {
                  await reload();
                  setSelected(id);
                }}
              />
            )}
            {typeof selected === "number" && (
              <DriveEditor
                key={selected}
                id={selected}
                notify={notify}
                onChanged={reload}
                onDeleted={async () => {
                  setSelected(null);
                  await reload();
                }}
              />
            )}
          </div>
        </div>
      )}

      {toast && (
        <div key={toast.at} className={`toast toast-${toast.kind}`} role="status">
          <span className="toast-mark">{toast.kind === "ok" ? "✓" : "!"}</span>
          {toast.text}
        </div>
      )}
    </>
  );
}
