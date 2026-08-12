"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getReviewGeneratedAt } from "@/app/(app)/startups/[id]/actions";
import { useMascot } from "@/components/mascot-context";

interface ReviewRegenerationContextValue {
  isRegenerating: boolean;
  notifyRegenerationStarted: () => void;
}

const ReviewRegenerationContext =
  createContext<ReviewRegenerationContextValue | null>(null);

const POLL_INTERVAL_MS = 3000;
// A real regeneration normally finishes well under this, but a hung or
// unusually slow model call shouldn't leave the indicator spinning forever.
const MAX_POLL_MS = 3 * 60 * 1000;

// Lets any action that fires a background review regeneration (adding
// evidence, refreshing research - see maybeTriggerBackgroundRegeneration in
// actions.ts) tell the Review panel it's updating, even though they live in
// different tabs and don't share props. Polls a cheap timestamp-only
// endpoint rather than the full review, and hands off to router.refresh()
// once it changes so the actual content updates through the normal
// server-rendered path. The manual "Regenerate" button (see
// generate-review-form.tsx) also calls notifyRegenerationStarted, so both
// paths share one activity push - including the companion's own generic
// long-wait apology handling (see mascot-companion.tsx), which a manual
// click used to bypass entirely by pushing its own separate activity.
export function ReviewRegenerationProvider({
  startupId,
  initialGeneratedAt,
  children,
}: {
  startupId: string;
  initialGeneratedAt: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const knownGeneratedAtRef = useRef(initialGeneratedAt);
  const { pushActivity } = useMascot();

  useEffect(() => {
    if (!isRegenerating) return;
    return pushActivity(
      "writing",
      "Updating the review with your latest changes…"
    );
  }, [isRegenerating, pushActivity]);

  // Re-syncs the baseline whenever fresh server data actually lands (e.g.
  // after the router.refresh() below brings in the new review).
  useEffect(() => {
    knownGeneratedAtRef.current = initialGeneratedAt;
  }, [initialGeneratedAt]);

  useEffect(() => {
    if (!isRegenerating) return;

    const startedAt = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setIsRegenerating(false);
        return;
      }
      const latest = await getReviewGeneratedAt(startupId);
      if (latest && latest !== knownGeneratedAtRef.current) {
        knownGeneratedAtRef.current = latest;
        setIsRegenerating(false);
        router.refresh();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isRegenerating, startupId, router]);

  const notifyRegenerationStarted = useCallback(() => {
    setIsRegenerating(true);
  }, []);

  return (
    <ReviewRegenerationContext.Provider
      value={{ isRegenerating, notifyRegenerationStarted }}
    >
      {children}
    </ReviewRegenerationContext.Provider>
  );
}

export function useReviewRegeneration() {
  const ctx = useContext(ReviewRegenerationContext);
  if (!ctx) {
    throw new Error(
      "useReviewRegeneration must be used within a ReviewRegenerationProvider"
    );
  }
  return ctx;
}
