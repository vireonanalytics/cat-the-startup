"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  askAboutStartup,
  getChatHistory,
  getSuggestedQuestions,
  type ChatTurn,
} from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";

function noopSubscribe() {
  return () => {};
}

function getServerAnchor() {
  return null;
}

// The anchor is a real DOM node the outer server-rendered layout already
// put in place, right after the companion cat (see (app)/layout.tsx) - it
// never changes after mount, so there's nothing to subscribe to.
// useSyncExternalStore (rather than an effect that calls setState) is the
// supported way to read an external, already-there value like this.
function usePortalTarget(id: string): HTMLElement | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById(id),
    getServerAnchor
  );
}

// There's no separate "AI cat" character anymore - the main companion (see
// mascot-companion.tsx) does double duty. This component only owns the
// question-asking machinery (chat panel, history, suggestions) and the
// server-grounded Q&A logic; it hands its "open" action to the companion
// via setAnalystChatHandler, which is what turns petting the cat into
// opening this panel instead of the usual shy easter egg, only while this
// component is mounted (i.e. only on a startup page). Answers are grounded
// server-side in only what's already on this startup's page (see
// askAboutStartup) - never the model's outside knowledge, and never
// discussion messages, which stay private to the team. Conversation
// history is per-analyst and persisted server-side (see askAboutStartup /
// getChatHistory), not local state - it survives closing the chat, and two
// analysts on the same startup never see each other's questions.
export function AnalystCatChat({
  startupId,
  startupName,
}: {
  startupId: string;
  startupName: string;
}) {
  const { setAnalystChatHandler, setIsAnalystChatOpen, isDiscussionChatOpen } =
    useMascot();
  const anchor = usePortalTarget("analyst-chat-anchor");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const hasLoadedHistoryRef = useRef(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAnalystChatHandler(() => () => setIsOpen((v) => !v));
    return () => setAnalystChatHandler(null);
  }, [setAnalystChatHandler]);

  useEffect(() => {
    setIsAnalystChatOpen(isOpen);
  }, [isOpen, setIsAnalystChatOpen]);

  useEffect(() => {
    return () => setIsAnalystChatOpen(false);
  }, [setIsAnalystChatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isPending]);

  useEffect(() => {
    if (!isOpen || hasLoadedHistoryRef.current) return;
    hasLoadedHistoryRef.current = true;
    getChatHistory(startupId).then(setMessages);
    getSuggestedQuestions(startupId).then(setSuggestions);
  }, [isOpen, startupId]);

  async function submitQuestion(question: string) {
    if (!question || isPending) return;

    setError(null);
    setInput("");
    const nextMessages: ChatTurn[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setSuggestions([]);
    setIsPending(true);

    const result = await askAboutStartup(startupId, question);

    setIsPending(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setMessages([...nextMessages, { role: "assistant", content: result.answer }]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(input.trim());
  }

  if (!isOpen) return null;

  const panelBody = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            PurrAI
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Only knows what&apos;s on this page - just for you
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask anything about {startupName} — I&apos;ll only use the
            deck, evidence, research, and review already on this page.
          </p>
        )}
        {messages.map((turn, i) => (
          <div
            key={i}
            className={
              "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
              (turn.role === "user"
                ? "self-end bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                : "self-start bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300")
            }
          >
            {turn.content}
          </div>
        ))}
        {isPending && (
          <div className="self-start rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            PurrAI is thinking…
          </div>
        )}
        {!isPending && messages.length === 0 && suggestions.length > 0 && (
          <div className="mt-1 flex flex-col gap-1.5">
            {suggestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => submitQuestion(question)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-left text-xs text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-black/10 p-3 dark:border-white/10"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about this startup…"
          disabled={isPending}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {isPending ? "…" : "Ask"}
        </button>
      </form>
      {error && (
        <p className="px-3 pb-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </>
  );

  return (
    <>
      {anchor &&
        createPortal(
          // Fills #analyst-chat-anchor (see (app)/layout.tsx), a flex-1
          // min-h-0 slot between the cat and Cat-ch Up inside the rail's
          // height-bounded sticky column - so this panel only ever gets
          // however much vertical room is actually left after the cat
          // above it and Cat-ch Up below it, and scrolls its own contents
          // (see the message list's own overflow-y-auto) rather than
          // growing into either one - keeps the two panels from ever
          // overlapping vertically when both are open. Exactly as wide as
          // its anchor (w-72) - the anchor's own width is reserved from
          // main by the layout's real flex structure, so there's nothing
          // to leave slack for horizontally anymore. lg:flex (not just
          // flex) since below lg the desktop rail this anchor lives in is
          // hidden entirely - see the mobile version below.
          <div className="hidden h-full w-72 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl lg:flex dark:border-white/10 dark:bg-zinc-950">
            {panelBody}
          </div>,
          anchor
        )}
      {/* Below lg the rail (and its portal target above) is hidden
          entirely, so this fixed, independently-positioned panel is the
          only way to reach the chat - opened from MascotMobileButton (see
          mascot-companion.tsx), which lives in the same bottom-left corner
          this expands from. Cat-ch Up (discussion-chat.tsx) falls back to
          its own independent bottom-right corner down here too, instead of
          sharing the lg+ rail's single stacking column - so if an analyst
          has both open on a phone, this shifts up above Cat-ch Up's panel
          (bottom-5, up to 420px tall - see discussion-chat.tsx) rather than
          sitting on top of it, and shrinks its own max-height to leave that
          taller position room to actually fit on a short viewport. */}
      <div
        className={
          "fixed left-5 z-40 flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl lg:hidden dark:border-white/10 dark:bg-zinc-950 " +
          (isDiscussionChatOpen
            ? "bottom-[29rem] max-h-[40vh]"
            : "bottom-24 max-h-[60vh]")
        }
      >
        {panelBody}
      </div>
    </>
  );
}
