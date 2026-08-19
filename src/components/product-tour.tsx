"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { markTourCompleted } from "@/app/(app)/tour-actions";
import { useMobileNav } from "@/components/mobile-nav-context";

type TourPage = "dashboard" | "new-startup" | "startup" | "any";

interface TourStep {
  /** data-tour id this step points at and measures every frame. */
  target: string;
  page: TourPage;
  title: string;
  body: string;
  /** Click the element once it's found, to actually show what this step is
   * describing (switch a tab, open a chat panel) instead of just pointing
   * at it. Defaults to clicking `target` itself; set `clickTarget` when the
   * thing to click isn't the thing to keep highlighted (Cat-ch Up's toggle
   * button disappears once clicked - see clickTarget below). */
  autoClick?: boolean;
  /** data-tour id to click instead of `target` when autoClick fires.
   * Only needed when they differ. */
  clickTarget?: string;
  /** How to undo autoClick when this step ends. "toggle" re-clicks
   * `clickTarget`/`target` (works for elements that toggle open/closed,
   * like the PurrAI cat). A string is the data-tour id of a distinct close
   * control to click instead (Cat-ch Up's panel only has a dedicated ✕). */
  closeOnExit?: "toggle" | string;
}

// One continuous walkthrough spanning the dashboard and a startup's detail
// page, in the order a new analyst would actually encounter these things.
// Steps tagged "any" target elements that live in the persistent header
// nav, so they render wherever the tour happens to be; "dashboard",
// "new-startup", and "startup" each gate on (and auto-navigate to) a
// specific route.
const STEPS: TourStep[] = [
  {
    target: "dashboard-table",
    page: "dashboard",
    title: "Welcome to Cat the Startup 🐾",
    body: "Every inbound startup your team is triaging lands here - sort or filter it by sector and status.",
  },
  {
    target: "deck-upload-form",
    page: "new-startup",
    title: "Add a startup",
    body: "Log one by hand above, or drop a pitch deck here (PDF) and the name, sector, stage, ask, and founders get pulled out for you automatically.",
  },
  {
    target: "review-tab",
    page: "startup",
    title: "AI review",
    body: "A generated verdict plus why-invest, why-not, and open unknowns - regenerate it any time new material comes in.",
    autoClick: true,
  },
  {
    target: "research-tab",
    page: "startup",
    title: "Online research",
    body: "Kicks off public web research on the founders and company. Fast is a quick gut-check, Medium a solid pass, Extended goes deep - each searches more and returns more facts.",
    autoClick: true,
  },
  {
    target: "evidence-tab",
    page: "startup",
    title: "Evidence",
    body: "Drop call transcripts and other notes here - they feed straight into the AI review alongside the deck.",
    autoClick: true,
  },
  {
    target: "purrai-cat",
    page: "startup",
    title: "PurrAI",
    body: "Pet the cat to ask questions about this specific startup - it answers from everything gathered on this page.",
    autoClick: true,
    closeOnExit: "toggle",
  },
  {
    target: "catchup-panel",
    page: "startup",
    title: "Cat-ch Up",
    body: "Your team's private chat for this deal - notes here are never sent to the AI review.",
    autoClick: true,
    clickTarget: "catchup-button",
    closeOnExit: "catchup-close",
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
  if (page === "new-startup") return pathname === "/startups/new";
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

// Scrolls a target into view only if it isn't already comfortably on
// screen - called once per step rather than unconditionally, so steps
// whose target is already visible (the dashboard table, a tab bar) don't
// get a pointless nudge every time.
function ensureVisible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const margin = 100;
  if (r.top < margin || r.bottom > window.innerHeight - margin) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Undoes a step's autoClick when the analyst moves on - re-clicking a
// toggle, or clicking a distinct close control, so a step that opened
// PurrAI or Cat-ch Up to show it off doesn't leave it open once the tour
// has moved on to something else. Safe to call on any step (including
// ones with no autoClick, or ones whose target no longer exists) - the
// optional chaining just no-ops.
function closeStepIfNeeded(step: TourStep | null) {
  if (!step || !step.autoClick || !step.closeOnExit) return;
  if (step.closeOnExit === "toggle") {
    findVisibleTarget(step.clickTarget ?? step.target)?.click();
  } else {
    findVisibleTarget(step.closeOnExit)?.click();
  }
}

// Mounted once in (app)/layout.tsx, so it's present (and keeps its state)
// across every page in the app without remounting on navigation - it just
// re-evaluates against the new pathname each time. The tour drives itself
// end to end: it navigates to whichever page a step needs (see
// tourStartupId below - a real, already-populated startup picked
// server-side, not left for the analyst to click into), clicks tabs and
// panels open to actually show what it's describing instead of just
// pointing at them, closes what it opened before moving on, and opens the
// mobile hamburger menu itself for steps whose target only lives there.
//
// Whether it's been seen lives on the analyst's account (see Step 17 in
// schema.sql and tour-actions.ts), not localStorage - a per-browser flag
// reappeared every time an analyst opened a new browser, an incognito
// window, or a different device, which read as "the tour starts randomly"
// even though localStorage was behaving exactly as designed. The server
// component that renders this (see (app)/layout.tsx) already knows the
// account's tour_completed value at page-load time, so it's passed in
// directly rather than fetched client-side - no loading state, no flash.
export function ProductTour({
  initialCompleted,
  tourStartupId,
}: {
  initialCompleted: boolean;
  tourStartupId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setIsOpen: setMobileNavOpen } = useMobileNav();
  const [completed, setCompleted] = useState(initialCompleted);
  const [stepIndex, setStepIndex] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [stuck, setStuck] = useState(false);
  const frameRef = useRef<number | null>(null);

  // Same-tick timeout rather than a direct setState call in the effect
  // body, same reasoning as the reset effect further down - this only
  // starts the tour once, the first time the account's own analyst lands
  // on the dashboard with tour_completed still false.
  useEffect(() => {
    if (completed || stepIndex !== -1) return;
    if (pathname !== "/dashboard") return;
    const startTimeout = setTimeout(() => setStepIndex(0), 0);
    return () => clearTimeout(startTimeout);
  }, [completed, stepIndex, pathname]);

  const step = !completed && stepIndex >= 0 && stepIndex < STEPS.length ? STEPS[stepIndex] : null;
  const onTarget = step ? pageMatches(step.page, pathname) : false;
  const canAutoNavigate =
    !!step && (step.page === "new-startup" || (step.page === "startup" && !!tourStartupId));

  // Drives the navigation itself rather than waiting for the analyst to
  // click into a startup or find "Add startup" - once onTarget flips true
  // (the router.push below lands and pathname updates) this condition
  // goes false and the effect stops re-firing, so there's no repeat-
  // navigation loop.
  useEffect(() => {
    if (!step || onTarget) return;
    if (step.page === "startup" && tourStartupId) {
      router.push(`/startups/${tourStartupId}`);
    } else if (step.page === "new-startup") {
      router.push("/startups/new");
    }
  }, [step, onTarget, tourStartupId, router]);

  useEffect(() => {
    if (!step || !onTarget) {
      // Same-tick timeout rather than a direct setState call in the effect
      // body, same reasoning as the long-wait reset in
      // mascot-companion.tsx - this only clears stale highlight state
      // between steps/pages, no window for a visible flash of it either way.
      const resetTimeout = setTimeout(() => setRect(null), 0);
      return () => clearTimeout(resetTimeout);
    }

    // Start every step with the mobile hamburger menu closed - most step
    // targets aren't inside it, and a menu left open from the previous step
    // would otherwise cover the very thing this step wants to highlight.
    setMobileNavOpen(false);

    // A step's target can be on the right page yet still not exist right
    // now - most commonly because the page itself is still loading (a
    // fresh client-side navigation has to wait on a Server Component data
    // fetch, and in dev mode the very first visit to a route also pays an
    // on-demand compile that alone can run several seconds - both are
    // completely normal and have nothing to do with the target actually
    // being unreachable). The one case that's genuinely permanent, not
    // just slow, is a target that only exists inside the closed mobile
    // hamburger menu (see mobile-nav-menu.tsx) - rather than ask the
    // analyst to open it, this opens it for them once the normal load
    // window has passed. Elapsed wall time rather than a frame count,
    // since rAF cadence isn't reliable across devices/tabs.
    const OPEN_MENU_AFTER_MS = 1200;
    const STUCK_AFTER_MS = 8000;
    const startedAt = Date.now();
    let menuOpened = false;
    let autoClicked = false;
    let scrolled = false;

    function measure() {
      const el = findVisibleTarget(step!.target);

      if (el) {
        if (!scrolled) {
          scrolled = true;
          ensureVisible(el);
        }
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }

      if (step!.autoClick && !autoClicked) {
        const clickEl = findVisibleTarget(step!.clickTarget ?? step!.target);
        if (clickEl) {
          autoClicked = true;
          clickEl.click();
        }
      }

      const elapsed = Date.now() - startedAt;
      if (!el && !menuOpened && elapsed > OPEN_MENU_AFTER_MS) {
        menuOpened = true;
        setMobileNavOpen(true);
      }
      setStuck(!el && elapsed > STUCK_AFTER_MS);
      frameRef.current = requestAnimationFrame(measure);
    }
    frameRef.current = requestAnimationFrame(measure);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [step, onTarget, pathname, setMobileNavOpen]);

  if (!step) return null;

  // Natural completion (the analyst clicked "Finish" on the last step) -
  // there's nothing more to see, so it drops them back on the dashboard
  // rather than leaving them on whatever step-8 page they ended on.
  function finishNaturally() {
    setCompleted(true);
    void markTourCompleted();
    router.push("/dashboard");
  }

  // An abrupt exit (the analyst clicked "Skip tour" partway through) - they
  // were in the middle of doing something on this page before the tour
  // interrupted them, so it leaves them exactly where they are instead of
  // also yanking them to the dashboard.
  function skipTour() {
    closeStepIfNeeded(step);
    setCompleted(true);
    void markTourCompleted();
  }

  function next() {
    closeStepIfNeeded(step);
    if (stepIndex >= STEPS.length - 1) {
      finishNaturally();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  // !onTarget while canAutoNavigate means the navigation effect above is
  // already carrying the analyst to the right page - render nothing while
  // that's in flight rather than a pill asking them to do it by hand.
  // Without a tourStartupId (no startup exists yet to point the tour at)
  // there's genuinely nothing to navigate to, so it falls back to asking.
  // `stuck` is the other, now-rare case: the step's page is right and the
  // menu-open effect already fired, but the target still hasn't shown up -
  // a last-resort skip rather than a dead end.
  if (!onTarget && canAutoNavigate) return null;

  if (!onTarget || stuck) {
    return (
      <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-xs -translate-x-1/2 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 shadow-lg dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100 sm:left-auto sm:right-5 sm:translate-x-0">
        <p className="font-medium">
          {onTarget
            ? "This step's target didn't show up - skip ahead to keep going."
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
            onClick={skipTour}
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
            onClick={skipTour}
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
