"use client";

import { useEffect, useState, useTransition } from "react";
import { exportMemo } from "@/app/(app)/startups/[id]/memo-actions";
import { useMascot } from "@/components/mascot-context";

// Unlike DownloadDeckButton, this doesn't need the synchronous
// window.open()-before-await popup-safe dance - the memo is generated fresh
// on each click and returned as base64, then turned into a same-tab Blob
// download (an <a download> click, not a new-tab navigation), which
// browsers don't treat as a popup regardless of the async gap before it.
export function ExportMemoButton({ startupId }: { startupId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!isPending) return;
    return pushActivity("carrying", "Packing up the memo…");
  }, [isPending, pushActivity]);

  function handleClick() {
    setError(null);

    startTransition(async () => {
      const result = await exportMemo(startupId);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      const byteChars = atob(result.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        bytes[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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
        {isPending ? "Packing up the memo…" : "Export memo"}
      </button>
      {error && (
        <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
      )}
    </span>
  );
}
