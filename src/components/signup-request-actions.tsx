"use client";

import { useState } from "react";
import {
  approveSignupRequest,
  rejectSignupRequest,
} from "@/app/(app)/admin/requests/actions";

// Confirmation is a second in-app click rather than window.confirm() - same
// reasoning as the app's other destructive/high-stakes actions. Approving
// is the one that actually creates a real, usable account, so it gets the
// same care as deleting something.
export function SignupRequestActions({ requestId }: { requestId: string }) {
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(
    null
  );

  if (confirming === "approve") {
    return (
      <form action={approveSignupRequest} className="flex items-center gap-2">
        <input type="hidden" name="id" value={requestId} />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Create this account?
        </span>
        <button
          type="submit"
          className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setConfirming(null)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </form>
    );
  }

  if (confirming === "reject") {
    return (
      <form action={rejectSignupRequest} className="flex items-center gap-2">
        <input type="hidden" name="id" value={requestId} />
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Reject this request?
        </span>
        <button
          type="submit"
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setConfirming(null)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setConfirming("approve")}
        className="rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => setConfirming("reject")}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950"
      >
        Reject
      </button>
    </span>
  );
}
