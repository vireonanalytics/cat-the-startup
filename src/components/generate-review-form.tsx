"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { generateReview } from "@/app/(app)/startups/[id]/actions";
import { useReviewRegeneration } from "@/components/review-regeneration-context";

function GenerateButton({
  hasReview,
  disabled,
}: {
  hasReview: boolean;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  // Routes through the same activity push (and the same long-wait apology
  // handling) as a background regeneration, rather than pushing its own -
  // that split used to mean a manual click never got the "still working on
  // it" apology no matter how long it ran, since nothing here tracked wait
  // time at all.
  const { notifyRegenerationStarted, notifyRegenerationFinished } =
    useReviewRegeneration();
  // Only clear the activity on a pending true -> false transition that this
  // button itself caused - `pending` starts (and often sits) at false, and
  // unconditionally calling notifyRegenerationFinished on every false would
  // also cut off a background regeneration this button had nothing to do
  // with (see maybeTriggerBackgroundRegeneration).
  const startedRef = useRef(false);

  useEffect(() => {
    if (pending) {
      startedRef.current = true;
      notifyRegenerationStarted();
    } else if (startedRef.current) {
      startedRef.current = false;
      notifyRegenerationFinished();
    }
  }, [pending, notifyRegenerationStarted, notifyRegenerationFinished]);

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
    >
      {pending ? "Generating…" : hasReview ? "Regenerate" : "Generate Review"}
    </button>
  );
}

export function GenerateReviewForm({
  startupId,
  hasDeck,
  hasReview,
  autoTrigger = false,
}: {
  startupId: string;
  hasDeck: boolean;
  hasReview: boolean;
  /** True right after a deck-based startup creation redirects here (see
   * processNewDeckAndExtractStartupInfo's ?autogen=1). Submits this form on
   * mount exactly as if the analyst had clicked it themselves - same code
   * path, same mascot activity - so uploading a deck lands the analyst on
   * the new startup's page and shows the review writing itself in place,
   * instead of holding them on the upload page for the review's own
   * 30-90s on top of extraction's. */
  autoTrigger?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasAutoTriggeredRef = useRef(false);

  useEffect(() => {
    if (!autoTrigger || hasAutoTriggeredRef.current) return;
    hasAutoTriggeredRef.current = true;
    formRef.current?.requestSubmit();

    // Strips only ?autogen=1, not the whole query string - an ?error=
    // alongside it (e.g. extraction failed but the deck still ingested
    // fine, so this still fires) needs to survive for ErrorBanner to show
    // it, and a reload after this point shouldn't resubmit the form.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("autogen");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger]);

  return (
    <form ref={formRef} action={generateReview}>
      <input type="hidden" name="startup_id" value={startupId} />
      <GenerateButton hasReview={hasReview} disabled={!hasDeck} />
    </form>
  );
}
