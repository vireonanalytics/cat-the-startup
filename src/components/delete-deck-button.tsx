"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteDeck } from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";

// Confirmation is a second in-app click rather than window.confirm() -
// native dialogs can be silently suppressed by browser settings,
// extensions, or embedded contexts, which would make delete look broken
// with no error and no way to tell why.
export function DeleteDeckButton({
  documentId,
  startupId,
}: {
  documentId: string;
  startupId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!isPending) return;
    return pushActivity("swiping", "Clearing out the old deck…");
  }, [isPending, pushActivity]);

  function handleConfirm() {
    const formData = new FormData();
    formData.set("id", documentId);
    formData.set("startup_id", startupId);
    startTransition(async () => {
      await deleteDeck(formData);
    });
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Delete deck?
        </span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          {isPending ? "…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950"
    >
      Delete deck
    </button>
  );
}
