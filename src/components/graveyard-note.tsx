"use client";

import { useState } from "react";
import Link from "next/link";

// Shown once, right after MoveToGraveyardButton's redirect lands back on
// this page with ?graveyard=1 (see updateStartupStatus) - a passed startup
// disappears from the dashboard's default view, and without this an analyst
// has no on-screen confirmation of where it actually went.
export function GraveyardNote() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      <span>
        🐾 Sent to the graveyard — you can still find it under{" "}
        <Link
          href="/passed"
          className="font-medium underline-offset-2 hover:underline"
        >
          Passed
        </Link>{" "}
        anytime.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
      >
        ✕
      </button>
    </div>
  );
}
