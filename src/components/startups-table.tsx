"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StartupStatus } from "@/lib/supabase/types";
import { STATUS_OPTIONS } from "@/components/status-form";
import { SECTORS } from "@/lib/constants";

export interface StartupRow {
  id: string;
  name: string;
  sector: string | null;
  stage: string | null;
  status: StartupStatus;
  ask_amount: number | null;
  created_at: string;
}

type SortKey = keyof Omit<StartupRow, "id">;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "sector", label: "Sector" },
  { key: "stage", label: "Stage" },
  { key: "status", label: "Status" },
  { key: "ask_amount", label: "Ask" },
  { key: "created_at", label: "Created" },
];

const STATUS_STYLES: Record<StartupStatus, string> = {
  new: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_review:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  passed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  investing:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

// One color per SECTORS value (constants.ts) so the same sector reads as
// the same color everywhere on the dashboard - "Other" and any legacy/
// unrecognized value fall back to neutral zinc rather than an arbitrary hue.
const SECTOR_STYLES: Record<string, string> = {
  Fintech: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Healthtech: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "AI/ML": "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  Consumer: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "Enterprise SaaS": "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  Infrastructure: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  Marketplace: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  Climate: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
};
const DEFAULT_SECTOR_STYLE =
  "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

function formatAsk(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StartupsTable({ startups }: { startups: StartupRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StartupStatus | "">("");

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return startups.filter((startup) => {
      if (trimmed && !startup.name.toLowerCase().includes(trimmed)) return false;
      if (sectorFilter && startup.sector !== sectorFilter) return false;
      if (statusFilter && startup.status !== statusFilter) return false;
      return true;
    });
  }, [startups, query, sectorFilter, statusFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDir === "asc" ? comparison : -comparison;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const hasActiveFilters = Boolean(query.trim() || sectorFilter || statusFilter);
  const selectClass =
    "rounded-md border border-zinc-300 bg-white py-2 pl-3 pr-8 text-sm text-zinc-700 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200";

  return (
    <div data-tour="dashboard-table" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m17 17-4-4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search startups by name…"
            aria-label="Search startups by name"
            className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-8 pr-8 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={sectorFilter}
          onChange={(event) => setSectorFilter(event.target.value)}
          aria-label="Filter by sector"
          className={selectClass}
        >
          <option value="">All sectors</option>
          {SECTORS.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StartupStatus | "")
          }
          aria-label="Filter by status"
          className={selectClass}
        >
          <option value="">All statuses</option>
          {/* "Passed" is excluded - the dashboard never contains a passed
              startup to filter to in the first place (see DashboardPage's
              query), they live under /passed instead. */}
          {STATUS_OPTIONS.filter((option) => option.value !== "passed").map(
            (option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            )
          )}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSectorFilter("");
              setStatusFilter("");
            }}
            className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear filters
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No startups match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900">
                {COLUMNS.map((col) => (
                  <th key={col.key} className="p-0 text-left">
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="flex w-full items-center gap-1 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((startup) => {
                return (
                <tr
                  key={startup.id}
                  className="border-b border-black/5 last:border-0 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <Link
                        href={`/startups/${startup.id}`}
                        className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
                      >
                        {startup.name}
                      </Link>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {startup.sector ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${SECTOR_STYLES[startup.sector] ?? DEFAULT_SECTOR_STYLE}`}
                      >
                        {startup.sector}
                      </span>
                    ) : (
                      <span className="text-zinc-600 dark:text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {startup.stage ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[startup.status]}`}
                    >
                      {startup.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatAsk(startup.ask_amount)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatDate(startup.created_at)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
