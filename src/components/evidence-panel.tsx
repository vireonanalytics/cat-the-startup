import { AddEvidenceForm } from "@/components/add-evidence-form";
import { EvidenceList, type EvidenceListItem } from "@/components/evidence-list";

export function EvidencePanel({
  startupId,
  items,
}: {
  startupId: string;
  items: EvidenceListItem[];
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Evidence — sent to the AI review
        </h2>
      </div>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Call transcripts and verified facts. Anything added here is included
        the next time the review runs.
      </p>
      <AddEvidenceForm startupId={startupId} />
      <EvidenceList startupId={startupId} items={items} />
    </div>
  );
}
