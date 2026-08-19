"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient } from "@/lib/anthropic";
import { extractPdfText, renderPdfPagesToImages } from "@/lib/pdf";
import {
  RESEARCH_DEPTHS,
  SECTORS,
  STAGES,
  VERDICTS,
  type ResearchDepth,
} from "@/lib/constants";
import type {
  CommentAudience,
  Contradiction,
  KeyFinding,
  ReviewPoint,
  StartupStatus,
  Verdict,
} from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const VALID_STATUSES: StartupStatus[] = [
  "new",
  "in_review",
  "passed",
  "investing",
];

const DECK_BUCKET = "startup-documents";

// The model occasionally emits a non-ASCII character (·, €, em dash, etc.)
// as its literal escape notation ("·") inside a JSON string's content,
// rather than the actual character - valid JSON, but wrong once parsed. Walk
// every string in a parsed response and repair any such literal escapes back
// into the character they were meant to be.
function repairLiteralUnicodeEscapes<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => repairLiteralUnicodeEscapes(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = repairLiteralUnicodeEscapes(val);
    }
    return result as T;
  }
  return value;
}

const REVIEW_MODEL = "claude-opus-5";

// Compact by design: this is read by a VC analyst deciding whether to dig
// further, not a report. Verdict + thesis lead so the bottom line is
// visible before any detail; every point is capped at one sentence.
const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: [...VERDICTS],
      description:
        "Your bottom-line call, worst to best: \"Pass\", \"Weak fit\", \"Needs diligence\", \"Promising\", \"Strong yes\". Base it only on what the evidence actually shows, not on how the company presents itself.",
    },
    thesis: {
      type: "string",
      description:
        "One sentence, under 30 words: the single most important thing an analyst should know before reading further. No hedging filler.",
    },
    snapshot: {
      type: "string",
      description:
        "1-2 neutral sentences on what the company does and its stage, as shown in the deck. A caption, not a summary.",
    },
    why_invest: {
      type: "array",
      description:
        "The 3-5 most important reasons to invest, ranked most important first.",
      items: {
        type: "object",
        properties: {
          point: {
            type: "string",
            description:
              "One short sentence. If it needs two sentences, it's two points.",
          },
          evidence: {
            type: "string",
            description:
              "A short citation, prefixed with its source: the slide for deck evidence (e.g. \"Slide 8: revenue chart shows $80k MRR\"), the evidence item's exact label (e.g. \"Founder call 6/12: 40% MoM growth\"), or \"Public research:\" for a finding from public research. The specific number or fact only, not a paragraph.",
          },
        },
        required: ["point", "evidence"],
        additionalProperties: false,
      },
    },
    why_not: {
      type: "array",
      description:
        "The 3-5 most important reasons for caution, ranked most important first, same one-sentence-plus-citation format as why_invest.",
      items: {
        type: "object",
        properties: {
          point: { type: "string" },
          evidence: {
            type: "string",
            description: "Same sourcing convention as why_invest evidence.",
          },
        },
        required: ["point", "evidence"],
        additionalProperties: false,
      },
    },
    contradictions: {
      type: "array",
      description:
        "Cases where two of your sources directly conflict. Empty array if none are found - do not force one.",
      items: {
        type: "object",
        properties: {
          point: {
            type: "string",
            description:
              "Short label, e.g. \"Q4 revenue run-rate\" or \"Seed round funding\".",
          },
          deck_says: {
            type: "string",
            description:
              "One side of the contradiction, one short sentence, prefixed with its source using the evidence sourcing convention.",
          },
          call_says: {
            type: "string",
            description:
              "The conflicting claim, one short sentence, prefixed with its source the same way - an evidence label, or \"Public research:\".",
          },
        },
        required: ["point", "deck_says", "call_says"],
        additionalProperties: false,
      },
    },
    unknowns: {
      type: "array",
      description:
        "Open questions nothing you were given answers - short phrases (3-6 words), not full sentences. If no public research has been added yet, include one entry noting that.",
      items: { type: "string" },
    },
  },
  required: [
    "verdict",
    "thesis",
    "snapshot",
    "why_invest",
    "why_not",
    "contradictions",
    "unknowns",
  ],
  additionalProperties: false,
};

function buildReviewPrompt(hasEnrichment: boolean): string {
  const enrichmentNote = hasEnrichment
    ? ` You have also been given a "Public research" summary, gathered by searching the web for the company's name, domain, and founders. Treat it as a third evidence source alongside the deck and evidence notes.`
    : ``;

  const unknownsNote = hasEnrichment
    ? ""
    : ` No public research has been added for this startup yet - note that under "unknowns" and produce the rest of the review from the deck and evidence alone; don't let its absence block the review.`;

  return `You are a VC analyst writing a compact, scannable triage review for an investment team - the kind a partner reads in under a minute to decide whether to dig deeper. You have been given every page of the startup's pitch deck as images, in order, and, if provided, one or more pieces of evidence (call transcripts or verified facts an analyst logged), each preceded by its label.${enrichmentNote}

Write like a sharp analyst talking to a colleague, not a legal filing: professional and precise, but warm, plain-spoken, and easy to read - contractions are fine, jargon and hedging filler are not. Stay rigorous and factual; friendly tone is about word choice, never about softening a real concern.

Correctness matters more than completeness. Every claim you make must trace to something actually shown in the deck, said in a piece of evidence, or found in the public research you were given. Never invent, assume, infer, round, or fill in a plausible-sounding number, name, or fact that isn't directly present in the source material - if you are not certain a fact is stated, leave it out or list it under "unknowns" instead of guessing.

Read both the text on each slide and any charts, graphs, tables, or screenshots - founders often put their most important numbers in graphics, not bullet points. Read the evidence notes just as closely - founders often say things on calls that never make it into the deck.

Every citation must name its source, briefly:
- Deck: cite the slide, e.g. "Slide 4: MRR chart shows $10k to $80k over 6 months."
- Evidence: cite it by its exact label, e.g. "Founder call 6/12: 40% MoM growth."
- Public research: prefix with "Public research:", e.g. "Public research: $2M seed in 2024."

Keep every point and every citation to one short sentence - this review is read in a hurry. If a point needs two sentences to explain, it's two points.

Lead with your bottom line: a "verdict" and a one-sentence "thesis" - the single most important thing to know before reading further. Base both only on the evidence itself, not on how the company presents itself.

Pay close attention to discrepancies between your sources - the deck states one figure and a call gives another, a claimed milestone is cast in doubt, or a deck/evidence claim conflicts with public research (e.g. a claimed funding status doesn't match what research found, or a founder's background doesn't match what's publicly documented). List every such case in "contradictions", citing what each side says using the same sourcing convention as evidence citations. Leave it as an empty array if you find no real contradictions - do not manufacture one.

If nothing you were given addresses something an investor would want to know (team background, competitive landscape, unit economics, customer concentration), list it under "unknowns" as a short phrase rather than guessing.${unknownsNote}

Produce, in order of priority: a verdict, a one-sentence thesis, a short snapshot, the 3-5 most important why_invest points, the 3-5 most important why_not points, a list of contradictions (empty if none), and a list of unknowns.`;
}

