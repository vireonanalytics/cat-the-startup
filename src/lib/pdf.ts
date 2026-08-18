import { pdf } from "pdf-to-img";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";

// Anthropic enforces a stricter per-image dimension cap when a request
// carries many images (as a full deck does) than it does for a single
// image. Rendering at scale 2 can exceed that cap on larger page sizes, so
// every page is normalized to fit within it before being stored.
const MAX_IMAGE_DIMENSION = 1568;

export async function renderPdfPagesToImages(
  buffer: Buffer
): Promise<Buffer[]> {
  // Rendering each page has to stay sequential - pdf-to-img hands back one
  // shared document's pages via an async iterator, not independent work.
  // Resizing them doesn't share that constraint: each call is an
  // independent sharp/libvips operation, and libvips runs its own thread
  // pool, so awaiting them together actually uses more than one core
  // instead of processing a 20+ page deck's pages one at a time.
  const document = await pdf(buffer, { scale: 2 });
  const rawPages: Buffer[] = [];
  for await (const page of document) {
    rawPages.push(page);
  }
  return Promise.all(rawPages.map(normalizeImageSize));
}

function normalizeImageSize(image: Buffer): Promise<Buffer> {
  return sharp(image)
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
