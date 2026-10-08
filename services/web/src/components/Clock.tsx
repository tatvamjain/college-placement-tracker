"use client";

import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

// Re-render once a minute; the server renders a placeholder so HTML never mismatches.
const currentMinute = () => Math.floor(Date.now() / 60_000);
const serverMinute = () => null;

export function Clock() {
  const minute = useSyncExternalStore(subscribe, currentMinute, serverMinute);

  if (minute === null) {
    return <span className="clock">--:-- IST</span>;
  }

  const now = new Date(minute * 60_000);
  const date = now
    .toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })
    .toUpperCase();
  const [hh, mm] = now
    .toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    })
    .split(":");

  return (
    <span className="clock" aria-label={`${date} ${hh}:${mm} IST`}>
      <span className="clock-date">{date} · </span>
      {hh}
      <span className="colon">:</span>
      {mm} IST
    </span>
  );
}
