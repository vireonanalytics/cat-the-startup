"use client";

import { useState, useTransition } from "react";
import { getDeckDownloadUrl } from "@/app/(app)/startups/[id]/actions";

export function DownloadDeckButton({ startupId }: { startupId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);

    // Open the tab synchronously, inside the click handler, so the browser
    // treats it as a direct user gesture. Opening it only after the async
    // server action resolves loses that association and gets silently
    // blocked as a popup by most browsers.
    const downloadWindow = window.open("", "_blank");

    startTransition(async () => {
      const result = await getDeckDownloadUrl(startupId);
      if ("error" in result) {
        setError(result.error);
        downloadWindow?.close();
        return;
      }
      if (downloadWindow) {
        downloadWindow.location.href = result.url;
      } else {
        // Popup was blocked despite the synchronous open attempt - fall
        // back to navigating the current tab.
        window.location.href = result.url;
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {isPending ? "Preparing…" : "Download"}
      </button>
      {error && (
        <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
      )}
    </span>
  );
}
