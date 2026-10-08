"use client";

import { Flaps } from "@/components/Flaps";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="notice">
      <Flaps text="DELAYED" />
      <h1>Board offline</h1>
      <p>We can&apos;t reach the placement data right now. It&apos;s usually back within a minute.</p>
      <button className="btn" onClick={() => retry()}>
        TRY AGAIN ↻
      </button>
    </section>
  );
}
