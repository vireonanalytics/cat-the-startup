import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist (used by pdf-to-img and pdf-parse for PDF rendering/parsing)
  // dynamically imports its worker script by path. Bundling it breaks that
  // import, so it's excluded from bundling and loaded via native `require`.
  // @napi-rs/canvas is pdfjs-dist's native rendering backend (it provides
  // DOMMatrix/ImageData/Path2D, which don't otherwise exist in a Node
  // serverless runtime) - it ships prebuilt per-platform binaries, so it
  // needs the same external-package treatment or Vercel's Linux build
  // (correctly) can't find a bundled binary that runs on it.
  serverExternalPackages: [
    "pdfjs-dist",
    "pdf-to-img",
    "pdf-parse",
    "@napi-rs/canvas",
  ],
  // serverExternalPackages alone isn't enough for @napi-rs/canvas - pdfjs-dist
  // reaches it via a runtime-constructed require() (createRequire(...)("@napi-rs/canvas")
  // inside node_utils.js), which the file tracer can't follow statically, so
  // it silently drops the package's prebuilt platform binary from the deployed
  // function even though it installs fine at build time. A wildcard key
  // rather than the specific routes that touch deck PDFs, because Next.js
  // deduplicates identical function bundles across routes (confirmed via
  // `vercel build` + inspecting .vercel/output/functions directly) - keying
  // this to e.g. "/startups/[id]" silently no-ops whenever that route's
  // bundle gets merged into some other route's, which it does here.
  outputFileTracingIncludes: {
    "/*": ["node_modules/@napi-rs/**/*"],
  },
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
