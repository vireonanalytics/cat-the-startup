"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteComment } from "@/app/(app)/startups/[id]/actions";
import { useReviewRegeneration } from "@/components/review-regeneration-context";
import { useMascot } from "@/components/mascot-context";

// Lets the swipe-away animation actually play before the item disappears -
// without this, a fast network response would remove the row before the
// companion's swipe gets a chance to play out.
const SWIPE_ANIMATION_MS = 700;

export interface EvidenceListItem {
  id: string;
  label: string | null;
  extracted_text: string | null;
  uploaded_at: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const PREVIEW_LENGTH = 220;

export function EvidenceList({
  startupId,
  items,
}: {
  startupId: string;
  items: EvidenceListItem[];
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Confirmation is a second in-app click rather than window.confirm() -
  // native dialogs can be silently suppressed by browser settings,
  // extensions, or embedded contexts, which would make delete look broken
  // with no error and no way to tell why.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { notifyRegenerationStarted } = useReviewRegeneration();
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!deletingId) return;
    return pushActivity("swiping", "Sweeping that one away…");
  }, [deletingId, pushActivity]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No evidence yet. Add a call transcript or a verified fact - it&apos;s
        included the next time the review runs.
      </p>
    );
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleDelete(id: string) {
    setError(null);
    setConfirmingId(null);
    setDeletingId(id);

    // The swipe animation plays first; the actual delete request fires once
    // it's done so the cat is never removed from the DOM before it's seen.
    setTimeout(() => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("startup_id", startupId);

      startTransition(async () => {
        const result = await deleteComment(formData);
        setDeletingId(null);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        if (result.reviewRegenerating) {
          notifyRegenerationStarted();
        }
      });
    }, SWIPE_ANIMATION_MS);
  }

  return (
    <div>
      {error && (
        <p className="mb-2 text-xs text-red-700 dark:text-red-400">{error}</p>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const text = item.extracted_text ?? "";
          const isExpanded = expandedIds.has(item.id);
          const isLong = text.length > PREVIEW_LENGTH;

          const isDeleting = deletingId === item.id;

          return (
            <li
              key={item.id}
              className={
                "relative rounded-lg border-l-2 border-l-emerald-500 border-y border-r border-black/10 bg-white p-3 transition-all duration-300 ease-in dark:border-white/10 dark:bg-zinc-950 " +
                (isDeleting
                  ? "translate-x-6 opacity-0"
                  : "translate-x-0 opacity-100")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                      {item.label ?? "Untitled evidence"}
                    </p>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      Evidence
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Added {formatDate(item.uploaded_at)}
                  </p>
                </div>

                {confirmingId === item.id ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Delete?
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={isPending}
                      className="text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                    >
                      {isPending ? "…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={isPending}
                      className="text-xs text-zinc-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(item.id)}
                    className="shrink-0 text-xs text-red-700 hover:underline dark:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {isExpanded || !isLong
                  ? text
                  : `${text.slice(0, PREVIEW_LENGTH)}…`}
              </p>

              {isLong && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.id)}
                  className="mt-1 text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  {isExpanded ? "Show less" : "Show full text"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
