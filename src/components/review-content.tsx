import { ContradictionsSection } from "@/components/contradictions-section";
import type { ReviewVersionData } from "@/lib/review-diff";
import type { Verdict } from "@/lib/supabase/types";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function verdictClass(verdict: Verdict): string {
  switch (verdict) {
    case "Strong yes":
    case "Promising":
      return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400";
    case "Needs diligence":
      return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400";
    case "Weak fit":
    case "Pass":
      return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-400";
    // Deliberately not red like Weak fit/Pass - this isn't a judgment on
    // the company (see buildReviewPrompt), just a factual state that reads
    // as one at a glance if it shares their color.
    case "No live opportunity":
      return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

// The full single-version display - verdict/thesis/snapshot through
// why_invest/why_not/contradictions/unknowns. Shared by the normal
// (current) view and by historical-version viewing, which differ only in
// whether contradictions can be dismissed here (see readOnly).
export function ReviewContent({
  startupId,
  version,
  readOnly,
}: {
  startupId: string;
  version: ReviewVersionData;
  readOnly: boolean;
}) {
  return (
    <>
      <div className="mb-6 flex gap-4 border-b border-black/10 pb-5 dark:border-white/10">
        <span
          className={
            "h-fit shrink-0 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide " +
            verdictClass(version.verdict)
          }
        >
          {version.verdict}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-relaxed text-zinc-900 dark:text-zinc-100">
            {version.thesis}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {version.snapshot}
          </p>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            Generated {formatDate(version.generated_at)} from{" "}
            {version.provenance || "the deck"}.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Why invest
          </h3>
          <ul className="flex flex-col gap-3">
            {version.why_invest.map((item, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-zinc-950 dark:text-zinc-50">
                  {item.point}
                </p>
                <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
                  {item.evidence}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
            Why not
          </h3>
          <ul className="flex flex-col gap-3">
            {version.why_not.map((item, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-zinc-950 dark:text-zinc-50">
                  {item.point}
                </p>
                <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
                  {item.evidence}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ContradictionsSection
        startupId={startupId}
        reviewId={version.id}
        contradictions={version.contradictions}
        dismissedIndices={version.dismissed_contradiction_indices}
        readOnly={readOnly}
      />

      {version.unknowns.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Unknowns
          </h3>
          <div className="flex flex-wrap gap-2">
            {version.unknowns.map((item, i) => (
              <span
                key={i}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
