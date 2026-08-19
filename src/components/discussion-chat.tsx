"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { addComment, deleteComment } from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";

const SWIPE_ANIMATION_MS = 700;
const SEEN_STORAGE_PREFIX = "cat-the-startup:discussion-seen:";

function noopSubscribe() {
  return () => {};
}

function getServerAnchor() {
  return null;
}

// The anchor is a real DOM node the outer server-rendered layout already
// put in place, below the AI chat slot in the same rail column (see
// (app)/layout.tsx) - it never changes after mount, so there's nothing to
// subscribe to. useSyncExternalStore (rather than an effect that calls
// setState) is the supported way to read an external, already-there value
// like this.
function usePortalTarget(id: string): HTMLElement | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById(id),
    getServerAnchor
  );
}

// How many of a startup's discussion items this analyst has already seen,
// persisted in localStorage so the unread badge survives a page reload.
// Modeled as a tiny external store (read via useSyncExternalStore, written
// via markSeen) rather than component state, since the source of truth
// genuinely lives outside React here - localStorage isn't readable during
// SSR, and there's no native same-tab "storage" event to react to, so this
// keeps its own listener set to notify subscribers after a write.
const seenListeners = new Set<() => void>();

function readSeenCount(startupId: string): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(SEEN_STORAGE_PREFIX + startupId);
  return stored === null ? 0 : Number(stored);
}

function markSeen(startupId: string, count: number) {
  localStorage.setItem(SEEN_STORAGE_PREFIX + startupId, String(count));
  seenListeners.forEach((listener) => listener());
}

function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  return () => seenListeners.delete(listener);
}

export interface DiscussionItem {
  id: string;
  extracted_text: string | null;
  uploaded_at: string;
  author: { name: string } | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// A small toggle button, not a permanently reserved layout column - a
// column wide enough to read comfortably ate into the space available for
// the actual review content on every page, for a feature only glanced at
// occasionally. On lg+ it portals into #discussion-chat-anchor, the bottom
// slot of the same fixed rail column the cat and the AI chat panel share
// (see (app)/layout.tsx) - that's what keeps it lined up with the cat and
// unable to overlap the AI chat panel above it, at any viewport height.
// Below lg that rail is hidden entirely, so it falls back to its own
// independent fixed bottom-right position - there's no AI chat panel down
// there to collide with on narrow viewports anyway, since that one is
// desktop-only (see analyst-cat-chat.tsx).
export function DiscussionChat({
  startupId,
  items,
  canDelete,
}: {
  startupId: string;
  items: DiscussionItem[];
  /** Only admins can delete a discussion message - enforced server-side too
   * (see deleteComment + the Step 12 RLS policy), this just hides the
   * option for everyone else rather than showing a button that would fail. */
  canDelete: boolean;
}) {
  const anchor = usePortalTarget("discussion-chat-anchor");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { pushActivity, setIsDiscussionChatOpen } = useMascot();

  // Lets AnalystCatChat's mobile panel (see analyst-cat-chat.tsx) know to
  // reposition itself above this one instead of sitting on top of it, on
  // viewports below lg where both fall back to independent fixed corners
  // rather than the shared stacking rail column (see (app)/layout.tsx).
  useEffect(() => {
    setIsDiscussionChatOpen(isOpen);
  }, [isOpen, setIsDiscussionChatOpen]);

  useEffect(() => {
    return () => setIsDiscussionChatOpen(false);
  }, [setIsDiscussionChatOpen]);

  // Server snapshot reports "everything seen" (0 unread) - localStorage
  // isn't readable during SSR - so the server-rendered and first-client
  // render agree; the real persisted count then takes over immediately
  // after, via useSyncExternalStore's built-in hydration handling.
  const seenCount = useSyncExternalStore(
    subscribeSeen,
    () => readSeenCount(startupId),
    () => items.length
  );

  // Opening the panel - or sending a message while it's open, which grows
  // items.length - both count as "caught up": nothing shown while the panel
  // is open should ever read as unread.
  useEffect(() => {
    if (!isOpen) return;
    markSeen(startupId, items.length);
  }, [isOpen, items.length, startupId]);

  const unreadCount = Math.max(0, items.length - seenCount);

  useEffect(() => {
    if (!deletingId) return;
    return pushActivity("swiping", "Sweeping that one away…");
  }, [deletingId, pushActivity]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return;

    formData.set("startup_id", startupId);
    formData.set("audience", "discussion");

    startTransition(async () => {
      const result = await addComment(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      form.reset();
    });
  }

  function handleDelete(id: string) {
    setError(null);
    setConfirmingId(null);
    setDeletingId(id);

    setTimeout(() => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("startup_id", startupId);

      startTransition(async () => {
        const result = await deleteComment(formData);
        setDeletingId(null);
        if ("error" in result) {
          setError(result.error);
        }
        // Discussion messages never trigger a review regeneration - nothing
        // else to do on success.
      });
    }, SWIPE_ANIMATION_MS);
  }

  const toggleButton = (
    <div data-tour="catchup-panel" className="relative flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-tour="catchup-button"
        className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-lg transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        🐾 Cat-ch Up
        {unreadCount > 0 && (
          <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );

  const panel = (
    // w-72, exactly matching its desktop anchor's width (see
    // #discussion-chat-anchor in (app)/layout.tsx) - that width is
    // reserved from main by the layout's real flex structure, so there's
    // no need to leave the panel narrower than the anchor as a buffer
    // against page content anymore.
    <div
      data-tour="catchup-panel"
      className="flex max-h-[420px] w-72 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            🐾 Cat-ch Up
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Private — never sent to the AI review
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          data-tour="catchup-close"
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {items.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No messages yet. Leave a note for the team.
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className={
              "group relative rounded-lg bg-zinc-100 px-3 py-2 transition-all duration-300 ease-in dark:bg-zinc-900 " +
              (deletingId === item.id
                ? "translate-x-4 opacity-0"
                : "translate-x-0 opacity-100")
            }
          >
            <p className="mb-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {item.author?.name ?? "Unknown"}
            </p>
            <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {item.extracted_text}
            </p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {formatDate(item.uploaded_at)}
              </span>
              {canDelete &&
                (confirmingId === item.id ? (
                  <span className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={isPending}
                      className="font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                    >
                      {isPending ? "…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      disabled={isPending}
                      className="text-zinc-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(item.id)}
                    className="text-[10px] text-zinc-400 opacity-0 hover:text-red-700 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-black/10 p-3 dark:border-white/10"
      >
        <input
          type="text"
          name="text"
          placeholder="Add a note for the team…"
          disabled={isPending}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {isPending ? "…" : "Send"}
        </button>
      </form>
      {error && (
        <p className="px-3 pb-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );

  const content: ReactNode = isOpen ? panel : toggleButton;

  return (
    <>
      {anchor && createPortal(content, anchor)}
      {/* Below lg the rail is hidden entirely, so this is the only way to
          reach Cat-ch Up on narrower viewports. */}
      <div className="fixed bottom-5 right-5 z-40 lg:hidden">{content}</div>
    </>
  );
}
