"use client";

import { useState, type ReactNode } from "react";

type TabKey = "review" | "deck" | "research" | "evidence";

const TABS: { key: TabKey; label: string; tour?: string }[] = [
  { key: "review", label: "Review", tour: "review-tab" },
  { key: "deck", label: "Deck" },
  { key: "research", label: "Online research", tour: "research-tab" },
  { key: "evidence", label: "Evidence", tour: "evidence-tab" },
];

export function StartupTabs({
  review,
  deck,
  research,
  evidence,
}: {
  review: ReactNode;
  deck: ReactNode;
  research: ReactNode;
  evidence: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("review");
  const panels: Record<TabKey, ReactNode> = { review, deck, research, evidence };

  return (
    <div className="mt-6 rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <div className="flex gap-1 overflow-x-auto border-b border-black/10 px-4 dark:border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            data-tour={tab.tour}
            onClick={() => setActive(tab.key)}
            className={
              "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors " +
              (active === tab.key
                ? "border-zinc-950 text-zinc-950 dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6">
        {(Object.keys(panels) as TabKey[]).map((key) => (
          <div key={key} className={active === key ? "block" : "hidden"}>
            {panels[key]}
          </div>
        ))}
      </div>
    </div>
  );
}
