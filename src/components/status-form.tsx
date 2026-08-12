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
  // dedicated graveyard button on this page (see MoveToGraveyardButton),
  // which also logs the audit-trail entry and shows the "still in the
  // graveyard" note, neither of which a bare dropdown change would do.
  // Still included when the startup is *already* passed, purely so its
  // dropdown shows that real current value instead of silently falling
  // back to whichever option happens to be listed first.
  const options = STATUS_OPTIONS.filter(
    (option) => option.value !== "passed" || status === "passed"
  );

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
