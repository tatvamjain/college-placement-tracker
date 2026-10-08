import Link from "next/link";

import { Flaps } from "@/components/Flaps";

export default function NotFound() {
  return (
    <section className="notice">
      <Flaps text="NOT FOUND" />
      <h1>Nothing here</h1>
      <p>This drive or season doesn&apos;t exist, or it was removed by the placement cell.</p>
      <Link href="/" className="btn">
        ← BACK TO HOME
      </Link>
    </section>
  );
}
