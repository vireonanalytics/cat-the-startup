"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { generateReview } from "@/app/(app)/startups/[id]/actions";
import { useReviewRegeneration } from "@/components/review-regeneration-context";

function GenerateButton({
  hasReview,
  disabled,
}: {
  hasReview: boolean;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  // Routes through the same activity push (and the same long-wait apology
  // handling) as a background regeneration, rather than pushing its own -
  // that split used to mean a manual click never got the "still working on
  // it" apology no matter how long it ran, since nothing here tracked wait
  // time at all.
  const { notifyRegenerationStarted } = useReviewRegeneration();

  useEffect(() => {
    if (pending) notifyRegenerationStarted();
  }, [pending, notifyRegenerationStarted]);

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
    >
      {pending ? "Generating…" : hasReview ? "Regenerate" : "Generate Review"}
    </button>
  );
}

export function GenerateReviewForm({
  startupId,
  hasDeck,
  hasReview,
}: {
  startupId: string;
  hasDeck: boolean;
  hasReview: boolean;
}) {
  return (
    <form action={generateReview}>
      <input type="hidden" name="startup_id" value={startupId} />
      <GenerateButton hasReview={hasReview} disabled={!hasDeck} />
    </form>
  );
}