const ENRICHMENT_MODEL = "claude-opus-5";

// Three explicit time/thoroughness tiers an analyst can pick per-refresh,
// rather than one fixed depth - more search steps and a larger finding
// count both directly add latency, so this is a real speed/thoroughness
// tradeoff, not just a display cap.
const RESEARCH_DEPTH_CONFIG: Record<
  ResearchDepth,
  {
    findingsCount: string;
    maxSearches: number;
    maxTokens: number;
    instruction: string;
  }
> = {
  fast: {
    findingsCount: "2-3",
    maxSearches: 4,
    maxTokens: 2048,
    instruction:
      "Keep this quick: run a handful of targeted searches rather than an exhaustive sweep, and report only the 2-3 single most decision-relevant facts you find.",
  },
  medium: {
    findingsCount: "4-6",
    maxSearches: 8,
    maxTokens: 4096,
    instruction:
      "Report the 4-6 most decision-relevant facts you find - a solid pass across funding, founders, news, and competitors without exhausting every source.",
  },
  extended: {
    findingsCount: "typically 5-10+",
    maxSearches: 14,
    maxTokens: 6144,
    instruction:
      "Be thorough: search deeply across all five categories rather than stopping at the first few results, and report every genuinely useful, well-sourced fact you find rather than stopping at a fixed count - more if your research turned up that much, fewer if it didn't.",
  },
};

// Only an upper bound, never a lower one - a minItems would risk pressuring
// the model to pad the list with a weaker, less-sourced fact just to hit a
// floor, which directly fights the "never invent a fact" rule below. Capped
// for fast/medium, where the prompt asks for a fairly specific count;
// deliberately uncapped for extended, whose whole instruction is "more if
// your research turned up that much" - a hard ceiling there would undercut
// the one depth actually meant to be open-ended.
//
// Enforced by slicing the response in enrichStartup, not by a `maxItems`
// keyword on the schema below - Anthropic's structured-output schema
// validator rejects `maxItems` on array properties outright ("property
// 'maxItems' is not supported"), confirmed live against the real API, not
// assumed. A prose count in the description alone is what caused the
// original overrun (see the depth config above), so the cap still has to
// be a hard one - it just has to be applied after the response comes back
// instead of inside the schema itself.
const FINDINGS_MAX: Partial<Record<ResearchDepth, number>> = {
  fast: 3,
  medium: 6,
};

function buildEnrichmentSchema(depth: ResearchDepth) {
  return {
    type: "object",
    properties: {
      findings: {
        type: "array",
        description: `The decision-relevant facts found via public web search, ranked most important first - drawn from whichever of funding, founder background, recent news, and competitors actually turned up real information. ${RESEARCH_DEPTH_CONFIG[depth].findingsCount} findings. Skip categories you found nothing on rather than padding the list.`,
        items: {
          type: "object",
          properties: {
            point: {
              type: "string",
              description:
                "One short, specific sentence stating the fact - a number, name, or date, not a vague summary.",
            },
            source_name: {
              type: "string",
              description:
                "The publication or site the fact came from, e.g. \"TechCrunch\" or \"Crunchbase\".",
            },
            url: {
              type: "string",
              description:
                "The exact URL of the source page, copied character-for-character from your search results. Never type a URL from memory or construct one - only use a URL that literally appeared in your search results for this request.",
            },
          },
          required: ["point", "source_name", "url"],
          additionalProperties: false,
        },
      },
      last_round_summary: {
        type: "string",
        description:
          "The most recent disclosed funding round as one short fact - amount, round type if known, and date, e.g. \"$1.5M pre-seed, Feb 2025\". Use plain ASCII punctuation only (no special separator characters). Empty string if no round is publicly disclosed.",
      },
    },
    required: ["findings", "last_round_summary"],
    additionalProperties: false,
  };
}

// CONFIDENTIALITY BOUNDARY: this prompt must only ever be built from the
// startup's public basic-info fields (name, domain, founder names) - never
// from deck or evidence content, which is proprietary to the team. Do not
// add deck/evidence text to this function or its caller.
function buildEnrichmentPrompt(
  name: string,
  domain: string | null,
  founderNames: string | null,
  depth: ResearchDepth
): string {
  const identifiers = [
    `Company name: ${name}`,
    domain ? `Domain: ${domain}` : null,
    founderNames ? `Founder(s): ${founderNames}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are researching a startup using only public web sources, for an early-stage investment team doing due diligence. Write like an analyst briefing a colleague: professional and precise, but warm and plain-spoken rather than dry or robotic.

Research ONLY using these public identifiers - do not use any other information about the company, and do not assume anything beyond what your searches actually turn up:
${identifiers}

Search the web for:
- Funding history: rounds raised, amounts (if publicly disclosed), and investors
- Last round: the single most recent disclosed round, as one short fact
- Founder background: previous companies, education, and other notable public information
- Recent news mentions of the company
- Named competitors in the same space

${RESEARCH_DEPTH_CONFIG[depth].instruction} Every finding must cite the exact source page it came from: its name and its URL, copied character-for-character from your search results, never typed from memory. A fact you cannot point to a real URL for should not appear in "findings" at all. If your searches turn up nothing usable, return an empty findings list rather than inventing content or citing a URL you are not certain of.`;
}

export async function updateStartupStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !VALID_STATUSES.includes(status as StartupStatus)) {
    return;
  }

  const supabase = await createClient();

  // Read before writing, not because the update needs it, but because the
  // audit log below needs to know what it changed *from* - and by the time
  // the update below has run, that information is gone.
  const { data: before } = await supabase
    .from("startups")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("startups")
    .update({ status: status as StartupStatus })
    .eq("id", id);

  if (error) {
    redirect(`/startups/${id}?error=${encodeURIComponent(error.message)}`);
  }

  if (before && before.status !== status) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Best-effort - a logging failure shouldn't block the status change
    // itself, which already succeeded above.
    await supabase.from("status_changes").insert({
      startup_id: id,
      from_status: before.status,
      to_status: status,
      changed_by: user?.id ?? null,
    });
  }

  revalidatePath("/dashboard");
  // The status dropdown can no longer set this (see StatusForm), so landing
  // here with status "passed" always means MoveToGraveyardButton - the flag
  // tells the page to show the "you can still find it in the graveyard"
  // note (see GraveyardNote), since a bare status change alone doesn't say
  // where an analyst should look for it next.
  redirect(
    status === "passed" ? `/startups/${id}?graveyard=1` : `/startups/${id}`
  );
}

