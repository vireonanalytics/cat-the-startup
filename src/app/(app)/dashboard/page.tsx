import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StartupsTable } from "@/components/startups-table";
import { Mascot } from "@/components/mascot";

export default async function DashboardPage() {
  const supabase = await createClient();
  // Passed startups live in the graveyard (see /passed), not here - without
  // this filter they never actually left the dashboard, just gained a
  // "passed" badge, which is exactly the disappearing-into-the-graveyard
  // behavior the status change is supposed to produce.
  const { data: startups, error } = await supabase
    .from("startups")
    .select("id, name, sector, stage, status, ask_amount, created_at")
    .neq("status", "passed")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Startups
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            All inbound startups for your team.
          </p>
        </div>
        <Link
          href="/startups/new"
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          + Add startup
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Failed to load startups: {error.message}
        </div>
      )}

      {!error && startups && startups.length === 0 && (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <Mascot pose="idle" size={96} className="mb-3" priority />
          <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
            No startups yet.
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Add your first one and I&apos;ll get to work —{" "}
            <Link href="/startups/new" className="font-medium underline">
              add a startup
            </Link>
            .
          </p>
        </div>
      )}

      {!error && startups && startups.length > 0 && (
        <StartupsTable startups={startups} />
      )}
    </div>
  );
}
