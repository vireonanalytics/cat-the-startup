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
  const document = await pdf(buffer, { scale: 2 });
  const pages: Buffer[] = [];
  for await (const page of document) {
    pages.push(await normalizeImageSize(page));
  }
  return pages;
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