export interface StatusChangeEntry {
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by: { name: string } | null;
}

// Powers the small history list next to the status dropdown (see
// startup-header.tsx) - who changed a startup's status and when, since
// that previously happened with no record at all. Team-wide, like the
// rest of a startup's data (see Step 16 in schema.sql) - unlike PurrAI's
// chat, this isn't analyst-private.
export async function getStatusHistory(
  startupId: string
): Promise<StatusChangeEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("status_changes")
    .select("from_status, to_status, changed_at, changed_by:users(name)")
    .eq("startup_id", startupId)
    .order("changed_at", { ascending: false });

  return data ?? [];
}

type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: "image/png"; data: string };
};

// Shared by processUploadedDeck (existing startup) and
// processNewDeckAndExtractStartupInfo (deck-driven startup creation): the
// PDF itself is uploaded directly from the browser to Supabase Storage (see
// DeckUploadForm / CreateFromDeckForm) rather than through a Server Action's
// request body, since Next.js multipart bodies are size-limited and fragile
// for large binary payloads. This only processes a file that is already
// sitting in storage: it downloads it server-side, renders page images,
// extracts text, and records the `documents` row.
async function ingestDeckDocument(
  supabase: SupabaseClient<Database>,
  userId: string,
  startupId: string,
  documentId: string,
  deckPath: string
): Promise<
  | { error: string }
  | { pageImageUrls: string[]; extractedText: string | null; imageBlocks: ImageBlock[] }
