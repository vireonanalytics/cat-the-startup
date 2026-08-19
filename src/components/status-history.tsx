"use client";

import { useState } from "react";
import { getStatusHistory, type StatusChangeEntry } from "@/app/(app)/startups/[id]/actions";
import { STATUS_OPTIONS } from "@/components/status-form";
import type { StartupStatus } from "@/lib/supabase/types";

function statusLabel(value: string | null): string {
  if (!value) return "Unknown";
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// timeZone: "UTC" pinned so this always agrees with what the server
// rendered - without it, server (Vercel, UTC) and a browser in a
// different timezone can disagree on which calendar date a timestamp near
// midnight UTC falls on, which is a real, reproduced hydration mismatch
// (React error #418).
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// A small popover next to the status dropdown (see startup-header.tsx) -
// who changed a startup's status and when, previously untracked entirely
// (see getStatusHistory / Step 16 in schema.sql). Same click-outside-to-
// close popover pattern as FoundersChip; loads lazily on first open rather
// than on every page load, since most visits never open it.
export function StatusHistory({ startupId }: { startupId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<StatusChangeEntry[] | null>(null);

  function handleOpen() {
    setIsOpen(true);
    if (entries === null) {
      getStatusHistory(startupId).then(setEntries);
    }
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-zinc-400 hover:text-zinc-700 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        History
      </button>
      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close status history"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-black/10 bg-white p-3 text-left shadow-lg dark:border-white/10 dark:bg-zinc-900">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Status history
            </p>
            {entries === null ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No changes recorded yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {entries.map((entry, i) => (
                  <li key={i} className="text-sm">
                    <p className="text-zinc-700 dark:text-zinc-300">
                      {entry.from_status ? (
                        <>
                          {statusLabel(entry.from_status)}
                          {" → "}
                        </>
                      ) : null}
                      <span className="font-medium text-zinc-950 dark:text-zinc-50">
                        {statusLabel(entry.to_status as StartupStatus)}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {entry.changed_by?.name ?? "Unknown"} ·{" "}
                      {formatDate(entry.changed_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </span>
  );
}
