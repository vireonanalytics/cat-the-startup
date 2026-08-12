"use client";

import { useReviewRegeneration } from "@/components/review-regeneration-context";

export function ReviewRegeneratingBanner() {
  const { isRegenerating } = useReviewRegeneration();

  if (!isRegenerating) {
    return null;
  }

  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-blue-500" />
      Updating the review with your latest changes…
    </div>
  );
}
