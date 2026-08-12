"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { createDraftStartupForDeck } from "@/app/(app)/startups/new/actions";
import { processNewDeckAndExtractStartupInfo } from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";
import { DeckFilePicker } from "@/components/deck-file-picker";

const DECK_BUCKET = "startup-documents";

function placeholderNameFromFile(fileName: string): string {
  const withoutExtension = fileName.replace(/\.pdf$/i, "");
  const spaced = withoutExtension.replace(/[_-]+/g, " ").trim();
  return spaced || "Untitled startup";
}

export function CreateFromDeckForm() {
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!isProcessing) return;
    return pushActivity("reading", "Reading through the deck, page by page…");
  }, [isProcessing, pushActivity]);

  async function handleFileConfirmed(file: File) {
    setError(null);

    if (file.type !== "application/pdf") {
      setError("Only PDF decks are supported.");
      return;
    }

    setIsUploading(true);

    const draft = await createDraftStartupForDeck(placeholderNameFromFile(file.name));
    if ("error" in draft) {
      setIsUploading(false);
      setError(draft.error);
      return;
    }

    const documentId = crypto.randomUUID();
    const deckPath = `${draft.id}/${documentId}/deck.pdf`;

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(DECK_BUCKET)
      .upload(deckPath, file, { contentType: "application/pdf" });

    setIsUploading(false);

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      return;
    }

    startTransition(async () => {
      const result = await processNewDeckAndExtractStartupInfo(
        draft.id,
        documentId,
        deckPath
      );
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  const pending = isUploading || isProcessing;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Or create from a pitch deck
      </h2>
      <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
        Upload a PDF deck and the company name, domain, sector, stage, ask
        amount, and founders are filled in automatically wherever the deck
        states them. Anything the deck doesn&apos;t cover is left blank for
        you to fill in afterward.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <DeckFilePicker
          onConfirm={handleFileConfirmed}
          disabled={pending}
          label="Upload deck"
        />
        {isUploading && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Uploading…
          </span>
        )}
        {isProcessing && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Reading deck…
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
