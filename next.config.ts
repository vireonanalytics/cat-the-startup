import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist (used by pdf-to-img and pdf-parse for PDF rendering/parsing)
  // dynamically imports its worker script by path. Bundling it breaks that
  // import, so it's excluded from bundling and loaded via native `require`.
  serverExternalPackages: ["pdfjs-dist", "pdf-to-img", "pdf-parse"],
  experimental: {
    serverActions: {
      // Transcript uploads (.txt/.docx) go straight through the addTranscript
      // Server Action's body rather than Storage, unlike the deck PDF - the
      // default 1MB limit is tight for a full call transcript in a .docx.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
