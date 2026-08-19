import { DeckUploadForm } from "@/components/deck-upload-form";
import { DownloadDeckButton } from "@/components/download-deck-button";
import { DeleteDeckButton } from "@/components/delete-deck-button";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface DeckInfo {
  id: string;
  page_image_urls: string[];
  uploaded_at: string;
}

export function DeckPanel({
  startupId,
  deck,
}: {
  startupId: string;
  deck: DeckInfo | null;
}) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Pitch deck
      </h2>

      {deck ? (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xl dark:bg-emerald-950">
              📄
            </div>
            {/* min-w-[9rem], not min-w-0 - with flex-wrap, a true min-w-0
                lets this column shrink toward zero forever instead of ever
                sending the button group to its own line, which is what let
                the buttons render on top of this text at narrow widths
                (the row never wrapped, so a taller, word-wrapped text block
                overlapped the vertically-centered buttons beside it). A
                real floor gives wrapping something to trigger on. */}
            <div className="min-w-[9rem] flex-1">
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Pitch deck
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {deck.page_image_urls.length} page
                {deck.page_image_urls.length === 1 ? "" : "s"} · uploaded{" "}
                {formatDate(deck.uploaded_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <DownloadDeckButton startupId={startupId} />
              <DeleteDeckButton documentId={deck.id} startupId={startupId} />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Have a newer version? Uploading replaces the deck used for the
              AI review.
            </p>
            <DeckUploadForm startupId={startupId} />
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Upload a PDF deck to generate an AI review.
          </p>
          <DeckUploadForm startupId={startupId} />
        </>
      )}
    </div>
  );
}
