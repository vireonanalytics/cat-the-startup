import { createStartup } from "./actions";
import { CreateFromDeckForm } from "@/components/create-from-deck-form";
import { CreateStartupSubmitButton } from "@/components/create-startup-submit-button";
import { SECTORS, STAGES } from "@/lib/constants";

export default async function NewStartupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Add a startup
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Log a new inbound startup for your team to triage.
      </p>

      {params.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {params.error}
        </div>
      )}

      <form
        action={createStartup}
        className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Name
          <input
            type="text"
            name="name"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="Acme Inc."
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Domain
          <input
            type="text"
            name="domain"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="acme.com"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Founder names (optional)
          <input
            type="text"
            name="founder_names"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="Jane Doe, John Smith"
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            Used for public-data enrichment - never sent from deck or transcript text.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Sector
          <select
            name="sector"
            defaultValue=""
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="" disabled>
              Select a sector
            </option>
            {SECTORS.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Stage
          <select
            name="stage"
            defaultValue=""
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="" disabled>
              Select a stage
            </option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Ask amount (USD)
          <input
            type="number"
            name="ask_amount"
            min="0"
            step="1000"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="1000000"
          />
        </label>

        <CreateStartupSubmitButton />
      </form>

      <div className="my-6 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        or
        <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>

      <CreateFromDeckForm />
    </div>
  );
}