> {
  const { data: blob, error: downloadError } = await supabase.storage
    .from(DECK_BUCKET)
    .download(deckPath);

  if (downloadError || !blob) {
    return {
      error: `Could not read the uploaded file: ${downloadError?.message ?? "unknown error"}`,
    };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const basePath = `${startupId}/${documentId}`;

  const pageImageUrls: string[] = [];
  const imageBlocks: ImageBlock[] = [];
  try {
    const pages = await renderPdfPagesToImages(buffer);
    for (let i = 0; i < pages.length; i++) {
      const pagePath = `${basePath}/page-${i + 1}.png`;
      const { error: pageError } = await supabase.storage
        .from(DECK_BUCKET)
        .upload(pagePath, pages[i], { contentType: "image/png" });
      if (!pageError) {
        pageImageUrls.push(pagePath);
        imageBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: pages[i].toString("base64"),
          },
        });
      }
    }
  } catch (err) {
    console.error("Failed to render PDF pages:", err);
    return {
      error: `Could not render this PDF: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  if (pageImageUrls.length === 0) {
    return { error: "Could not render any pages from this PDF." };
  }

  let extractedText: string | null = null;
  try {
    extractedText = await extractPdfText(buffer);
  } catch {
    extractedText = null;
  }

  const { error: docError } = await supabase.from("documents").insert({
    id: documentId,
    startup_id: startupId,
    type: "deck",
    file_url: deckPath,
    page_image_urls: pageImageUrls,
    extracted_text: extractedText,
    uploaded_by: userId,
  });

  if (docError) {
    return { error: docError.message };
  }

  return { pageImageUrls, extractedText, imageBlocks };
}

type ParsedReview = {
  verdict: Verdict;
  thesis: string;
  snapshot: string;
  why_invest: ReviewPoint[];
  why_not: ReviewPoint[];
  contradictions: Contradiction[];
  unknowns: string[];
};

// The single place that actually calls the model and writes a `reviews`
// row - used by the explicit Generate/Regenerate button (generateReview)
// and by every auto-regeneration trigger (maybeAutoRegenerateReview). Never
// redirects; callers decide what to do with the result.
async function runReviewGeneration(
  supabase: SupabaseClient<Database>,
  startupId: string
): Promise<{ error: string } | { ok: true }> {
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, page_image_urls")
    .eq("startup_id", startupId)
    .eq("type", "deck")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (docError || !document || document.page_image_urls.length === 0) {
    return { error: "Upload a deck before generating a review." };
  }

  const { data: evidenceRows } = await supabase
    .from("documents")
    .select("id, extracted_text, label, uploaded_at")
    .eq("startup_id", startupId)
    .eq("type", "comment")
    .eq("audience", "evidence")
    .order("uploaded_at", { ascending: true });

  const { data: enrichment } = await supabase
    .from("enrichment_findings")
    .select("id, summary_text, created_at")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const imageBlocks: ImageBlock[] = [];
  for (const path of document.page_image_urls) {
    const { data: blob, error } = await supabase.storage
      .from(DECK_BUCKET)
      .download(path);
    if (error || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    imageBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: buffer.toString("base64"),
      },
    });
  }

  if (imageBlocks.length === 0) {
    return { error: "Could not load the deck's page images." };
  }

  const evidenceBlocks: Array<{ type: "text"; text: string }> = (
    evidenceRows ?? []
  )
    .filter((row) => row.extracted_text)
    .map((row) => ({
      type: "text",
      text: `--- Evidence: "${row.label ?? "Untitled"}" (added ${new Date(row.uploaded_at).toLocaleDateString("en-US")}) ---\n${row.extracted_text}`,
    }));

  const enrichmentBlocks: Array<{ type: "text"; text: string }> = enrichment
    ? [
        {
          type: "text",
          text: `--- Public research (fetched ${new Date(enrichment.created_at).toLocaleDateString("en-US")}) ---\n${enrichment.summary_text}`,
        },
      ]
    : [];

  const client = createAnthropicClient();

  let response;
  try {
    response = await client.messages.create({
      model: REVIEW_MODEL,
      max_tokens: 8192,
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: REVIEW_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            ...evidenceBlocks,
            ...enrichmentBlocks,
            { type: "text", text: buildReviewPrompt(Boolean(enrichment)) },
          ],
        },
      ],
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "The Anthropic API request failed.",
    };
  }

  if (response.stop_reason === "refusal") {
    return { error: "The model declined to review this deck." };
  }

  const textBlock = response.content
    .filter((block) => block.type === "text")
    .at(-1);
  if (!textBlock || textBlock.type !== "text") {
    return { error: "The model did not return a review." };
  }

  let parsed: ParsedReview;
  try {
    parsed = repairLiteralUnicodeEscapes(JSON.parse(textBlock.text) as ParsedReview);
  } catch {
    return { error: "Could not parse the model's response." };
  }

  // deck_document_id/evidence_document_ids/enrichment_finding_id are a
  // snapshot of exactly which inputs produced this version - not a live
  // reference to "whatever the startup's current state is." version is
  // deliberately omitted here; a before-insert trigger assigns it
  // atomically (see set_review_version in schema.sql).
  const { error: insertError } = await supabase.from("reviews").insert({
    startup_id: startupId,
    verdict: parsed.verdict,
    thesis: parsed.thesis,
    snapshot: parsed.snapshot,
    why_invest: parsed.why_invest,
    why_not: parsed.why_not,
    unknowns: parsed.unknowns,
    contradictions: parsed.contradictions ?? [],
    model_version: REVIEW_MODEL,
    deck_document_id: document.id,
    evidence_document_ids: (evidenceRows ?? []).map((row) => row.id),
    enrichment_finding_id: enrichment?.id ?? null,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  return { ok: true };
}

// Whether anything that changes the review's evidence (public research, an
// evidence comment added/deleted, a new deck) should trigger a fresh
// review. Only true if a review already exists - the *first* review
// generation stays an explicit click, so "automatic" means "keep an
// existing review current," not "generate one the analyst never asked
// for." Cheap: two id-only lookups, safe to await on the fast path.
async function shouldAutoRegenerateReview(
  supabase: SupabaseClient<Database>,
  startupId: string
): Promise<boolean> {
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("startup_id", startupId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingReview) {
    return false;
  }

  const { data: deck } = await supabase
    .from("documents")
    .select("id")
    .eq("startup_id", startupId)
    .eq("type", "deck")
    .limit(1)
    .maybeSingle();

  return Boolean(deck);
}

async function maybeAutoRegenerateReview(
  supabase: SupabaseClient<Database>,
  startupId: string
): Promise<void> {
  if (!(await shouldAutoRegenerateReview(supabase, startupId))) {
    return;
  }

  const result = await runReviewGeneration(supabase, startupId);
  if ("error" in result) {
    console.error("Auto-regeneration failed:", result.error);
  }
}

// Like maybeAutoRegenerateReview, but doesn't block on the actual AI call -
// callers whose own change is already fast (adding a comment, refreshing
// research) shouldn't have their response held up by a 30-90s model call
// just to keep the review in sync. Returns whether a regeneration was
// actually kicked off, so the caller can tell its UI to start watching for
// it (see getReviewGeneratedAt, polled by ReviewRegenerationProvider).
//
// Fire-and-forget is safe here because this app runs as a persistent
// Node process (`next dev` / `next start`), which keeps executing pending
// promises after a request's response is sent. It would silently drop
// this work on a serverless/edge deployment target (e.g. Vercel functions,
// which can freeze the process the moment the response flushes) - that
// would need a real background job queue instead.
async function maybeTriggerBackgroundRegeneration(
  supabase: SupabaseClient<Database>,
  startupId: string
): Promise<boolean> {
  const eligible = await shouldAutoRegenerateReview(supabase, startupId);
  if (!eligible) {
    return false;
  }

  void runReviewGeneration(supabase, startupId)
    .then((result) => {
      if ("error" in result) {
        console.error("Background review regeneration failed:", result.error);
      }
    })
    .catch((err) => {
      console.error("Background review regeneration failed:", err);
    });

  return true;
}

// Cheap polling target for ReviewRegenerationProvider - just the latest
// review's timestamp, no AI call. The client polls this while a background
// regeneration is in flight and calls router.refresh() once it changes.
export async function getReviewGeneratedAt(
  startupId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("generated_at")
    .eq("startup_id", startupId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.generated_at ?? null;
}

export async function processUploadedDeck(
  startupId: string,
  documentId: string,
  deckPath: string
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await ingestDeckDocument(
    supabase,
    user.id,
    startupId,
    documentId,
    deckPath
  );

  if ("error" in result) {
    return { error: result.error };
  }

  await maybeAutoRegenerateReview(supabase, startupId);

  revalidatePath(`/startups/${startupId}`);
  redirect(`/startups/${startupId}`);
}

const STARTUP_INFO_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "The company's name as it appears in the deck (not a tagline or product name, unless that is also the company name). Empty string only if truly not stated anywhere in the deck.",
    },
    domain: {
      type: "string",
      description:
        "The company's website domain shown in the deck (e.g. in a footer, contact slide, or URL), without protocol or path, e.g. \"acme.com\". Empty string if no domain is shown.",
    },
    sector: {
      type: "string",
      enum: [...SECTORS, ""],
      description:
        "The closest matching sector from the allowed list, based on what the deck describes the company as doing. Empty string if none of the options are a reasonable fit or the deck doesn't make the sector clear.",
    },
    stage: {
      type: "string",
      enum: [...STAGES, ""],
      description:
        "The company's funding stage, only if explicitly stated in the deck (e.g. on a fundraising/ask slide). Empty string if not stated - do not infer from team size or company maturity.",
    },
    ask_amount: {
      type: "string",
      description:
        "The funding amount the deck says the company is raising, in USD, as digits only with no currency symbol or commas (e.g. \"1500000\"), only if an ask amount is explicitly stated. Empty string if no ask amount is shown - ignore revenue, valuation, or other dollar figures that aren't the ask.",
    },
    founder_names: {
      type: "string",
      description:
        "Names of the founders, comma-separated (e.g. \"Jane Doe, John Smith\"), only if a team/founders slide names them. Empty string if no founders are named anywhere in the deck - do not use names that appear only as customer contacts, investors, or advisors.",
    },
  },
  required: ["name", "domain", "sector", "stage", "ask_amount", "founder_names"],
  additionalProperties: false,
};

function buildStartupInfoPrompt(): string {
  return `You are extracting basic company information from a startup's pitch deck, to pre-fill a CRM record. You have been given every page of the deck as images, in order.

Only extract facts that are actually stated or shown in the deck. Do not guess, infer from indirect cues, or fill in a plausible-sounding value. If a field isn't clearly present in the deck, leave it as an empty string rather than guessing - an analyst will fill in anything missing by hand.`;
}

// Used only by the "create startup from a deck" flow (see
// createDraftStartupForDeck in startups/new/actions.ts): the draft startup
// row already exists (with a placeholder name) so ingestDeckDocument's RLS
// checks pass, then this fills in the real basic-info fields from the deck.
export async function processNewDeckAndExtractStartupInfo(
  startupId: string,
  documentId: string,
  deckPath: string
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await ingestDeckDocument(
    supabase,
    user.id,
    startupId,
    documentId,
    deckPath
  );

  if ("error" in result) {
    return { error: result.error };
  }

  const client = createAnthropicClient();

  // The actual review generation is deliberately NOT run here. It used to
  // be (first missing entirely, then run inline via Promise.allSettled
  // alongside extraction), but that meant an analyst sat on the *upload*
  // page watching a single "reading" cat for the full 30-90s a review
  // takes, with no visible distinction between "still reading the deck"
  // and "now writing the review" - and no page to actually watch it land
  // on. Every redirect below instead sends the analyst straight to the new
  // startup's own page with ?autogen=1, where GenerateReviewForm submits
  // itself on mount - the exact same code path (and mascot activity
  // syncing) as clicking "Generate Review" by hand, just automatic. Extract
  // first, then redirect, then generate: the analyst sees the page and its
  // extracted fields immediately, and watches the review write itself in
  // place instead of waiting through a blank screen for both to finish.
  let response;
  try {
    response = await client.messages.create({
      // This is a mechanical "copy down what's literally printed on the
      // slide" task, not an analytical one - Opus's extra reasoning depth
      // (used for the actual review, where it matters) doesn't buy anything
      // here, only latency. Sonnet is fast enough to make this feel closer
      // to instant instead of tying up the same 30-90s an analyst expects
      // for a full review.
      model: CHAT_MODEL,
      // 1024 was too tight once a deck runs to dozens of image pages -
      // effort spent tokens on reasoning over all of them before it ever
      // wrote the (tiny) JSON answer, so large decks hit the cap with no
      // text block yet emitted and silently extracted nothing. Left with
      // headroom even at "low" effort now that the model switch above also
      // cuts down how much of that budget reasoning eats into.
      max_tokens: 4096,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: STARTUP_INFO_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            ...result.imageBlocks,
            { type: "text", text: buildStartupInfoPrompt() },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("Startup info extraction failed:", err);
    // Extraction failing shouldn't block the startup from being created
    // with its deck attached - the analyst can fill the rest in by hand
    // via Edit. Surfaced as an error banner rather than failing silently,
    // so a blank card doesn't look like the deck just had no info in it.
    // Still autogen=1: the deck itself ingested fine, and the review reads
    // it directly rather than depending on anything extraction produces.
    revalidatePath(`/startups/${startupId}`);
    redirect(
      `/startups/${startupId}?autogen=1&error=${encodeURIComponent("The deck was attached, but automatic info extraction failed - fill in the fields by hand using Edit.")}`
    );
  }

  if (response.stop_reason === "refusal") {
    revalidatePath(`/startups/${startupId}`);
    redirect(
      `/startups/${startupId}?autogen=1&error=${encodeURIComponent("The deck was attached, but the model declined to extract its info - fill in the fields by hand using Edit.")}`
    );
  }

  const textBlock = response.content
    .filter((block) => block.type === "text")
    .at(-1);

  // Populated on the successful-parse path below; checked for a duplicate
  // *after* the try/catch closes, since redirect() throws internally and
  // calling it from inside this try would be caught by its own catch below
  // and misreported as a parse failure.
  let extractedName: string | null = null;

  if (textBlock && textBlock.type === "text") {
    try {
      const extracted = repairLiteralUnicodeEscapes(
        JSON.parse(textBlock.text) as {
          name: string;
          domain: string;
          sector: string;
          stage: string;
          ask_amount: string;
          founder_names: string;
        }
      );

      const askAmountDigits = extracted.ask_amount.replace(/[^0-9.]/g, "");
      const askAmountNumber = askAmountDigits ? Number(askAmountDigits) : null;
      const finalName = extracted.name.trim();

      await supabase
        .from("startups")
        .update({
          ...(finalName ? { name: finalName } : {}),
          domain: extracted.domain.trim() || null,
          sector: extracted.sector || null,
          stage: extracted.stage || null,
          ask_amount:
            askAmountNumber != null && !Number.isNaN(askAmountNumber)
              ? askAmountNumber
              : null,
          founder_names: extracted.founder_names.trim() || null,
        })
        .eq("id", startupId);

      extractedName = finalName || null;
    } catch (err) {
      console.error("Could not parse extracted startup info:", err);
      revalidatePath(`/startups/${startupId}`);
      redirect(
        `/startups/${startupId}?autogen=1&error=${encodeURIComponent("The deck was attached, but automatic info extraction failed to parse - fill in the fields by hand using Edit.")}`
      );
    }
  } else {
    // No text block at all (e.g. stop_reason "max_tokens" cut the response
    // off before the model wrote its answer) used to fall through here
    // silently, leaving the placeholder name in place with no indication
    // anything had gone wrong - surfaced the same way the other failure
    // modes above already are.
    console.error(
      "Startup info extraction produced no text block:",
      response.stop_reason
    );
    revalidatePath(`/startups/${startupId}`);
    redirect(
      `/startups/${startupId}?autogen=1&error=${encodeURIComponent("The deck was attached, but automatic info extraction didn't return anything usable - fill in the fields by hand using Edit.")}`
    );
  }

  revalidatePath(`/startups/${startupId}`);
  revalidatePath("/dashboard");

  // "Create from deck" always makes a brand-new startup row - it has no way
  // to know the analyst meant to refresh an existing one. Re-running it on
  // the same company's deck (an easy mistake, since it's the form that
  // seems to "do everything") silently produces an exact duplicate. This
  // can't prevent that - the draft row already exists by this point - but
  // at least surfaces it immediately instead of the duplicate sitting
  // unnoticed in the dashboard list.
  if (extractedName) {
    const { data: duplicates } = await supabase
      .from("startups")
      .select("id")
      .ilike("name", extractedName)
      .neq("id", startupId)
      .limit(1);

    if (duplicates && duplicates.length > 0) {
      redirect(
        `/startups/${startupId}?autogen=1&error=${encodeURIComponent(`A startup named "${extractedName}" already exists on your team. If this is the same company, delete one of them to avoid a duplicate.`)}`
      );
    }
  }

  redirect(`/startups/${startupId}?autogen=1`);
}

export async function updateStartup(
  formData: FormData
): Promise<{ error: string } | void> {
  const startupId = String(formData.get("startup_id") ?? "");
  if (!startupId) {
    return { error: "Missing startup." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Name is required." };
  }

  const domain = String(formData.get("domain") ?? "").trim() || null;
  const sector = String(formData.get("sector") ?? "").trim() || null;
  const stage = String(formData.get("stage") ?? "").trim() || null;
  const askRaw = String(formData.get("ask_amount") ?? "").trim();
  const ask_amount = askRaw ? Number(askRaw) : null;
  const founder_names =
    String(formData.get("founder_names") ?? "").trim() || null;

  const { error } = await supabase
    .from("startups")
    .update({ name, domain, sector, stage, ask_amount, founder_names })
    .eq("id", startupId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/startups/${startupId}`);
  revalidatePath("/dashboard");
}

// Removes the deck's storage objects (the uploaded PDF and its rendered page
// images) alongside the `documents` row, so a deck that's no longer
// relevant doesn't linger in Storage. Past reviews are left as historical
// snapshots in the DB, but the page only displays a review while a deck
// exists (see page.tsx) - a review with no deck behind it isn't trustworthy
// to show as current.
export async function deleteDeck(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const startupId = String(formData.get("startup_id") ?? "");

  if (!id || !startupId) {
    return;
  }

  const supabase = await createClient();

  const { data: deck } = await supabase
    .from("documents")
    .select("file_url, page_image_urls")
    .eq("id", id)
    .eq("type", "deck")
    .maybeSingle();

  if (deck) {
    const paths = [
      ...(deck.file_url ? [deck.file_url] : []),
      ...deck.page_image_urls,
    ];
    if (paths.length > 0) {
      await supabase.storage.from(DECK_BUCKET).remove(paths);
    }
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("type", "deck");

  if (error) {
    redirect(`/startups/${startupId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/startups/${startupId}`);
  redirect(`/startups/${startupId}`);
}

// A short-lived signed URL rather than a public one - the deck bucket is
// private (team-scoped via RLS), so the download link itself must expire
// quickly instead of being a permanently guessable URL.
export async function getDeckDownloadUrl(
  startupId: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: deck } = await supabase
    .from("documents")
    .select("file_url")
    .eq("startup_id", startupId)
    .eq("type", "deck")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!deck?.file_url) {
    return { error: "No deck to download." };
  }

  // `download: true` sets Content-Disposition: attachment on the response,
  // so the browser saves the file instead of navigating to render the PDF
  // inline - what a "Download" button should actually do.
  const { data, error } = await supabase.storage
    .from(DECK_BUCKET)
    .createSignedUrl(deck.file_url, 60, { download: "deck.pdf" });

  if (error || !data) {
    return { error: error?.message ?? "Could not create a download link." };
  }

  return { url: data.signedUrl };
}

// Comments come in two audiences (see documents.audience in schema.sql):
// 'evidence' is sent to the model as review input (a call transcript, a
// verified fact) and can optionally be submitted from an uploaded file;
// 'discussion' is team chatter, shown only in the floating discussion
// widget, and never reaches the model. The file-upload branch works for
// either audience, though the discussion UI doesn't expose it.
export async function addComment(
  formData: FormData
): Promise<{ error: string } | { ok: true; reviewRegenerating: boolean }> {
  const startupId = String(formData.get("startup_id") ?? "");
  if (!startupId) {
    return { error: "Missing startup." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const audience: CommentAudience =
    formData.get("audience") === "discussion" ? "discussion" : "evidence";
  const label = String(formData.get("label") ?? "").trim() || null;
  const pastedText = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  let extractedText: string;

  if (hasFile) {
    const uploadedFile = file as File;
    const name = uploadedFile.name.toLowerCase();
    const buffer = Buffer.from(await uploadedFile.arrayBuffer());

    if (name.endsWith(".docx")) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value.trim();
      } catch (err) {
        return {
          error: `Could not read this .docx file: ${err instanceof Error ? err.message : "unknown error"}`,
        };
      }
    } else if (name.endsWith(".txt") || uploadedFile.type === "text/plain") {
      extractedText = buffer.toString("utf-8").trim();
    } else {
      return { error: "Only .txt or .docx files are supported." };
    }
  } else if (pastedText) {
    extractedText = pastedText;
  } else {
    return {
      error:
        audience === "discussion"
          ? "Write a message before adding it."
          : "Paste text or upload a .txt/.docx file.",
    };
  }

  if (!extractedText) {
    return {
      error:
        audience === "discussion"
          ? "The message appears to be empty."
          : "The evidence appears to be empty.",
    };
  }

  const { error: insertError } = await supabase.from("documents").insert({
    startup_id: startupId,
    type: "comment",
    audience,
    file_url: null,
    extracted_text: extractedText,
    label,
    uploaded_by: user.id,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  const reviewRegenerating =
    audience === "evidence"
      ? await maybeTriggerBackgroundRegeneration(supabase, startupId)
      : false;

  revalidatePath(`/startups/${startupId}`);
  return { ok: true, reviewRegenerating };
}

export async function deleteComment(
  formData: FormData
): Promise<{ error: string } | { ok: true; reviewRegenerating: boolean }> {
  const id = String(formData.get("id") ?? "");
  const startupId = String(formData.get("startup_id") ?? "");

  if (!id || !startupId) {
    return { error: "Missing item." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("documents")
    .select("audience")
    .eq("id", id)
    .eq("type", "comment")
    .maybeSingle();

  // Belt-and-suspenders alongside the Step 12 RLS policy: RLS blocking the
  // delete would otherwise report success with zero rows affected (not an
  // error), which would look like a silent no-op bug rather than a real
  // permission denial - this gives a clear message instead.
  if (existing?.audience === "discussion") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    if (profile?.role !== "admin") {
      return { error: "Only an admin can delete discussion messages." };
    }
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("type", "comment");

  if (error) {
    return { error: error.message };
  }

  const reviewRegenerating =
    existing?.audience === "evidence"
      ? await maybeTriggerBackgroundRegeneration(supabase, startupId)
      : false;

  revalidatePath(`/startups/${startupId}`);
  return { ok: true, reviewRegenerating };
}

export async function generateReview(formData: FormData) {
  const startupId = String(formData.get("startup_id") ?? "");
  if (!startupId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await runReviewGeneration(supabase, startupId);
  if ("error" in result) {
    redirect(`/startups/${startupId}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/startups/${startupId}`);
  redirect(`/startups/${startupId}`);
}

// An analyst dismissing a contradiction is a curation decision, not a
// correction to the AI - it doesn't call the model or touch the
// `contradictions` array itself (that stays the untouched AI output for the
// record). It just marks that index as not relevant on this review row, so
// the panel and the header's count both skip it. Dismissals live on the
// review row rather than a separate table because a regeneration replaces
// the whole row anyway (see runReviewGeneration) - there's nothing to carry
// forward once the AI re-evaluates from scratch.
async function setContradictionDismissed(
  formData: FormData,
  dismissed: boolean
) {
  const reviewId = String(formData.get("review_id") ?? "");
  const startupId = String(formData.get("startup_id") ?? "");
  const index = Number(formData.get("index"));

  if (!reviewId || !startupId || !Number.isInteger(index)) {
    return;
  }

  const supabase = await createClient();
  const { data: review } = await supabase
    .from("reviews")
    .select("dismissed_contradiction_indices")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return;
  }

  const current = review.dismissed_contradiction_indices;
  const next = dismissed
    ? current.includes(index)
      ? current
      : [...current, index]
    : current.filter((i) => i !== index);

  const { error } = await supabase
    .from("reviews")
    .update({ dismissed_contradiction_indices: next })
    .eq("id", reviewId);

  if (error) {
    console.error("Failed to update dismissed contradictions:", error.message);
  }

  revalidatePath(`/startups/${startupId}`);
}

export async function dismissContradiction(formData: FormData) {
  await setContradictionDismissed(formData, true);
}

export async function restoreContradiction(formData: FormData) {
  await setContradictionDismissed(formData, false);
}

export async function enrichStartup(
  formData: FormData
): Promise<{ error: string } | { ok: true; reviewRegenerating: boolean }> {
  const startupId = String(formData.get("startup_id") ?? "");
  if (!startupId) {
    return { error: "Missing startup." };
  }

  const depthRaw = String(formData.get("depth") ?? "");
  const depth: ResearchDepth = (RESEARCH_DEPTHS as readonly string[]).includes(
    depthRaw
  )
    ? (depthRaw as ResearchDepth)
    : "medium";
  const depthConfig = RESEARCH_DEPTH_CONFIG[depth];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Confidentiality boundary: only the startup's public basic-info fields
  // are read here - no deck or evidence content is fetched by this action,
  // so there is nothing proprietary for the web-search-enabled request
  // below to see.
  const { data: startup, error: startupError } = await supabase
    .from("startups")
    .select("name, domain, founder_names")
    .eq("id", startupId)
    .single();

  if (startupError || !startup) {
    return { error: "Could not load this startup's details." };
  }

  const client = createAnthropicClient();

  let response;
  try {
    response = await client.messages.create({
      model: ENRICHMENT_MODEL,
      max_tokens: depthConfig.maxTokens,
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: depthConfig.maxSearches,
        },
      ],
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: buildEnrichmentSchema(depth) },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildEnrichmentPrompt(
                startup.name,
                startup.domain,
                startup.founder_names,
                depth
              ),
            },
          ],
        },
      ],
    });
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "The Anthropic API request failed.",
    };
  }

  if (response.stop_reason === "refusal") {
    return { error: "The model declined to research this startup." };
  }

  if (response.stop_reason === "pause_turn") {
    return {
      error: "Research took too many search steps to finish - try again.",
    };
  }

  const textBlock = response.content
    .filter((block) => block.type === "text")
    .at(-1);
  if (!textBlock || textBlock.type !== "text") {
    return { error: "The model did not return research results." };
  }

  let parsed: { findings: KeyFinding[]; last_round_summary: string };
  try {
    parsed = repairLiteralUnicodeEscapes(
      JSON.parse(textBlock.text) as typeof parsed
    );
  } catch {
    return { error: "Could not parse the research results." };
  }

  const rawResults = response.content.filter(
    (block) => block.type === "web_search_tool_result"
  );

  // Never trust a URL as the model typed it - it can misremember or
  // construct one that looks plausible but doesn't actually resolve. Only
  // keep findings whose URL was a real result a search for this request
  // actually returned.
  const verifiedUrls = new Set<string>();
  for (const block of rawResults) {
    if (Array.isArray(block.content)) {
      for (const result of block.content) {
        if (result.type === "web_search_result") {
          verifiedUrls.add(result.url);
        }
      }
    }
  }

  // The schema can no longer enforce the count itself (see FINDINGS_MAX
  // above), so it's capped here instead - after verification, not before,
  // so a low-confidence finding that fails the URL check doesn't take a
  // slot from a real one further down the model's own ranked list.
  const findingsMax = FINDINGS_MAX[depth];
  const verifiedFindings: KeyFinding[] = parsed.findings
    .filter((finding) => verifiedUrls.has(finding.url))
    .slice(0, findingsMax ?? Infinity);

  const summaryText =
    verifiedFindings.length > 0
      ? verifiedFindings
          .map((f) => `${f.point} (Source: ${f.source_name}, ${f.url})`)
          .join("\n")
      : "No verifiable public findings.";

  const { error: insertError2 } = await supabase
    .from("enrichment_findings")
    .insert({
      startup_id: startupId,
      source: "web_search",
      summary_text: summaryText,
      last_round_summary: parsed.last_round_summary.trim() || null,
      key_findings: verifiedFindings,
      raw_results: rawResults,
    });

  if (insertError2) {
    return { error: insertError2.message };
  }

  const reviewRegenerating = await maybeTriggerBackgroundRegeneration(
    supabase,
    startupId
  );

  revalidatePath(`/startups/${startupId}`);
  return { ok: true, reviewRegenerating };
}

const CHAT_MODEL = "claude-sonnet-5";
// Cheap and fast rather than deep - this answers quick questions during a
// live chat, not a one-shot analysis, so it trades the review's Opus
// thoroughness for snappier turnaround.
const MAX_CHAT_HISTORY_TURNS = 20;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// Shared by askAboutStartup and getSuggestedQuestions - both ground their
// prompt in the exact same page material (deck, evidence, research,
// review), so the fetching and section-assembly logic lives in one place
// instead of two copies drifting apart. Returns null only if the startup
// itself can't be loaded; a `sections` of length 1 (just "Basic info")
// means there's no real material yet.
async function gatherStartupContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startupId: string
): Promise<{ sections: string[] } | null> {
  const { data: startup, error: startupError } = await supabase
    .from("startups")
    .select("name, domain, sector, stage, ask_amount, founder_names, status")
    .eq("id", startupId)
    .single();

  if (startupError || !startup) {
    return null;
  }

  const { data: deck } = await supabase
    .from("documents")
    .select("extracted_text")
    .eq("startup_id", startupId)
    .eq("type", "deck")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: evidenceRows } = await supabase
    .from("documents")
    .select("label, extracted_text")
    .eq("startup_id", startupId)
    .eq("type", "comment")
    .eq("audience", "evidence");

  const { data: enrichment } = await supabase
    .from("enrichment_findings")
    .select("summary_text, last_round_summary, key_findings")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: review } = await supabase
    .from("reviews")
    .select(
      "version, verdict, thesis, snapshot, why_invest, why_not, unknowns, contradictions, dismissed_contradiction_indices"
    )
    .eq("startup_id", startupId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sections: string[] = [
    [
      `--- Basic info ---`,
      `Name: ${startup.name}`,
      `Domain: ${startup.domain ?? "unknown"}`,
      `Sector: ${startup.sector ?? "unknown"}`,
      `Stage: ${startup.stage ?? "unknown"}`,
      `Ask: ${startup.ask_amount ? `$${startup.ask_amount.toLocaleString()}` : "unknown"}`,
      `Founders: ${startup.founder_names ?? "unknown"}`,
      `Pipeline status: ${startup.status}`,
    ].join("\n"),
  ];

  if (deck?.extracted_text) {
    sections.push(`--- Pitch deck (extracted text) ---\n${deck.extracted_text}`);
  }

  for (const row of evidenceRows ?? []) {
    if (row.extracted_text) {
      sections.push(
        `--- Evidence: "${row.label ?? "Untitled"}" ---\n${row.extracted_text}`
      );
    }
  }

  if (enrichment) {
    const parts = [`--- Public research ---`, enrichment.summary_text];
    if (enrichment.last_round_summary) {
      parts.push(`Last funding round: ${enrichment.last_round_summary}`);
    }
    if (enrichment.key_findings.length > 0) {
      parts.push(
        "Key findings:\n" +
          enrichment.key_findings
            .map((f) => `- ${f.point} (source: ${f.source_name})`)
            .join("\n")
      );
    }
    sections.push(parts.join("\n"));
  }

  if (review) {
    const activeContradictions = review.contradictions.filter(
      (_, i) => !review.dismissed_contradiction_indices.includes(i)
    );
    sections.push(
      [
        `--- AI-generated review (version ${review.version}) ---`,
        `Verdict: ${review.verdict}`,
        `Thesis: ${review.thesis}`,
        `Snapshot: ${review.snapshot}`,
        `Why invest:\n${review.why_invest.map((p) => `- ${p.point}`).join("\n")}`,
        `Why not:\n${review.why_not.map((p) => `- ${p.point}`).join("\n")}`,
        activeContradictions.length > 0
          ? `Contradictions:\n${activeContradictions.map((c) => `- ${c.point} (deck says: ${c.deck_says}; call says: ${c.call_says})`).join("\n")}`
          : "",
        review.unknowns.length > 0
          ? `Unknowns:\n${review.unknowns.map((u) => `- ${u}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return { sections };
}

// Answers analyst questions about one startup using only what's already on
// that startup's page - the deck text, evidence, public research, and the
// AI review - never the model's own outside knowledge. Deliberately
// excludes discussion messages: those are private team chatter (see
// discussion-chat.tsx - "never sent to the AI review"), and that boundary
// applies here too. Grounding data is re-fetched fresh on every question
// rather than passed in from the client, so the answer always reflects the
// current page, not what it looked like when the chat was opened.
//
// Conversation history is read from and written back to
// analyst_chat_messages, scoped to the calling analyst (auth.uid(), enforced
// by RLS - see Step 15 in schema.sql) rather than passed in from the client -
// so each analyst gets their own private, persistent PurrAI thread per
// startup, and never sees another analyst's questions.
export async function askAboutStartup(
  startupId: string,
  question: string
): Promise<{ answer: string } | { error: string }> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return { error: "Ask something first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in to ask PurrAI anything." };
  }

  const context = await gatherStartupContext(supabase, startupId);
  if (!context) {
    return { error: "Could not load this startup." };
  }

  if (context.sections.length <= 1) {
    return {
      answer:
        "There's nothing on this page yet for me to work from - no deck, evidence, research, or review. Add some material first and I'll be able to help.",
    };
  }

  const { data: historyRows } = await supabase
    .from("analyst_chat_messages")
    .select("role, content")
    .eq("startup_id", startupId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_CHAT_HISTORY_TURNS);
  const history = (historyRows ?? []).reverse();

  const systemPrompt = `You are a sharp, friendly research-assistant cat helping a venture-capital analyst quickly understand ONE specific startup. Answer using ONLY the material below - the pitch deck, evidence the team collected, public research, and the AI-generated review already on this page. Never use outside knowledge about this company, its market, or its competitors that isn't stated in the material. If the material doesn't cover what's asked, say so plainly rather than guessing or inferring beyond what's written.

Be brief and straight to the point - this is a quick chat reply, not a report:
- Default to ONE short sentence.
- Use a tight bullet list (2-4 short bullets, a handful of words each) only when the question genuinely has multiple distinct parts - never bullets for a single-fact answer.
- No headers, no preamble, no restating the question, no closing remarks.
- Only go longer than this if the analyst explicitly asks for more detail.

A little cat personality in your tone is welcome, but don't let it get in the way of being brief.

${context.sections.join("\n\n")}`;

  const client = createAnthropicClient();

  const messages = [
    ...history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user" as const, content: trimmedQuestion },
  ];

  let response;
  try {
    response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 180,
      system: systemPrompt,
      messages,
    });
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "The Anthropic API request failed.",
    };
  }

  if (response.stop_reason === "refusal") {
    return { error: "I'd rather not answer that one." };
  }

  const textBlock = response.content.filter((block) => block.type === "text").at(-1);
  if (!textBlock || textBlock.type !== "text") {
    return { error: "Didn't get a usable answer back - try again." };
  }

  const answer = textBlock.text;

  // Best-effort: if this write fails the analyst still gets their answer
  // this turn, it just won't be there the next time they open the chat.
  await supabase.from("analyst_chat_messages").insert([
    {
      startup_id: startupId,
      user_id: user.id,
      role: "user",
      content: trimmedQuestion,
    },
    { startup_id: startupId, user_id: user.id, role: "assistant", content: answer },
  ]);

  return { answer };
}

// Loads this analyst's own prior PurrAI conversation for this startup - see
// the privacy note on askAboutStartup above. Called once when the chat
// panel opens so it shows real history instead of starting blank every
// visit, even though nothing about the conversation is kept client-side
// between mounts.
export async function getChatHistory(startupId: string): Promise<ChatTurn[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("analyst_chat_messages")
    .select("role, content")
    .eq("startup_id", startupId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_CHAT_HISTORY_TURNS);

  return (data ?? []).reverse();
}

// A few AI-generated starter questions grounded in the same material as
// askAboutStartup, so opening PurrAI on a startup for the first time gives
// an analyst something to click instead of a blank input. Best-effort -
// any failure (including "nothing to work from yet") just means no chips
// render; never an error the analyst has to deal with.
export async function getSuggestedQuestions(startupId: string): Promise<string[]> {
  const supabase = await createClient();
  const context = await gatherStartupContext(supabase, startupId);
  if (!context || context.sections.length <= 1) return [];

  const systemPrompt = `Given the material below about a startup a venture-capital analyst is evaluating, write exactly 3 short, specific questions this analyst might want to ask about it. Each question must be under 8 words - punchy, like a quick Slack message, not a formal ask. Reply with the 3 questions only, one per line, no numbering, no bullets, no quotation marks, nothing else.

${context.sections.join("\n\n")}`;

  const client = createAnthropicClient();

  let response;
  try {
    response = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 100,
      system: systemPrompt,
      messages: [{ role: "user", content: "Suggest the questions now." }],
    });
  } catch {
    return [];
  }

  const textBlock = response.content.filter((block) => block.type === "text").at(-1);
  if (!textBlock || textBlock.type !== "text") return [];

  return textBlock.text
    .split("\n")
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}
