"use client";

import type { StartupStatus } from "@/lib/supabase/types";
import { updateStartupStatus } from "@/app/(app)/startups/[id]/actions";

export const STATUS_OPTIONS: { value: StartupStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "passed", label: "Passed" },
  { value: "investing", label: "Investing" },
];

export function StatusForm({
  id,
  status,
}: {
  id: string;
  status: StartupStatus;
}) {
  // "Passed" is deliberately not a choice here - the only way in is the
  // dedicated graveyard button on this page (see MoveToGraveyardButton).
  // Once a startup *is* passed, the dropdown is replaced entirely (below)
  // rather than just excluding "passed" from its options - leaving the
  // other three selectable let an analyst switch straight back out via this
  // same control, which defeats the graveyard being the one deliberate
  // path both in and out (restoring lives on /passed - see
  // RestoreStartupButton).
  if (status === "passed") {
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          Status
        </span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Passed
        </span>
      </span>
    );
  }

  const options = STATUS_OPTIONS.filter((option) => option.value !== "passed");

  return (
    <form action={updateStartupStatus} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label
        htmlFor="status"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Status
      </label>
      <select
        id="status"
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}
