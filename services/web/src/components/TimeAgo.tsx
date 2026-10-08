"use client";

import { useSyncExternalStore } from "react";

import { formatTimestamp } from "@/lib/format";

const TICK = 30_000;

// A clock that ticks every 30 s. On the server (and during hydration) it reads null.
const subscribe = (onTick: () => void) => {
  const t = setInterval(onTick, TICK);
  return () => clearInterval(t);
};
const readClock = () => Math.floor(Date.now() / TICK) * TICK;
const serverClock = () => null;

function relative(iso: string, now: number): string | null {
  const mins = Math.floor((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins} MIN AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} H AGO`;
  return null;
}

// The server renders the exact time; the browser swaps in "12 MIN AGO" and keeps it fresh.
export function TimeAgo({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribe, readClock, serverClock);
  const exact = formatTimestamp(iso);
  return (
    <time dateTime={iso} title={exact}>
      {(now !== null && relative(iso, now)) || exact}
    </time>
  );
}
