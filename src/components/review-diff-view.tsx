import type { ReviewDiff } from "@/lib/review-diff";
import type { Contradiction, ReviewPoint } from "@/lib/supabase/types";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ChangeRow({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
        {label} changed
      </p>
      <p className="text-zinc-500 line-through dark:text-zinc-400">{from}</p>
      <p className="mt-0.5 text-zinc-950 dark:text-zinc-50">{to}</p>
    </div>
  );
}

function PointList({
  title,
  added,
  removed,
  accentClass,
}: {
  title: string;
  added: ReviewPoint[];
  removed: ReviewPoint[];
  accentClass: string;
}) {
  if (added.length === 0 && removed.length === 0) return null;

  return (
    <div>
      <h4 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${accentClass}`}>
        {title}
      </h4>
      <ul className="flex flex-col gap-2">
        {added.map((item, i) => (
          <li key={`added-${i}`} className="text-sm">
            <span className="mr-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              +
            </span>
            <span className="font-medium text-zinc-950 dark:text-zinc-50">
              {item.point}
            </span>
            <p className="ml-4 text-zinc-500 dark:text-zinc-400">
              {item.evidence}
            </p>
          </li>
        ))}
        {removed.map((item, i) => (
          <li key={`removed-${i}`} className="text-sm opacity-70">
            <span className="mr-1.5 font-semibold text-red-600 dark:text-red-400">
              −
            </span>
            <span className="font-medium text-zinc-700 line-through dark:text-zinc-300">
              {item.point}
            </span>
            <p className="ml-4 text-zinc-500 line-through dark:text-zinc-500">
              {item.evidence}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContradictionList({
  added,
  removed,
}: {
  added: Contradiction[];
  removed: Contradiction[];
}) {
  if (added.length === 0 && removed.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Contradictions
      </h4>
      <ul className="flex flex-col gap-2">
        {added.map((item, i) => (
          <li
            key={`added-${i}`}
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm dark:border-emerald-900 dark:bg-emerald-950"
          >
            <p className="font-medium text-zinc-950 dark:text-zinc-50">
              <span className="mr-1 font-semibold text-emerald-600 dark:text-emerald-400">
                New:
              </span>
              {item.point}
            </p>
          </li>
        ))}
        {removed.map((item, i) => (
          <li
            key={`removed-${i}`}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-sm opacity-70 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="font-medium text-zinc-700 dark:text-zinc-300">
              <span className="mr-1 font-semibold text-red-600 dark:text-red-400">
                Resolved:
              </span>
              {item.point}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChipDiff({
  title,
  added,
  removed,
}: {
  title: string;
  added: string[];
  removed: string[];
}) {
  if (added.length === 0 && removed.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {added.map((item, i) => (
          <span
            key={`added-${i}`}
            className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          >
            + {item}
          </span>
        ))}
        {removed.map((item, i) => (
          <span
            key={`removed-${i}`}
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 line-through dark:bg-zinc-900 dark:text-zinc-500"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReviewDiffView({ diff }: { diff: ReviewDiff }) {
  const nothingChanged =
    !diff.verdictChanged &&
    !diff.thesisChanged &&
    !diff.snapshotChanged &&
    diff.whyInvest.added.length === 0 &&
    diff.whyInvest.removed.length === 0 &&
    diff.whyNot.added.length === 0 &&
    diff.whyNot.removed.length === 0 &&
    diff.contradictions.added.length === 0 &&
    diff.contradictions.removed.length === 0 &&
    diff.unknowns.added.length === 0 &&
    diff.unknowns.removed.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Comparing v{diff.older.version} ({formatDate(diff.older.generated_at)})
        {" → "}
        v{diff.newer.version} ({formatDate(diff.newer.generated_at)})
      </p>

      {nothingChanged && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No meaningful differences between these two versions.
        </p>
      )}

      {diff.verdictChanged && (
        <ChangeRow
          label="Verdict"
          from={diff.older.verdict}
          to={diff.newer.verdict}
        />
      )}
      {diff.thesisChanged && (
        <ChangeRow
          label="Thesis"
          from={diff.older.thesis}
          to={diff.newer.thesis}
        />
      )}
      {diff.snapshotChanged && (
        <ChangeRow
          label="Snapshot"
          from={diff.older.snapshot}
          to={diff.newer.snapshot}
        />
      )}

      <PointList
        title="Why invest"
        added={diff.whyInvest.added}
        removed={diff.whyInvest.removed}
        accentClass="text-emerald-700 dark:text-emerald-400"
      />
      <PointList
        title="Why not"
        added={diff.whyNot.added}
        removed={diff.whyNot.removed}
        accentClass="text-red-700 dark:text-red-400"
      />
      <ContradictionList
        added={diff.contradictions.added}
        removed={diff.contradictions.removed}
      />
      <ChipDiff
        title="Unknowns"
        added={diff.unknowns.added}
        removed={diff.unknowns.removed}
      />
    </div>
  );
}
