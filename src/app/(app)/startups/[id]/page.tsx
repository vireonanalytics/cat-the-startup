import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StartupHeader } from "@/components/startup-header";
import { GraveyardNote } from "@/components/graveyard-note";
import { ErrorBanner } from "@/components/error-banner";
import { StartupTabs } from "@/components/startup-tabs";
import { ReviewPanel } from "@/components/review-panel";
import { DeckPanel } from "@/components/deck-panel";
import { ResearchPanel } from "@/components/research-panel";
import { EvidencePanel } from "@/components/evidence-panel";
import { DiscussionChat } from "@/components/discussion-chat";
import { AnalystCatChat } from "@/components/analyst-cat-chat";
import { ReviewRegenerationProvider } from "@/components/review-regeneration-context";
import type { ReviewVersionData } from "@/lib/review-diff";

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// A version's "generated from" line describes exactly what fed *that*
// generation (its stored input snapshot), not whatever the startup's state
// happens to be right now - otherwise every historical version would
// misleadingly describe today's evidence count.
function buildProvenance(
  row: {
    deck_document_id: string | null;
    evidence_document_ids: string[];
    enrichment_finding_id: string | null;
  },
  deckPageCountById: Map<string, number>
): string {
  const pageCount = row.deck_document_id
    ? deckPageCountById.get(row.deck_document_id)
    : undefined;
  const deckPart = row.deck_document_id
    ? pageCount != null
      ? `the deck (${pluralize(pageCount, "page")})`
      : "the deck"
    : null;
  const evidencePart =
    row.evidence_document_ids.length > 0
      ? pluralize(row.evidence_document_ids.length, "evidence item")
      : null;
  const researchPart = row.enrichment_finding_id ? "public research" : null;

  return [deckPart, evidencePart, researchPart].filter(Boolean).join(", ");
}

export default async function StartupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; graveyard?: string; autogen?: string }>;
}) {
  const { id } = await params;
  const {
    error: errorParam,
    graveyard: graveyardParam,
    autogen: autogenParam,
  } = await searchParams;

  const supabase = await createClient();
  const { data: startup, error } = await supabase
    .from("startups")
    .select(
      "id, name, domain, sector, stage, ask_amount, founder_names, status, created_at"
    )
    .eq("id", id)
    .single();

  if (error || !startup) {
    notFound();
  }

  const { data: deck } = await supabase
    .from("documents")
    .select("id, page_image_urls, uploaded_at")
    .eq("startup_id", id)
    .eq("type", "deck")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Every deck ever uploaded (not just the current one) - lets a historical
  // review's provenance line still show a page count even after the deck it
  // was generated from has since been replaced or deleted.
  const { data: allDeckDocs } = await supabase
    .from("documents")
    .select("id, page_image_urls")
    .eq("startup_id", id)
    .eq("type", "deck");

  const deckPageCountById = new Map(
    (allDeckDocs ?? []).map((d) => [d.id, d.page_image_urls.length])
  );

  // Full version history, newest first. Unlike the old single-review
  // lookup, this is no longer gated on a deck currently existing - history
  // stays browsable even if the deck that produced it was later deleted or
  // replaced; only *generating a new* review requires a live deck (see
  // GenerateReviewForm's hasDeck gating below).
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select(
      "id, version, verdict, thesis, snapshot, why_invest, why_not, unknowns, contradictions, dismissed_contradiction_indices, deck_document_id, evidence_document_ids, enrichment_finding_id, generated_at, model_version"
    )
    .eq("startup_id", id)
    .order("version", { ascending: false });

  // Versions generated before the verdict/thesis columns existed have those
  // as null - drop them rather than rendering a blank verdict badge.
  const versions: ReviewVersionData[] = (reviewRows ?? [])
    .filter((row) => row.verdict && row.thesis)
    .map((row) => ({
      id: row.id,
      version: row.version,
      verdict: row.verdict!,
      thesis: row.thesis!,
      snapshot: row.snapshot,
      why_invest: row.why_invest,
      why_not: row.why_not,
      contradictions: row.contradictions,
      dismissed_contradiction_indices: row.dismissed_contradiction_indices,
      unknowns: row.unknowns,
      generated_at: row.generated_at,
      model_version: row.model_version,
      provenance: buildProvenance(row, deckPageCountById),
    }));

  const latestVersion = versions[0] ?? null;
  const activeContradictionsCount = latestVersion
    ? latestVersion.contradictions.length -
      latestVersion.dismissed_contradiction_indices.length
    : null;

  const { data: evidenceRows } = await supabase
    .from("documents")
    .select("id, label, extracted_text, uploaded_at")
    .eq("startup_id", id)
    .eq("type", "comment")
    .eq("audience", "evidence")
    .order("uploaded_at", { ascending: false });

  const { data: discussionRows } = await supabase
    .from("documents")
    .select("id, extracted_text, uploaded_at, author:users(name)")
    .eq("startup_id", id)
    .eq("type", "comment")
    .eq("audience", "discussion")
    .order("uploaded_at", { ascending: true });

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const { data: currentProfile } = currentUser
    ? await supabase.from("users").select("role").eq("id", currentUser.id).maybeSingle()
    : { data: null };
  const isAdmin = currentProfile?.role === "admin";

  const { data: enrichment } = await supabase
    .from("enrichment_findings")
    .select("key_findings, last_round_summary, created_at")
    .eq("startup_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Analyst-added links (see FoundersChip in startup-header.tsx) - kept
  // separate from key_findings above since that row is wholesale replaced
  // by every "Refresh research" run, which would silently wipe these.
  const { data: founderLinks } = await supabase
    .from("founder_links")
    .select("founder_name, linkedin_url")
    .eq("startup_id", id);

  return (
    <div className="flex gap-6">
      {/* No max-w cap - main (see (app)/layout.tsx) is now a real flex-1
          column genuinely bounded by the aside's reserved w-80, so this
          card can fill 100% of main's width at any viewport size without
          ever growing a gap before the aside or overlapping it - both are
          now structural guarantees of the layout, not a fixed cap tuned to
          look right at whatever width was last tested. */}
      <div className="min-w-0 flex-1">
        <Link
          href="/dashboard"
          className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to dashboard
        </Link>

        {graveyardParam && <GraveyardNote />}

        {errorParam && <ErrorBanner message={errorParam} />}

        <StartupHeader
          startup={startup}
          lastRoundSummary={enrichment?.last_round_summary ?? null}
          contradictionsCount={activeContradictionsCount}
          keyFindings={enrichment?.key_findings ?? []}
          founderLinks={founderLinks ?? []}
        />

        <ReviewRegenerationProvider
          startupId={startup.id}
          initialGeneratedAt={latestVersion?.generated_at ?? null}
        >
          <StartupTabs
            review={
              <ReviewPanel
                startupId={startup.id}
                hasDeck={Boolean(deck)}
                versions={versions}
                autoTrigger={autogenParam === "1"}
              />
            }
            deck={<DeckPanel startupId={startup.id} deck={deck ?? null} />}
            research={
              <ResearchPanel startupId={startup.id} enrichment={enrichment ?? null} />
            }
            evidence={
              <EvidencePanel startupId={startup.id} items={evidenceRows ?? []} />
            }
          />
        </ReviewRegenerationProvider>
      </div>

      <DiscussionChat
        startupId={startup.id}
        items={discussionRows ?? []}
        canDelete={isAdmin}
      />
      <AnalystCatChat startupId={startup.id} startupName={startup.name} />
    </div>
  );
}
