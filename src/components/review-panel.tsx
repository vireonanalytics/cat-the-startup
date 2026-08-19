"use client";

import { useMemo, useState } from "react";
import { GenerateReviewForm } from "@/components/generate-review-form";
import { ReviewRegeneratingBanner } from "@/components/review-regenerating-banner";
import { ReviewContent } from "@/components/review-content";
import { ReviewDiffView } from "@/components/review-diff-view";
import { computeReviewDiff, type ReviewVersionData } from "@/lib/review-diff";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function versionLabel(version: ReviewVersionData, isLatest: boolean) {
  return `v${version.version} · ${formatDate(version.generated_at)}${isLatest ? " (current)" : ""}`;
}

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";

export function ReviewPanel({
  startupId,
  hasDeck,
  versions,
  autoTrigger = false,
}: {
  startupId: string;
  hasDeck: boolean;
  versions: ReviewVersionData[];
  /** True right after a deck-based startup creation redirects here (see
   * processNewDeckAndExtractStartupInfo's ?autogen=1) - has
   * GenerateReviewForm submit itself on mount instead of waiting for a
   * click, since this is always a brand-new startup with no review yet. */
  autoTrigger?: boolean;
}) {
  const latest = versions[0] ?? null;

  // null = "always show whatever is latest" (the common case - a freshly
  // regenerated review should appear without the analyst having to
  // re-select it). Picking a specific historical version pins the view to
  // that exact id instead, so it doesn't jump if a new version lands later.
  const [pinnedVersionId, setPinnedVersionId] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "diff">("single");
  const [diffOlderId, setDiffOlderId] = useState<string | null>(null);
  const [diffNewerId, setDiffNewerId] = useState<string | null>(null);

  const selected = pinnedVersionId
    ? (versions.find((v) => v.id === pinnedVersionId) ?? latest)
    : latest;
  // Whether the analyst is viewing "whatever is latest" rather than a
  // pinned historical version - true even when there's no review yet at
  // all (latest === null), which is what lets a brand-new startup with no
  // versions still show the Generate Review button. Deliberately not
  // `selected?.id === latest?.id`: that's false whenever latest is null,
  // which hid the button for every startup before its first review ever
  // existed (including every deck-created startup, since creation never
  // auto-generates the first review).
  const isLatest = pinnedVersionId === null;

  const diffOlder =
    versions.find((v) => v.id === diffOlderId) ?? versions[1] ?? null;
  const diffNewer =
    versions.find((v) => v.id === diffNewerId) ?? versions[0] ?? null;

  const diff = useMemo(() => {
    if (!diffOlder || !diffNewer || diffOlder.id === diffNewer.id) return null;
    return computeReviewDiff(diffOlder, diffNewer);
  }, [diffOlder, diffNewer]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Review
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {versions.length > 0 && (
            <select
              value={selected?.id ?? ""}
              onChange={(event) => {
                const id = event.target.value;
                setPinnedVersionId(id === latest?.id ? null : id);
              }}
              className={selectClass}
              aria-label="Review version"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {versionLabel(v, v.id === latest?.id)}
                </option>
              ))}
            </select>
          )}
          {versions.length > 1 && (
            <button
              type="button"
              onClick={() => setMode((m) => (m === "single" ? "diff" : "single"))}
              className={
                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors " +
                (mode === "diff"
                  ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900")
              }
            >
              {mode === "diff" ? "Back" : "Compare"}
            </button>
          )}
          {mode === "single" && isLatest && (
            <GenerateReviewForm
              startupId={startupId}
              hasDeck={hasDeck}
              hasReview={Boolean(latest)}
              autoTrigger={autoTrigger}
            />
          )}
        </div>
      </div>

      {mode === "single" && isLatest && <ReviewRegeneratingBanner />}

      {versions.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {hasDeck
            ? "Generate a review to see the AI's take on this startup."
            : "Upload a deck first, then generate a review."}
        </p>
      )}

      {versions.length > 0 && mode === "single" && selected && (
        <>
          {!isLatest && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
              <span>
                Viewing version {selected.version} of {versions.length} —
                historical, not editable.
              </span>
              <button
                type="button"
                onClick={() => setPinnedVersionId(null)}
                className="shrink-0 font-medium underline hover:no-underline"
              >
                Jump to latest
              </button>
            </div>
          )}
          <ReviewContent
            startupId={startupId}
            version={selected}
            readOnly={!isLatest}
          />
        </>
      )}

      {versions.length > 1 && mode === "diff" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <select
              value={diffOlder?.id ?? ""}
              onChange={(event) => setDiffOlderId(event.target.value)}
              className={selectClass}
              aria-label="Compare from version"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {versionLabel(v, v.id === latest?.id)}
                </option>
              ))}
            </select>
            <span className="text-zinc-400 dark:text-zinc-500">→</span>
            <select
              value={diffNewer?.id ?? ""}
              onChange={(event) => setDiffNewerId(event.target.value)}
              className={selectClass}
              aria-label="Compare to version"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {versionLabel(v, v.id === latest?.id)}
                </option>
              ))}
            </select>
          </div>

          {diff ? (
            <ReviewDiffView diff={diff} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Pick two different versions to compare.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
