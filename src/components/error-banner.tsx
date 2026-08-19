"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Covers every ?error= message landed on this page (extraction failures,
// the duplicate-name warning, etc.) - previously a bare server-rendered
// div with no way to close it. An analyst who deliberately wants a second
// entry for the same company (different materials, a later round) has no
// reason to keep a stale "already exists" warning pinned to the page once
// they've read it.
export function ErrorBanner({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    // Local state alone doesn't survive a router.refresh() - e.g. a deck
    // upload's own auto-triggered review generation (see
    // GenerateReviewForm) landing while this is still up would re-render
    // this same ?error= from the URL and bring the "dismissed" banner
    // right back. Stripping the param makes the dismissal actually stick.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      <span>{message}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-red-400 hover:text-red-700 dark:text-red-500 dark:hover:text-red-200"
      >
        ✕
      </button>
    </div>
  );
}
