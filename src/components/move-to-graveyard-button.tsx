"use client";

import { useEffect, useState, useTransition } from "react";
import { updateStartupStatus } from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";

// Startups are never hard-deleted (there used to be a DeleteStartupButton
// that did exactly that, cascading to reviews/documents/enrichment - it's
// gone now). This is the *only* path to "passed" - the status dropdown
// deliberately excludes it (see StatusForm) so nobody lands a startup in
// the graveyard by absent-mindedly clicking through the dropdown. "Pass on
// startup" rather than "Move to graveyard": it names the actual triage
// decision an analyst is making, not the storage mechanics behind it - the
// post-confirm note (see GraveyardNote, shown via the ?graveyard=1 redirect
// in updateStartupStatus) is what tells them where it went. Red styling
// (matching the app's other red/destructive controls) even though the
// change is fully reversible via that same dropdown and now logged (see
// status-history.tsx) - it's still the one button on this page that ends a
// deal's active consideration, and should read as a deliberate, weighty
// action rather than a routine one. Confirmation is still a second
// in-app click for the same reason - a real triage decision, not
// something a stray click should make.
export function MoveToGraveyardButton({ startupId }: { startupId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!isPending) return;
    return pushActivity("carrying", "Carrying this one off to the graveyard…");
  }, [isPending, pushActivity]);

  function handleConfirm() {
    const formData = new FormData();
    formData.set("id", startupId);
    formData.set("status", "passed");
    startTransition(async () => {
      await updateStartupStatus(formData);
    });
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Pass on this startup?
        </span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
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
      className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
    >
      Pass on startup
    </button>
  );
}
