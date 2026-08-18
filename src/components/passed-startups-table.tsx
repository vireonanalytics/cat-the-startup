"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { updateStartupStatus } from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";

const RECALL_DURATION_MS = 5000;

export interface PassedStartupRow {
  id: string;
  name: string;
  sector: string | null;
  stage: string | null;
  ask_amount: number | null;
  created_at: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAsk(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// Clicking a row makes the companion cat (see mascot-companion.tsx, docked
// in the rail on this same page) "remember" the single most-cited reason
// this one didn't make the cut - the review's own top why-not point (see
// PassedPage, which passes it down keyed by startup id). Routed through the
// same pushActivity stack every other cat reaction uses, on a timer rather
// than tied to a pending async operation (there's no operation here, just a
// few seconds of recall) - same self-clearing pattern as the shy click
// easter egg in mascot-companion.tsx, just living in the global stack
// instead of that component's local state since this table and the
// companion are different parts of the tree.
export function PassedStartupsTable({
  startups,
  reasons,
}: {
  startups: PassedStartupRow[];
  reasons: Record<string, string>;
}) {
  const { pushActivity } = useMascot();
  const [activeId, setActiveId] = useState<string | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleRowClick(startup: PassedStartupRow) {
    cleanupRef.current();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const reason = reasons[startup.id];
    const message = reason
      ? `Remembers passing on ${startup.name}: “${reason}”`
      : `Remembers passing on ${startup.name}, though the details are fuzzy now.`;

    setActiveId(startup.id);
    cleanupRef.current = pushActivity("graveyard", message);
    timeoutRef.current = setTimeout(() => {
      cleanupRef.current();
      cleanupRef.current = () => {};
      setActiveId(null);
    }, RECALL_DURATION_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Click a startup to have the cat remember why.
      </p>
      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Sector
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Stage
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Ask
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {startups.map((startup) => (
              <tr
                key={startup.id}
                onClick={() => handleRowClick(startup)}
                className={
                  "cursor-pointer border-b border-black/5 last:border-0 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-zinc-900/50" +
                  (activeId === startup.id ? " bg-zinc-50 dark:bg-zinc-900/50" : "")
                }
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/startups/${startup.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
                  >
                    {startup.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {startup.sector ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {startup.stage ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {formatAsk(startup.ask_amount)}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {formatDate(startup.created_at)}
                </td>
                <td className="px-4 py-3">
                  {/* The only path back out of the graveyard (see
                      StatusForm, which no longer offers other statuses once
                      a startup is passed) - restoring is a deliberate act
                      that belongs here, not a stray dropdown click on the
                      startup's own page. */}
                  <form
                    action={updateStartupStatus}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input type="hidden" name="id" value={startup.id} />
                    <input type="hidden" name="status" value="new" />
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Restore
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
