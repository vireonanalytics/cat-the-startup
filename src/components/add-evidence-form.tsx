"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { addComment } from "@/app/(app)/startups/[id]/actions";
import { useReviewRegeneration } from "@/components/review-regeneration-context";

export function AddEvidenceForm({ startupId }: { startupId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { notifyRegenerationStarted } = useReviewRegeneration();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const hasFile = (formData.get("file") as File | null)?.size;
    const hasText = String(formData.get("text") ?? "").trim();

    if (!hasFile && !hasText) {
      setError("Paste text or choose a .txt/.docx file.");
      return;
    }

    formData.set("startup_id", startupId);
    formData.set("audience", "evidence");

    startTransition(async () => {
      const result = await addComment(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.reviewRegenerating) {
        notifyRegenerationStarted();
      }
      form.reset();
      setIsOpen(false);
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mb-4 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        + Add evidence
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="mb-4 flex flex-col gap-3 rounded-lg border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <div>
        <label
          htmlFor="evidence-label"
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Label (optional)
        </label>
        <input
          id="evidence-label"
          name="label"
          type="text"
          placeholder="e.g. Intro call 6/12"
          disabled={isPending}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div>
        <label
          htmlFor="evidence-text"
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Text, or attach a file below
        </label>
        <textarea
          id="evidence-text"
          name="text"
          rows={4}
          placeholder="Paste a call transcript, or note a verified fact…"
          disabled={isPending}
          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div>
        <label
          htmlFor="evidence-file"
          className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Or upload a .txt or .docx file
        </label>
        <input
          id="evidence-file"
          name="file"
          type="file"
          accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={isPending}
          className="text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300 dark:hover:file:bg-zinc-700"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving…" : "Save evidence"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsOpen(false);
          }}
          disabled={isPending}
          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
        {error && (
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        )}
      </div>
    </form>
  );
}
