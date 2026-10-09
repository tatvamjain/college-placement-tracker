"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Flaps } from "@/components/Flaps";
import { ApiError, auth, type Me } from "@/lib/client";

type State = { kind: "loading" } | { kind: "out" } | { kind: "error" } | { kind: "in"; me: Me };

export function Profile() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    auth
      .me()
      .then((me) => setState({ kind: "in", me }))
      .catch((err) => setState({ kind: err instanceof ApiError && err.status === 401 ? "out" : "error" }));
  }, []);

  async function signOut() {
    setLeaving(true);
    try {
      await auth.logout();
    } finally {
      // Even if the server call failed, leave: the header re-reads the cookie on refresh.
      router.push("/");
      router.refresh();
    }
  }

  if (state.kind === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading your account">
        <div className="skeleton" style={{ height: 90, width: "50%", marginTop: 56 }} />
        <div className="skeleton" style={{ height: 300, marginTop: 28 }} />
      </div>
    );
  }

  if (state.kind === "out" || state.kind === "error") {
    return (
      <section className="notice">
        <Flaps text={state.kind === "out" ? "SIGNED OUT" : "OFFLINE"} />
        <h1>{state.kind === "out" ? "You're not signed in" : "Can't load your account"}</h1>
        <p>
          {state.kind === "out"
            ? "Sign in with your Thapar email to see your account."
            : "The server didn't answer. Check your connection and try again."}
        </p>
        <Link href={state.kind === "out" ? "/login" : "/profile"} className="btn">
          {state.kind === "out" ? "SIGN IN →" : "TRY AGAIN"}
        </Link>
      </section>
    );
  }

  const { me } = state;
  const isAdmin = me.role === "admin";
  const name = me.display_name ?? "Signed in";

  return (
    <section className="profile">
      <div className="profile-intro">
        <p className="kicker">Your account</p>
        <h1 className="today-title">
          Hello<span>.</span>
        </h1>
      </div>

      <article className="pass profile-pass">
        <div className="pass-main">
          <div className="pass-band">
            <span>ACCOUNT</span>
            <span className={`tag ${isAdmin ? "tag-boarding" : "tag-departed"}`}>{isAdmin ? "ADMIN" : "STUDENT"}</span>
          </div>

          <p className="profile-label">Community name</p>
          <p className="profile-name">{name}</p>
          <p className="profile-hint">Other students will see this name in the community, never your email.</p>

          <div className="profile-fields">
            <div className="pass-field">
              <label>EMAIL</label>
              <div className="profile-email">{me.email ?? "—"}</div>
            </div>
            <div className="pass-field">
              <label>ACCESS</label>
              <div>{isAdmin ? "Can edit drives" : "Read the board"}</div>
            </div>
          </div>
        </div>

        <div className="pass-stub profile-stub">
          <div>
            <p className="stub-label">SIGNED IN ON</p>
            <p className="profile-device">This device</p>
          </div>
          <div className="profile-actions">
            {isAdmin && (
              <Link href="/admin" className="btn btn-ink">
                ADMIN PANEL →
              </Link>
            )}
            <button className="btn btn-ink btn-out" onClick={signOut} disabled={leaving}>
              {leaving ? "SIGNING OUT…" : "SIGN OUT"}
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
