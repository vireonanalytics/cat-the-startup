"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "cat-the-startup:tour";
const DONE = "done";

type TourPage = "dashboard" | "startup" | "any";

interface TourStep {
  target: string;
  page: TourPage;
  title: string;
  body: string;
}

// One continuous walkthrough spanning the dashboard and a startup's detail
// page, in the order a new analyst would actually encounter these things.
// Steps tagged "any" target elements that live in the persistent header
// nav, so they render wherever the tour happens to be; only "dashboard" and
// "startup" gate on a specific route.
const STEPS: TourStep[] = [
  {
    target: "dashboard-table",
    page: "dashboard",
    title: "Welcome to Cat the Startup 🐾",
    body: "Every inbound startup your team is triaging lands here - sort or filter it by sector and status.",
  },
  {
    target: "add-startup-link",
    page: "any",
    title: "Add a startup",
    body: "Log one by hand, or upload a pitch deck (PDF) and the name, sector, stage, ask, and founders get pulled out for you automatically.",
  },
  {
    target: "review-tab",
    page: "startup",
    title: "AI review",
    body: "A generated verdict plus why-invest, why-not, and open unknowns - regenerate it any time new material comes in.",
  },
  {
    target: "research-tab",
    page: "startup",
    title: "Online research",
    body: "Kicks off public web research on the founders and company. Fast is a quick gut-check, Medium a solid pass, Extended goes deep - each searches more and returns more facts.",
  },
  {
    target: "evidence-tab",
    page: "startup",
    title: "Evidence",
    body: "Drop call transcripts and other notes here - they feed straight into the AI review alongside the deck.",
  },
  {
    target: "purrai-cat",
    page: "startup",
    title: "PurrAI",
    body: "Pet the cat to ask questions about this specific startup - it answers from everything gathered on this page.",
  },
  {
    target: "catchup-button",
    page: "startup",
    title: "Cat-ch Up",
    body: "Your team's private chat for this deal - notes here are never sent to the AI review.",
  },
  {
    target: "passed-link",
    page: "any",
    title: "The graveyard",
    body: "Startups you pass on move here instead of disappearing - browsable any time you want to look back.",
  },
];

function pageMatches(page: TourPage, pathname: string): boolean {
  if (page === "any") return true;
  if (page === "dashboard") return pathname === "/dashboard";
  return /^\/startups\/(?!new(?:\/|$))/.test(pathname);
}

