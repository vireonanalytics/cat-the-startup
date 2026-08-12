"use client";

import { useRef, useState, type ChangeEvent } from "react";

// A single "Upload deck" button that opens the file picker immediately -
// no separate native "Choose file" control sitting next to a second
// "Upload"/"Create" button, which read as two disconnected steps rather
// than one action. Picking a file doesn't upload it yet either; it shows a
// filename + Confirm/Cancel bar first; only Confirm calls onConfirm(file),
// so a wrong pick is never silently a click away from actually uploading.
export function DeckFilePicker({
  onConfirm,
  disabled,
  label = "Upload deck",
}: {
  onConfirm: (file: File) => void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function reset() {
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPendingFile(file);
  }

  function handleConfirm() {
    if (!pendingFile) return;
    onConfirm(pendingFile);
    reset();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="application/pdf,.pdf"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      {pendingFile ? (
        <>
          <span className="max-w-[16rem] truncate text-sm text-zinc-700 dark:text-zinc-300">
            {pendingFile.name}
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disabled}
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Confirm upload
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={disabled}
            className="text-sm text-zinc-500 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {label}
        </button>
      )}
    </div>
  );
}
