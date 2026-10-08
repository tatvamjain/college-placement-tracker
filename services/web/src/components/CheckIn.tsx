"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApiError, auth } from "@/lib/client";

import { Flaps } from "./Flaps";

const DOMAIN = "thapar.edu";
const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

type Step = "email" | "code" | "boarded";

function friendly(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Too many codes requested. Wait a few minutes and try again.";
    if (err.status === 400) return "That code is wrong or has expired.";
    if (err.status === 403) return "This account is suspended. Contact the placement cell.";
    if (err.status === 503) return "We couldn't send the email. Try again in a minute.";
    return err.message;
  }
  return "Can't reach the server. Check your connection.";
}

export function CheckIn() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fullEmail = email.includes("@") ? email.trim().toLowerCase() : `${email.trim().toLowerCase()}@${DOMAIN}`;

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!fullEmail.endsWith(`@${DOMAIN}`)) {
      setError(`Use your @${DOMAIN} email.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.requestCode(fullEmail);
      setStep("code");
      setDigits(Array(CODE_LENGTH).fill(""));
      setCooldown(RESEND_SECONDS);
      setTimeout(() => boxes.current[0]?.focus(), 50);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(code: string) {
    setBusy(true);
    setError(null);
    try {
      await auth.verifyCode(fullEmail, code);
      const me = await auth.me();
      setStep("boarded");
      setTimeout(() => {
        router.push(me.role === "admin" ? "/admin" : "/");
        router.refresh();
      }, 1400);
    } catch (err) {
      setError(friendly(err));
      setDigits(Array(CODE_LENGTH).fill(""));
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // A pasted code fills every box at once.
      const next = clean.slice(0, CODE_LENGTH).split("");
      while (next.length < CODE_LENGTH) next.push("");
      setDigits(next);
      boxes.current[Math.min(clean.length, CODE_LENGTH - 1)]?.focus();
      if (clean.length >= CODE_LENGTH) verify(clean.slice(0, CODE_LENGTH));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
    if (next.every((d) => d)) verify(next.join(""));
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
  }

  const stepIndex = step === "email" ? 0 : step === "code" ? 1 : 2;

  return (
    <div className="desk">
      <ol className="desk-steps" aria-label="Check-in progress">
        {["Email", "Code", "Done"].map((label, i) => (
          <li key={label} className={i < stepIndex ? "is-done" : i === stepIndex ? "is-now" : ""}>
            <span className="desk-step-no">{String(i + 1).padStart(2, "0")}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === "email" && (
        <form className="desk-body" onSubmit={sendCode}>
          <label className="desk-label" htmlFor="email">
            College email
          </label>
          <div className="desk-field">
            <input
              id="email"
              className="desk-input"
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="rollno"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            {!email.includes("@") && <span className="desk-suffix">@{DOMAIN}</span>}
          </div>
          <p className="desk-hint">We&apos;ll email you a 6-digit code. No password to remember.</p>
          {error && <p className="desk-error" role="alert">{error}</p>}
          <button className="btn btn-solid desk-go" disabled={busy || !email.trim()}>
            {busy ? "SENDING…" : "SEND CODE →"}
          </button>
        </form>
      )}

      {step === "code" && (
        <div className="desk-body">
          <label className="desk-label" htmlFor="code-0">
            Code sent to <b>{fullEmail}</b>
          </label>
          <div className="code-boxes" role="group" aria-label="6-digit code">
            {digits.map((d, i) => (
              <input
                key={i}
                id={`code-${i}`}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                className="code-box"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1}`}
                value={d}
                disabled={busy}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
              />
            ))}
          </div>
          {error && <p className="desk-error" role="alert">{error}</p>}
          <div className="desk-row">
            <button className="link-btn" onClick={() => { setStep("email"); setError(null); }}>
              ← Change email
            </button>
            <button className="link-btn" disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
          <p className="desk-hint">Check spam if it doesn&apos;t arrive within a minute.</p>
        </div>
      )}

      {step === "boarded" && (
        <div className="desk-body desk-done">
          <Flaps text="SIGNED IN" />
          <p className="desk-hint">You&apos;re signed in. Taking you there…</p>
        </div>
      )}

      <p className="desk-foot">
        The board is public, you don&apos;t need to sign in to see placements.{" "}
        <Link href="/">Back to placements</Link>
      </p>
    </div>
  );
}
