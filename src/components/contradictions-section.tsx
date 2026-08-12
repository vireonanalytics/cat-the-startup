"use client";

import { useEffect, useTransition } from "react";
import {
  dismissContradiction,
  restoreContradiction,
} from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";
import { useState } from "react";
import type { Contradiction } from "@/lib/supabase/types";

function DismissButton({
  startupId,
  reviewId,
  index,
}: {
  startupId: string;
  reviewId: string;
  index: number;
}) {
  const [isPending, startTransition] = useTransition();
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!isPending) return;
    return pushActivity("swiping", "Sweeping that one away…");
  }, [isPending, pushActivity]);

  function handleClick() {
    const formData = new FormData();
    formData.set("review_id", reviewId);
    formData.set("startup_id", startupId);
    formData.set("index", String(index));
    startTransition(async () => {
      await dismissContradiction(formData);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="shrink-0 whitespace-nowrap text-[11px] font-medium text-amber-700/70 hover:text-amber-900 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-500/70 dark:hover:text-amber-300"
    >
      {isPending ? "…" : "Not relevant"}
    </button>
  );
}

function RestoreButton({
  startupId,
  reviewId,
  index,
}: {
  startupId: string;
  reviewId: string;
  index: number;
}) {
  const [isPending, startTransition] = useTransition();
  const { pushActivity } = useMascot();

  // "reviewing" (a cat thinking, paw on chin) rather than "swiping" - this
  // is reconsidering something already dismissed, not removing anything.
  useEffect(() => {
    if (!isPending) return;
    return pushActivity("reviewing", "Giving that one a second look…");
  }, [isPending, pushActivity]);

  function handleClick() {
    const formData = new FormData();
    formData.set("review_id", reviewId);
    formData.set("startup_id", startupId);
    formData.set("index", String(index));
    startTransition(async () => {
      await restoreContradiction(formData);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="shrink-0 whitespace-nowrap text-[11px] font-medium text-zinc-500 hover:text-zinc-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
    >
      {isPending ? "…" : "Restore"}
    </button>
  );
}

// Contradictions the analyst has dismissed as not relevant stay attached to
// this review row (see dismissContradiction in actions.ts) rather than being
// deleted outright, so they can be restored - but they're excluded from the
// active list and from the header's Contradictions count either way.
export function ContradictionsSection({
  startupId,
  reviewId,
  contradictions,
  dismissedIndices,
  readOnly = false,
}: {
  startupId: string;
  reviewId: string;
  contradictions: Contradiction[];
  dismissedIndices: number[];
  // True when viewing a historical (non-latest) version - dismissing there
  // would edit the past rather than curate the present, so the action is
  // hidden entirely rather than just disabled.
  readOnly?: boolean;
}) {
  const [showDismissed, setShowDismissed] = useState(false);
  const dismissedSet = new Set(dismissedIndices);

  const indexed = contradictions.map((item, index) => ({ item, index }));
  const active = indexed.filter(({ index }) => !dismissedSet.has(index));
  const dismissed = indexed.filter(({ index }) => dismissedSet.has(index));

  if (active.length === 0 && dismissed.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      {active.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-400">
            Contradictions
          </h3>
          <ul className="flex flex-col gap-3">
            {active.map(({ item, index }) => (
              <li key={index} className="text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">
                    {item.point}
                  </p>
                  {!readOnly && (
                    <DismissButton
                      startupId={startupId}
                      reviewId={reviewId}
                      index={index}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">Claim:</span> {item.deck_says}
                </p>
                <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">Reality:</span>{" "}
                  {item.call_says}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dismissed.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowDismissed((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-700 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            {showDismissed ? "Hide" : "Show"} {dismissed.length} dismissed
          </button>

          {showDismissed && (
            <ul className="mt-2 flex flex-col gap-2">
              {dismissed.map(({ item, index }) => (
                <li
                  key={index}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-zinc-700 line-through dark:text-zinc-300">
                      {item.point}
                    </p>
                    {!readOnly && (
                      <RestoreButton
                        startupId={startupId}
                        reviewId={reviewId}
                        index={index}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 text-zinc-500 dark:text-zinc-500">
                    <span className="font-medium">Claim:</span>{" "}
                    {item.deck_says}
                  </p>
                  <p className="mt-0.5 text-zinc-500 dark:text-zinc-500">
                    <span className="font-medium">Reality:</span>{" "}
                    {item.call_says}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
