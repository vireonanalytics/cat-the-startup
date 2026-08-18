"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateStartup } from "@/app/(app)/startups/[id]/actions";
import { StatusForm } from "@/components/status-form";
import { StatusHistory } from "@/components/status-history";
import { ExportMemoButton } from "@/components/export-memo-button";
import { MoveToGraveyardButton } from "@/components/move-to-graveyard-button";
import { SECTORS, STAGES } from "@/lib/constants";
import type { KeyFinding, StartupStatus } from "@/lib/supabase/types";

function formatAsk(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseFounders(founderNames: string | null): string[] {
  if (!founderNames) return [];
  return founderNames
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Only ever links to a LinkedIn URL that the app's own verified web search
// already surfaced for this startup (see enrichStartup in actions.ts, which
// discards any URL the search results didn't actually return) - never a
// guessed or constructed URL. If public research never found a founder's
// LinkedIn, this returns null and the founder is shown with no link, rather
// than a search-engine shortcut dressed up as "their LinkedIn."
function findFounderLinkedIn(name: string, keyFindings: KeyFinding[]): string | null {
  const needle = name.toLowerCase();
  const match = keyFindings.find(
    (f) =>
      f.url.toLowerCase().includes("linkedin.com") &&
      (f.point.toLowerCase().includes(needle) ||
        f.source_name.toLowerCase().includes(needle))
  );
  return match?.url ?? null;
}

function chipClass(warn?: boolean) {
  return (
    "inline-flex items-baseline gap-1 rounded-full border px-3 py-1 text-xs " +
    (warn
      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
      : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400")
  );
}

function DomainChip({ domain }: { domain: string | null }) {
  if (!domain) {
    return <Chip label="Domain" value="—" />;
  }
  return (
    <span className={chipClass()}>
      Domain
      <a
        href={`https://${domain}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-zinc-950 underline-offset-2 hover:underline dark:text-zinc-50"
      >
        {domain}
      </a>
    </span>
  );
}

function FoundersChip({
  founderNames,
  keyFindings,
}: {
  founderNames: string | null;
  keyFindings: KeyFinding[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const founders = parseFounders(founderNames);

  if (founders.length === 0) {
    return <Chip label="Founders" value="—" />;
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={chipClass() + " cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"}
      >
        Founders
        <b className="font-semibold text-zinc-950 dark:text-zinc-50">
          {founders.length}
        </b>
      </button>
      {isOpen && (
        <>
          {/* Click-outside catcher, same pattern as a native <details> but
              with real content control over the popover below. */}
          <button
            type="button"
            aria-label="Close founders list"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-black/10 bg-white p-2 text-left shadow-lg dark:border-white/10 dark:bg-zinc-900">
            <ul className="flex flex-col">
              {founders.map((name) => {
                const linkedIn = findFounderLinkedIn(name, keyFindings);
                return (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <span>{name}</span>
                    {linkedIn ? (
                      <a
                        href={linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
                      >
                        LinkedIn
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">
                        No LinkedIn found
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </span>
  );
}

function Chip({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <span className={chipClass(warn)}>
      {label}
      <b
        className={
          "font-semibold " +
          (warn
            ? "text-amber-900 dark:text-amber-300"
            : "text-zinc-950 dark:text-zinc-50")
        }
      >
        {value}
      </b>
    </span>
  );
}

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelClass =
  "flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300";

export interface StartupHeaderInfo {
  id: string;
  name: string;
  domain: string | null;
  sector: string | null;
  stage: string | null;
  ask_amount: number | null;
  founder_names: string | null;
  status: StartupStatus;
}

export function StartupHeader({
  startup,
  lastRoundSummary,
  contradictionsCount,
  keyFindings,
}: {
  startup: StartupHeaderInfo;
  lastRoundSummary: string | null;
  contradictionsCount: number | null;
  keyFindings: KeyFinding[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("startup_id", startup.id);

    startTransition(async () => {
      const result = await updateStartup(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setIsEditing(false);
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950">
      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 flex-col gap-3">
              <label className={labelClass}>
                Name
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={startup.name}
                  disabled={isPending}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Domain
                <input
                  type="text"
                  name="domain"
                  defaultValue={startup.domain ?? ""}
                  placeholder="acme.com"
                  disabled={isPending}
                  className={inputClass}
                />
              </label>
            </div>
            <StatusForm id={startup.id} status={startup.status} />
          </div>

          <label className={labelClass}>
            Founder names
            <input
              type="text"
              name="founder_names"
              defaultValue={startup.founder_names ?? ""}
              placeholder="Jane Doe, John Smith"
              disabled={isPending}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Sector
              <select
                name="sector"
                defaultValue={startup.sector ?? ""}
                disabled={isPending}
                className={inputClass}
              >
                <option value="">—</option>
                {SECTORS.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Stage
              <select
                name="stage"
                defaultValue={startup.stage ?? ""}
                disabled={isPending}
                className={inputClass}
              >
                <option value="">—</option>
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={labelClass}>
            Ask amount (USD)
            <input
              type="number"
              name="ask_amount"
              min="0"
              step="1000"
              defaultValue={startup.ask_amount ?? ""}
              disabled={isPending}
              className={inputClass}
            />
          </label>

          {error && (
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsEditing(false);
              }}
              disabled={isPending}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <StatusForm id={startup.id} status={startup.status} />
              <StatusHistory startupId={startup.id} />
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <ExportMemoButton startupId={startup.id} />
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Edit
              </button>
              {startup.status !== "passed" && (
                <MoveToGraveyardButton startupId={startup.id} />
              )}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {startup.name}
          </h1>

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip label="Sector" value={startup.sector ?? "—"} />
            <Chip label="Stage" value={startup.stage ?? "—"} />
            <DomainChip domain={startup.domain} />
            <Chip label="Ask" value={formatAsk(startup.ask_amount)} />
            {lastRoundSummary && (
              <Chip label="Last round" value={lastRoundSummary} />
            )}
            <FoundersChip
              founderNames={startup.founder_names}
              keyFindings={keyFindings}
            />
            {contradictionsCount != null && (
              <Chip
                label="Contradictions"
                value={String(contradictionsCount)}
                warn={contradictionsCount > 0}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
