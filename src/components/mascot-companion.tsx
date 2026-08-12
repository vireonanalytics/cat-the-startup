"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMascot } from "@/components/mascot-context";
import { Mascot, type MascotPose } from "@/components/mascot";

const SHY_MESSAGES = [
  "Meow! You caught me looking~",
  "Purrs nervously...",
  "Hehe, don't stare!",
];
const SHY_DURATION_MS = 2200;

// Pure flavor text for the gap under the cat when it has nothing real to
// report - never shown while a real activity or the shy message is active,
// so it can never be mistaken for actual app status.
const IDLE_QUIPS = [
  "Nine lives, zero term sheets signed.",
  "Diligence level: paw-thorough.",
  "Currently purring about your portfolio.",
  "Cat-alyzing growth, one nap at a time.",
  "Studies show 9/10 cats prefer a clean cap table.",
  "Just here for moral support and tuna.",
  "Rumor has it this cat passed on a unicorn once.",
  "Paw-sitive vibes only.",
  "0% diluted, 100% adorable.",
  "Some VCs read the room. This cat reads the sunbeam.",
  "Napping is a core competency.",
  "Whiskers: for sensing bad term sheets.",
];
const IDLE_QUIP_INTERVAL_MS = 9000;

// Shown instead of a rotating quip whenever AnalystCatChat has registered
// its open handler (see mascot-context.tsx) - i.e. only on a startup page,
// where petting the cat has a real payoff instead of being pure flavor.
const ASK_CAPTION = "Pet me if you want answers about this startup!";

// No matter which feature called pushActivity (deck reading, review
// writing, research, memo export...), once its single activity has been
// showing this long, the companion takes over: switches to the apologetic
// pose with a real apology line, instead of whatever that feature's own
// in-progress message was - all generic, so no individual feature has to
// wire up its own long-wait handling (one used to; it quietly never
// triggered, since it lived outside this component entirely). Previously
// this swapped in a rotating "cute cats meanwhile" photo widget instead of
// text - dropped in favor of just letting the cat look sheepish and say so,
// simpler and more in character than a distraction.
const LONG_WAIT_MS = 30_000;
const APOLOGY_MESSAGE = "Sorry, this is taking longer than usual — still on it!";
const NO_ACTIVITY_ID = -1;

// PurrAI has no button, label, or icon - just an idle cat with a caption -
// so a first-time visitor has no obvious reason to click it. This is a
// one-time, more attention-grabbing version of ASK_CAPTION shown until the
// analyst either opens the chat or explicitly dismisses it, then never
// again (tracked globally, not per-startup - the point is introducing the
// feature once, not re-explaining it on every new deal). Modeled as a tiny
// external store (see discussion-chat.tsx's identical seenCount pattern)
// since the source of truth is localStorage, not React state.
const HINT_STORAGE_KEY = "cat-the-startup:purrai-hint-seen";
const HINT_CAPTION = "👋 Tip: pet me to ask AI questions about this startup!";
const hintListeners = new Set<() => void>();

function readHintSeen(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(HINT_STORAGE_KEY) === "1";
}

function markHintSeen() {
  localStorage.setItem(HINT_STORAGE_KEY, "1");
  hintListeners.forEach((listener) => listener());
}

function subscribeHint(listener: () => void) {
  hintListeners.add(listener);
  return () => hintListeners.delete(listener);
}

interface MascotDisplay {
  pose: MascotPose;
  /** Empty string means "nothing to say right now" - distinct from a real
   * caption, callers render nothing in that case rather than an empty
   * bubble. */
  caption: string;
  /** True only for the one-time PurrAI discoverability hint - callers
   * render this caption as a highlighted, dismissible callout instead of
   * the usual plain italic text. */
  isHint: boolean;
  dismissHint: () => void;
  ariaLabel: string;
  handleClick: () => void;
}

