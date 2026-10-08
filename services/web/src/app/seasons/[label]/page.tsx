import { Suspense } from "react";

import { SeasonSkeleton, SeasonView } from "@/components/SeasonView";

async function Season({ params }: { params: PageProps<"/seasons/[label]">["params"] }) {
  const { label } = await params;
  return <SeasonView label={label} />;
}

export async function generateMetadata({ params }: PageProps<"/seasons/[label]">) {
  const { label } = await params;
  return { title: `Season ${label}` };
}

export default function SeasonPage({ params }: PageProps<"/seasons/[label]">) {
  return (
    <Suspense fallback={<SeasonSkeleton />}>
      <Season params={params} />
    </Suspense>
  );
}
