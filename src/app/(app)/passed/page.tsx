import { createClient } from "@/lib/supabase/server";
import { Mascot } from "@/components/mascot";
import { PassedStartupsTable } from "@/components/passed-startups-table";

export default async function PassedPage() {
  const supabase = await createClient();
  const { data: startups, error } = await supabase
    .from("startups")
    .select("id, name, sector, stage, ask_amount, created_at")
    .eq("status", "passed")
    .order("created_at", { ascending: false });

  const startupIds = (startups ?? []).map((startup) => startup.id);

  // The single most-cited reason each one didn't make the cut, for the
  // "click a row to recall why" interaction below (see
  // PassedStartupsTable) - the review's own top why-not point, keyed by
  // startup id. Ordered oldest-version-first and overwritten per id on the
  // way through, so whichever review version is highest for a given
  // startup is the one left standing in the map.
  const reasons: Record<string, string> = {};
  if (startupIds.length > 0) {
    const { data: reviewRows } = await supabase
      .from("reviews")
      .select("startup_id, why_not")
      .in("startup_id", startupIds)
      .order("version", { ascending: true });

    for (const row of reviewRows ?? []) {
      const topReason = row.why_not?.[0]?.point;
      if (topReason) {
        reasons[row.startup_id] = topReason;
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          The graveyard
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Passed deals, resting here in case you ever want to look back.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Failed to load passed startups: {error.message}
        </div>
      )}

      {!error && startups && startups.length === 0 && (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <Mascot pose="idle" size={80} className="mb-3" priority />
          <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
            Nothing here yet.
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Startups you pass on will rest here instead of just disappearing.
          </p>
        </div>
      )}

      {!error && startups && startups.length > 0 && (
        <>
          <div className="flex flex-col items-center rounded-xl border border-black/10 bg-gradient-to-b from-white to-zinc-50 py-10 text-center dark:border-white/10 dark:from-zinc-950 dark:to-zinc-900">
            <Mascot pose="graveyard" size={220} priority />
            <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {startups.length} startup{startups.length === 1 ? "" : "s"}{" "}
              {startups.length === 1 ? "has" : "have"} passed through here
            </p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Not gone, just resting. Everything you&apos;ve passed on stays
              here if you ever want to look back.
            </p>
          </div>

          <PassedStartupsTable startups={startups} reasons={reasons} />
        </>
      )}
    </div>
  );
}
