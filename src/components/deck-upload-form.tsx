"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { processUploadedDeck } from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";
import { DeckFilePicker } from "@/components/deck-file-picker";

const DECK_BUCKET = "startup-documents";

export function DeckUploadForm({ startupId }: { startupId: string }) {
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

    const documentId = crypto.randomUUID();
    const deckPath = `${startupId}/${documentId}/deck.pdf`;

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
      const result = await processUploadedDeck(startupId, documentId, deckPath);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  const pending = isUploading || isProcessing;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <DeckFilePicker onConfirm={handleFileConfirmed} disabled={pending} />
        {isUploading && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Uploading…
          </span>
        )}
        {isProcessing && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Processing…
          </span>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
