import type { Contradiction, ReviewPoint, Verdict } from "@/lib/supabase/types";

// The shape of a single review version as rendered in the UI - the raw DB
// row plus a couple of server-computed conveniences (provenance is derived
// from the stored input snapshot, not a live query at render time).
export interface ReviewVersionData {
  id: string;
  version: number;
  verdict: Verdict;
  thesis: string;
  snapshot: string;
  why_invest: ReviewPoint[];
  why_not: ReviewPoint[];
  contradictions: Contradiction[];
  dismissed_contradiction_indices: number[];
  unknowns: string[];
  generated_at: string;
  model_version: string;
  provenance: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

interface ListDiff<T> {
  added: T[];
  removed: T[];
  unchanged: T[];
}

// Deliberately simple: matches items by their "point" (or, for unknowns, the
// string itself) rather than a word-level text diff. Good enough to answer
// "what's new / what's gone" at a glance, which is what this is for - a
// point that got reworded shows as one remove + one add rather than a
// "changed" entry, but that's an acceptable simplification for a triage
// tool, not a document-editing history.
function diffByKey<T>(older: T[], newer: T[], keyOf: (item: T) => string): ListDiff<T> {
  const olderKeys = new Set(older.map((item) => normalize(keyOf(item))));
  const newerKeys = new Set(newer.map((item) => normalize(keyOf(item))));

  return {
    added: newer.filter((item) => !olderKeys.has(normalize(keyOf(item)))),
    removed: older.filter((item) => !newerKeys.has(normalize(keyOf(item)))),
    unchanged: newer.filter((item) => olderKeys.has(normalize(keyOf(item)))),
  };
}

export interface ReviewDiff {
  older: ReviewVersionData;
  newer: ReviewVersionData;
  verdictChanged: boolean;
  thesisChanged: boolean;
  snapshotChanged: boolean;
  whyInvest: ListDiff<ReviewPoint>;
  whyNot: ListDiff<ReviewPoint>;
  contradictions: ListDiff<Contradiction>;
  unknowns: ListDiff<string>;
}

export function computeReviewDiff(
  older: ReviewVersionData,
  newer: ReviewVersionData
): ReviewDiff {
  return {
    older,
    newer,
    verdictChanged: older.verdict !== newer.verdict,
    thesisChanged: normalize(older.thesis) !== normalize(newer.thesis),
    snapshotChanged: normalize(older.snapshot) !== normalize(newer.snapshot),
    whyInvest: diffByKey(older.why_invest, newer.why_invest, (p) => p.point),
    whyNot: diffByKey(older.why_not, newer.why_not, (p) => p.point),
    contradictions: diffByKey(
      older.contradictions,
      newer.contradictions,
      (c) => c.point
    ),
    unknowns: diffByKey(older.unknowns, newer.unknowns, (u) => u),
  };
}
