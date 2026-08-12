"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useMascot } from "@/components/mascot-context";

// The manual "Add a startup" form (see new/page.tsx) had no cat reaction at
// all - only its sibling "create from a pitch deck" flow did (see
// CreateFromDeckForm's "reading" pose). Same pushActivity-on-pending
// pattern as everywhere else, just tied to useFormStatus instead of a
// useTransition pending flag, since this button lives inside a plain
// server-action <form> rather than a client-driven submit.
export function CreateStartupSubmitButton() {
  const { pending } = useFormStatus();
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!pending) return;
    return pushActivity("writing", "Jotting this one down…");
  }, [pending, pushActivity]);

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
    >
      {pending ? "Adding…" : "Add startup"}
    </button>
  );
}