// Several targets exist twice in the DOM at once - desktop rail cat vs the
// mobile fixed button, desktop header nav vs the off-canvas mobile menu -
// with only CSS telling them apart, not DOM position. Picking the first
// element with an actual laid-out box (zero for anything hidden via
// display:none, which is how both of those toggles work) finds whichever
// copy is really on screen instead of assuming an order.
function findVisibleTarget(id: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

// Plain localStorage-backed external store, same shape as the other
// one-time hints in this app (see mascot-companion.tsx's PurrAI hint) -
// "" means never started, a digit string is the current step index, "done"
// means finished or skipped.
const listeners = new Set<() => void>();
let cached: string | null = null;

function read(): string {
  if (typeof window === "undefined") return "";
  if (cached === null) cached = localStorage.getItem(STORAGE_KEY) ?? "";
  return cached;
}

function write(value: string) {
  cached = value;
  localStorage.setItem(STORAGE_KEY, value);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Mounted once in (app)/layout.tsx, so it's present (and keeps its state)
// across every page in the app without remounting on navigation - it just
// re-evaluates against the new pathname each time. When the current step
// needs the startup detail page and the analyst isn't on one yet, it shows
// a small waiting pill rather than auto-navigating anywhere - there's no
// single "right" startup to jump to, and waiting for a real click keeps
// the tour from fighting the analyst's own navigation.
export function ProductTour() {
  const pathname = usePathname();
  const state = useSyncExternalStore(subscribe, read, () => "");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [stuck, setStuck] = useState(false);
  const frameRef = useRef<number | null>(null);

  // Reads localStorage directly here rather than trusting `state` - during
  // hydration useSyncExternalStore briefly renders with the server snapshot
  // ("") before resyncing to the real client value, and (especially under
  // React Strict Mode's double-effect-invocation in dev) this effect could
  // otherwise fire on that transitional render and stomp a real in-progress
  // step with "0". Reading the actual stored value directly sidesteps that
  // race entirely - safe to call more than once, since it's a no-op
  // whenever anything has already been written.
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return;
    write("0");
  }, [pathname]);

  const stepIndex = state === "" || state === DONE ? -1 : Number(state);
  const step = stepIndex >= 0 && stepIndex < STEPS.length ? STEPS[stepIndex] : null;
  const onTarget = step ? pageMatches(step.page, pathname) : false;

  useEffect(() => {
    if (!step || !onTarget) {
      // Same-tick timeout rather than a direct setState call in the effect
      // body, same reasoning as the long-wait reset in
      // mascot-companion.tsx - this only clears stale highlight state
      // between steps/pages, no window for a visible flash of it either way.
      const resetTimeout = setTimeout(() => setRect(null), 0);
      return () => clearTimeout(resetTimeout);
    }

    // A step's target can be on the right page yet still not exist right
    // now - most commonly because the page itself is still loading (a
    // fresh client-side navigation to a startup page has to wait on a
    // Server Component data fetch, and in dev mode the very first visit to
    // a route also pays an on-demand compile that alone can run several
    // seconds - both are completely normal and have nothing to do with the
    // target actually being unreachable). The one case that's genuinely
    // permanent, not just slow, is a target that only exists inside the
    // closed mobile hamburger menu (see mobile-nav-menu.tsx). Elapsed wall
    // time rather than a frame count, since rAF cadence isn't reliable
    // across devices/tabs - 8s comfortably clears normal load latency while
    // still eventually rescuing the permanent case.
    const STUCK_AFTER_MS = 8000;
    const startedAt = Date.now();

    function measure() {
      const el = findVisibleTarget(step!.target);
      setRect(el ? el.getBoundingClientRect() : null);
      setStuck(!el && Date.now() - startedAt > STUCK_AFTER_MS);
      frameRef.current = requestAnimationFrame(measure);
    }
    frameRef.current = requestAnimationFrame(measure);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [step, onTarget, pathname]);

  if (!step) return null;

  function finish() {
    write(DONE);
  }

  function next() {
    if (stepIndex >= STEPS.length - 1) {
      finish();
    } else {
      write(String(stepIndex + 1));
    }
  }

  // Two different reasons land here, and they need different actions.
  // !onTarget means the step needs a whole different page (the startup
  // detail steps, before any startup has been opened) - every later step
  // needs that same page too, so there's nothing to "skip ahead" to; the
  // only real options are wait or bail out entirely. `stuck` means the
  // step's page is right, but this one specific target is only tucked
  // inside the mobile hamburger menu (see mobile-nav-menu.tsx) and it's
  // closed - the fix here is either open the menu or move past this one
  // step, not end the whole tour over it.
  if (!onTarget || stuck) {
    return (
      <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-xs -translate-x-1/2 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 shadow-lg dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100 sm:left-auto sm:right-5 sm:translate-x-0">
        <p className="font-medium">
          {onTarget
            ? "This step is tucked in the ☰ menu - open it to see the highlight, or skip ahead."
            : "Open any startup to continue the tour."}
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          {onTarget && (
            <button
              type="button"
              onClick={next}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
            >
              Skip this step
            </button>
          )}
          <button
            type="button"
            onClick={finish}
            className="text-xs underline underline-offset-2"
          >
            Skip tour
          </button>
        </div>
      </div>
    );
  }

  if (!rect) return null;

  const padding = 6;
  const top = rect.top - padding;
  const left = rect.left - padding;
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;

  const cardWidth = 288;
  const gap = 10;
  const placeAbove = window.innerHeight - (top + height) < 160 && top > 160;
  const cardLeft = Math.min(Math.max(left, 12), window.innerWidth - cardWidth - 12);
  const cardStyle: React.CSSProperties = placeAbove
    ? { left: cardLeft, bottom: window.innerHeight - top + gap }
    : { left: cardLeft, top: top + height + gap };

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed z-[60] rounded-lg ring-2 ring-amber-400 transition-all duration-300 dark:ring-amber-500"
        style={{ top, left, width, height, boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
      />
      <div
        className="fixed z-[61] rounded-xl border border-black/10 bg-white p-4 text-sm shadow-2xl dark:border-white/10 dark:bg-zinc-900"
        style={{ ...cardStyle, width: cardWidth }}
      >
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {stepIndex + 1} / {STEPS.length}
        </p>
        <p className="mb-1 font-semibold text-zinc-950 dark:text-zinc-50">{step.title}</p>
        <p className="mb-3 text-zinc-600 dark:text-zinc-400">{step.body}</p>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={finish}
            className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-md bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {stepIndex >= STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
