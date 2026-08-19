export const SECTORS = [
  "Fintech",
  "Healthtech",
  "AI/ML",
  "Consumer",
  "Enterprise SaaS",
  "Infrastructure",
  "Marketplace",
  "Climate",
  "Other",
];

export const STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Series C+"];

// Ordered worst-to-best doesn't matter here as much as matching the model's
// prompt instructions verbatim - see buildReviewPrompt in
// src/app/(app)/startups/[id]/actions.ts. "No live opportunity" is
// deliberately not ordered alongside the other five - it isn't a point on
// the same quality scale, just the state "there is nothing to invest in
// here anymore" (round already closed, company already exited), which the
// deck's own merits don't change one way or the other.
export const VERDICTS = [
  "Pass",
  "Weak fit",
  "Needs diligence",
  "Promising",
  "Strong yes",
  "No live opportunity",
] as const;

// Lives here rather than in the "use server" actions.ts because that file
// may only export async functions - a plain const array export breaks it.
export const RESEARCH_DEPTHS = ["fast", "medium", "extended"] as const;
export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number];
