import { Suspense } from "react";

import { SeasonSkeleton, SeasonView } from "@/components/SeasonView";

export default function LivePage() {
  return (
    <Suspense fallback={<SeasonSkeleton />}>
      <SeasonView label={null} />
    </Suspense>
  );
}