// Shared by MascotCompanion (the docked desktop rail cat) and
// MascotMobileButton (the floating mobile equivalent, see below) - both
// need the exact same pose/caption/click logic, just presented at a
// different size and position, so it lives in one hook rather than two
// drifting copies.
function useMascotDisplay(): MascotDisplay {
  const { activities, analystChatHandler, isAnalystChatOpen } = useMascot();
  const [isShy, setIsShy] = useState(false);
  const [shyMessage, setShyMessage] = useState(SHY_MESSAGES[0]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Starts at a fixed index (0) so server and client render the same thing
  // on first paint - randomizing the starting index would pick a different
  // quip on the server vs. during client hydration and trigger a hydration
  // mismatch. It only ever advances from inside the interval callback
  // below, never as a direct setState call in an effect body.
  const [quipIndex, setQuipIndex] = useState(0);
  const [isLongWait, setIsLongWait] = useState(false);
  // Server snapshot says "already seen" (no hint) - localStorage isn't
  // readable during SSR - so the server-rendered and first-client render
  // agree; the real persisted value then takes over immediately after, via
  // useSyncExternalStore's built-in hydration handling (same pattern as
  // discussion-chat.tsx's unread badge).
  const hintSeen = useSyncExternalStore(subscribeHint, readHintSeen, () => true);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuipIndex((i) => (i + 1) % IDLE_QUIPS.length);
    }, IDLE_QUIP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const isHint = !!analystChatHandler && !hintSeen && !isAnalystChatOpen;

  function handleClick() {
    if (analystChatHandler) {
      markHintSeen();
      analystChatHandler();
      return;
    }
    setShyMessage(SHY_MESSAGES[Math.floor(Math.random() * SHY_MESSAGES.length)]);
    setIsShy(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsShy(false), SHY_DURATION_MS);
  }

  const real = activities[activities.length - 1] ?? {
    id: NO_ACTIVITY_ID,
    pose: "idle" as const,
    message: "",
    startedAt: 0,
  };

  // Resets whenever a *different* activity takes over (real.id changes) or
  // work finishes (id goes back to NO_ACTIVITY_ID) - keyed on id rather than
  // on time elapsed so switching from, say, "reading" to "writing" doesn't
  // inherit the previous activity's wait clock. The reset itself runs from
  // a callback (a same-tick timeout) rather than directly in the effect
  // body, same reasoning as the quip interval above.
  useEffect(() => {
    const resetTimeout = setTimeout(() => setIsLongWait(false), 0);

    if (real.id === NO_ACTIVITY_ID) {
      return () => clearTimeout(resetTimeout);
    }

    const longWaitTimeout = setTimeout(() => setIsLongWait(true), LONG_WAIT_MS);
    return () => {
      clearTimeout(resetTimeout);
      clearTimeout(longWaitTimeout);
    };
  }, [real.id]);

  const shown = isShy
    ? { pose: "shy" as const, message: shyMessage }
    : isLongWait
      ? { pose: "apologetic" as const, message: APOLOGY_MESSAGE }
      : real;

  // A real activity/shy/apology message always wins, same as before - the
  // hint only ever fills the idle slot, never interrupts something the cat
  // is actually reporting.
  const caption =
    shown.message ||
    (isHint
      ? HINT_CAPTION
      : analystChatHandler && isAnalystChatOpen
        ? ""
        : analystChatHandler
          ? ASK_CAPTION
          : IDLE_QUIPS[quipIndex]);

  return {
    pose: shown.pose,
    caption,
    isHint: isHint && !shown.message,
    dismissHint: markHintSeen,
    ariaLabel: analystChatHandler ? "Pet the cat to ask about this startup" : "Pet the cat",
    handleClick,
  };
}

