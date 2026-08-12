"use server";

import { redirect } from "next/navigation";
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { createClient } from "@/lib/supabase/server";
import type { Contradiction, ReviewPoint } from "@/lib/supabase/types";

const HEADING_COLOR = "1F2937"; // zinc-800 - keeps section headers legible without shouting
const MUTED_COLOR = "6B7280"; // zinc-500 - captions, dates, citations
const INVEST_COLOR = "047857"; // emerald-700
const CAUTION_COLOR = "B91C1C"; // red-700
const CONTRADICTION_COLOR = "B45309"; // amber-700

function slugForFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "startup";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAsk(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function heading(text: string, color: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, color, bold: true })],
  });
}

function bulletPoint(items: readonly TextRun[]): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 260 },
    children: [new TextRun({ text: "•  " }), ...items],
  });
}

// point + citation, in the same one-sentence-plus-source convention the
// Review tab itself uses (see ReviewContent) - a partner reading this cold
// should still see exactly where each claim comes from.
function reviewPointParagraphs(points: readonly ReviewPoint[]): Paragraph[] {
  return points.map((item) =>
    bulletPoint([
      new TextRun({ text: item.point, bold: true }),
      new TextRun({ text: `  —  ${item.evidence}`, color: MUTED_COLOR, italics: true }),
    ])
  );
}

function contradictionParagraphs(items: readonly Contradiction[]): Paragraph[] {
  return items.flatMap((item) => [
    new Paragraph({
      spacing: { before: 100, after: 40 },
      indent: { left: 260 },
      children: [
        new TextRun({ text: "•  ", }),
        new TextRun({ text: item.point, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { after: 20 },
      indent: { left: 520 },
      children: [
        new TextRun({ text: "Claim: ", bold: true, size: 20 }),
        new TextRun({ text: item.deck_says, size: 20 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      indent: { left: 520 },
      children: [
        new TextRun({ text: "Reality: ", bold: true, size: 20 }),
        new TextRun({ text: item.call_says, size: 20 }),
      ],
    }),
  ]);
}

function infoRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, color: MUTED_COLOR, size: 20 }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 72, type: WidthType.PERCENTAGE },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: value })] })],
      }),
    ],
  });
}

function buildMemoDocument(input: {
  startup: {
    name: string;
    domain: string | null;
    sector: string | null;
    stage: string | null;
    ask_amount: number | null;
    founder_names: string | null;
  };
  review: {
    verdict: string;
    thesis: string;
    snapshot: string;
    why_invest: ReviewPoint[];
    why_not: ReviewPoint[];
    unknowns: string[];
    generated_at: string;
  };
  openContradictions: Contradiction[];
  evidence: { label: string | null; uploaded_at: string }[];
  exportedAt: string;
}): Document {
  const { startup, review, openContradictions, evidence, exportedAt } = input;

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: startup.name })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: "Investment Committee Memo",
          italics: true,
          color: MUTED_COLOR,
        }),
      ],
    }),

    new Paragraph({ text: "" }), // spacer before the info table
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Review generated ${formatDate(review.generated_at)}  ·  Memo exported ${formatDate(exportedAt)}  ·  Cat the Startup`,
                    size: 16,
                    color: MUTED_COLOR,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...children,
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow("Sector", startup.sector ?? "—"),
              infoRow("Stage", startup.stage ?? "—"),
              infoRow("Ask", formatAsk(startup.ask_amount)),
              infoRow("Domain", startup.domain ?? "—"),
              infoRow("Founders", startup.founder_names ?? "—"),
            ],
          }),

          heading("Recommendation", HEADING_COLOR),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: review.verdict.toUpperCase(),
                bold: true,
                color: HEADING_COLOR,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: review.thesis, bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: review.snapshot, color: MUTED_COLOR }),
            ],
          }),

          heading("Why invest", INVEST_COLOR),
          ...(review.why_invest.length > 0
            ? reviewPointParagraphs(review.why_invest)
            : [
                new Paragraph({
                  children: [new TextRun({ text: "None recorded.", color: MUTED_COLOR })],
                }),
              ]),

          heading("Why not", CAUTION_COLOR),
          ...(review.why_not.length > 0
            ? reviewPointParagraphs(review.why_not)
            : [
                new Paragraph({
                  children: [new TextRun({ text: "None recorded.", color: MUTED_COLOR })],
                }),
              ]),

          ...(openContradictions.length > 0
            ? [
                heading("Open contradictions", CONTRADICTION_COLOR),
                ...contradictionParagraphs(openContradictions),
              ]
            : []),

          ...(review.unknowns.length > 0
            ? [
                heading("Key unknowns", HEADING_COLOR),
                new Paragraph({
                  spacing: { after: 120 },
                  children: [
                    new TextRun({
                      text: review.unknowns.join("  ·  "),
                      color: MUTED_COLOR,
                    }),
                  ],
                }),
              ]
            : []),

          heading("Evidence considered", HEADING_COLOR),
          ...(evidence.length > 0
            ? evidence.map((item) =>
                bulletPoint([
                  new TextRun({ text: item.label ?? "Untitled evidence" }),
                  new TextRun({
                    text: `  —  ${formatDate(item.uploaded_at)}`,
                    color: MUTED_COLOR,
                  }),
                ])
              )
            : [
                new Paragraph({
                  children: [
                    new TextRun({ text: "No evidence logged.", color: MUTED_COLOR }),
                  ],
                }),
              ]),
        ],
      },
    ],
  });

  return doc;
}

// Generated fresh from live review/evidence data on every click rather than
// stored in Supabase Storage - there's no stable "memo" file to point a
// signed URL at, and this is small enough (base64, well under the Server
// Action body limit) to just return directly and turn into a client-side
// Blob download, matching this app's other client-invoked action patterns
// more closely than adding a Route Handler would.
export async function exportMemo(
  startupId: string
): Promise<{ base64: string; filename: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: startup, error: startupError } = await supabase
    .from("startups")
    .select("name, domain, sector, stage, ask_amount, founder_names")
    .eq("id", startupId)
    .single();

  if (startupError || !startup) {
    return { error: "Could not load this startup's details." };
  }

  const { data: reviewRow } = await supabase
    .from("reviews")
    .select(
      "verdict, thesis, snapshot, why_invest, why_not, contradictions, dismissed_contradiction_indices, unknowns, generated_at"
    )
    .eq("startup_id", startupId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reviewRow || !reviewRow.verdict || !reviewRow.thesis) {
    return { error: "Generate a review before exporting a memo." };
  }

  const { data: evidenceRows } = await supabase
    .from("documents")
    .select("label, uploaded_at")
    .eq("startup_id", startupId)
    .eq("type", "comment")
    .eq("audience", "evidence")
    .order("uploaded_at", { ascending: true });

  const dismissedSet = new Set(reviewRow.dismissed_contradiction_indices);
  const openContradictions = reviewRow.contradictions.filter(
    (_, index) => !dismissedSet.has(index)
  );

  const doc = buildMemoDocument({
    startup,
    review: {
      verdict: reviewRow.verdict,
      thesis: reviewRow.thesis,
      snapshot: reviewRow.snapshot,
      why_invest: reviewRow.why_invest,
      why_not: reviewRow.why_not,
      unknowns: reviewRow.unknowns,
      generated_at: reviewRow.generated_at,
    },
    openContradictions,
    evidence: evidenceRows ?? [],
    exportedAt: new Date().toISOString(),
  });

  const base64 = await Packer.toBase64String(doc);

  return { base64, filename: `${slugForFilename(startup.name)}-memo.docx` };
}
