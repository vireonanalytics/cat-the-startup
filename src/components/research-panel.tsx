"use client";

import { useEffect, useState, useTransition } from "react";
import { enrichStartup } from "@/app/(app)/startups/[id]/actions";
import { useReviewRegeneration } from "@/components/review-regeneration-context";
import { useMascot } from "@/components/mascot-context";
import type { ResearchDepth } from "@/lib/constants";
import type { KeyFinding } from "@/lib/supabase/types";

const DEPTH_OPTIONS: { depth: ResearchDepth; label: string; hint: string }[] = [
  { depth: "fast", label: "Fast", hint: "2-3 facts" },
  { depth: "medium", label: "Medium", hint: "4-6 facts" },
  { depth: "extended", label: "Extended", hint: "5-10+ facts" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Shows just the site's hostname (e.g. "techcrunch.com") as a compact,
// scannable link label instead of the full URL.
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface EnrichmentFindingSummary {
  key_findings: KeyFinding[];
  created_at: string;
}

export function ResearchPanel({
  startupId,
  enrichment,
}: {
  startupId: string;
  enrichment: EnrichmentFindingSummary | null;
}) {
  const findings = enrichment?.key_findings ?? [];
  const [isPending, startTransition] = useTransition();
  const [pendingDepth, setPendingDepth] = useState<ResearchDepth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { notifyRegenerationStarted } = useReviewRegeneration();
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!isPending) return;
    return pushActivity(
      "researching",
      "Looking this startup up online for recent news and rounds…"
    );
  }, [isPending, pushActivity]);

  function handleClick(depth: ResearchDepth) {
    setError(null);
    setPendingDepth(depth);

    const formData = new FormData();
    formData.set("startup_id", startupId);
    formData.set("depth", depth);

    startTransition(async () => {
      const result = await enrichStartup(formData);
      setPendingDepth(null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.reviewRegenerating) {
        notifyRegenerationStarted();
      }
    });
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Online research
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {enrichment
            ? `Fetched ${formatDate(enrichment.created_at)} from public web sources`
            : "Searches the web for funding history, founder backgrounds, recent news, and competitors, using only this startup's name, domain, and founder names - never deck or evidence content."}
        </p>

        <div className="mt-3">
          <div className="flex gap-2">
            {DEPTH_OPTIONS.map((option) => {
              const isThisPending = pendingDepth === option.depth;
              return (
                <button
                  key={option.depth}
                  type="button"
                  onClick={() => handleClick(option.depth)}
                  disabled={isPending}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-md border border-zinc-300 px-3 py-2 text-center transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {isThisPending ? "…" : option.label}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {isThisPending
                      ? "Researching"
                      : enrichment
                        ? option.hint
                        : `Enrich · ${option.hint}`}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
            Research time increases from Fast to Extended - Fast runs a few
            targeted searches, Extended searches as thoroughly as possible.
          </p>
          {error && (
            <p className="mt-1.5 text-xs text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>

      {enrichment && findings.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No verifiable public findings turned up for this search.
        </p>
      )}

      {findings.length > 0 && (
        <ul className="flex flex-col gap-3">
          {findings.map((finding, i) => (
            <li
              key={i}
              className="rounded-lg border border-black/10 bg-zinc-50 px-3 py-2.5 dark:border-white/10 dark:bg-zinc-900/50"
            >
              <p className="text-sm text-zinc-800 dark:text-zinc-200">
                {finding.point}
              </p>
              <a
                href={finding.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {finding.source_name} · {hostnameOf(finding.url)} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