// Lives in a dedicated rail column reserved in the page layout (see
// (app)/layout.tsx), not floating over content - a fixed-position overlay
// inevitably ends up on top of real text on any page taller than the
// viewport, since scrolling brings arbitrary content under that same
// screen position (confirmed by testing: it covered actual review text).
// A real layout column that content is never placed in can't have that
// problem at any scroll position, by construction. Sticky within that
// column so it stays in view as the page scrolls. Idle and gently animated
// by default, switches pose and shows a small caption - capped to the
// column's own width so it can never spill into content either - whenever
// something's actually happening. Every caption (idle quip, real activity,
// the ask-for-answers invite, the long-wait apology) uses the exact same
// plain italic treatment, no bordered bubble - one consistent voice for
// everything the cat says, rather than "real status" and "flavor text"
// looking like two different UI elements. Clicking it is normally a pure
// easter egg (shy pose for a couple seconds) that briefly overrides
// whatever real activity is showing, purely for delight - except on a
// startup page, where AnalystCatChat (see analyst-cat-chat.tsx) registers
// itself as this cat's click handler instead: there, petting the cat opens
// the AI Q&A chat rather than being shy about it. There's no separate "AI
// cat" character anymore - this is the one cat, doing double duty.
//
// Desktop-only (lives inside the aside that's hidden below lg in
// (app)/layout.tsx) - see MascotMobileButton below for the narrower-
// viewport equivalent.
export function MascotCompanion() {
  const { pose, caption, isHint, dismissHint, ariaLabel, handleClick } = useMascotDisplay();

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        data-tour="purrai-cat"
        className={
          "cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95" +
          (isHint ? " ring-4 ring-amber-300/70 animate-pulse dark:ring-amber-500/50" : "")
        }
      >
        <div key={pose} className={`mascot-pose mascot-pose-${pose} drop-shadow-lg`}>
          <Mascot pose={pose} size={160} priority />
        </div>
      </button>
      {caption &&
        (isHint ? (
          <div className="relative w-full max-w-[170px] rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2 text-center text-xs font-medium leading-snug text-amber-900 shadow-lg dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100">
            <button
              type="button"
              onClick={dismissHint}
              aria-label="Dismiss tip"
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white shadow hover:bg-amber-600"
            >
              ✕
            </button>
            {caption}
          </div>
        ) : (
          <p
            key={caption}
            className="quip-fade w-full max-w-[160px] text-center text-sm italic leading-snug text-zinc-500 dark:text-zinc-300"
          >
            {caption}
          </p>
        ))}
    </div>
  );
}

// The narrow-viewport (below lg) equivalent of MascotCompanion - rendered
// as an independent sibling in (app)/layout.tsx, outside the aside that
// hides the desktop rail entirely below lg, so it needs its own `lg:hidden`
// rather than inheriting visibility from that wrapper. A small floating
// avatar rather than the full docked column: there's no room to reserve a
// whole sidebar on a phone without eating into the actual startup data.
// Docked bottom-left specifically to stay clear of Cat-ch Up's own mobile
// button (discussion-chat.tsx), which owns bottom-right. Tapping it does
// exactly what clicking the desktop cat does - opens the AI chat on a
// startup page (see AnalystCatChat's own `lg:hidden` panel), or the shy
// easter egg everywhere else - just from a smaller resting size so it
// doesn't crowd the page.
export function MascotMobileButton() {
  const { pose, caption, isHint, dismissHint, ariaLabel, handleClick } = useMascotDisplay();

  return (
    <div className="fixed bottom-5 left-5 z-40 flex flex-col items-center gap-1 lg:hidden">
      {caption &&
        (isHint ? (
          <div className="relative max-w-[170px] rounded-lg border-2 border-amber-400 bg-amber-50 px-2 py-1.5 text-center text-[11px] font-medium leading-snug text-amber-900 shadow-md dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100">
            <button
              type="button"
              onClick={dismissHint}
              aria-label="Dismiss tip"
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white shadow hover:bg-amber-600"
            >
              ✕
            </button>
            {caption}
          </div>
        ) : (
          <p
            key={caption}
            className="quip-fade max-w-[160px] rounded-lg bg-white/90 px-2 py-1 text-center text-xs italic leading-snug text-zinc-600 shadow-md backdrop-blur-sm dark:bg-zinc-900/90 dark:text-zinc-300"
          >
            {caption}
          </p>
        ))}
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        data-tour="purrai-cat"
        className={
          "cursor-pointer rounded-full shadow-lg transition-transform active:scale-95" +
          (isHint ? " ring-4 ring-amber-300/70 animate-pulse dark:ring-amber-500/50" : "")
        }
      >
        <div key={pose} className={`mascot-pose mascot-pose-${pose} drop-shadow-lg`}>
          <Mascot pose={pose} size={64} priority />
        </div>
      </button>
    </div>
  );
}
