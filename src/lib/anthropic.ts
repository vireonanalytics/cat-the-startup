import Anthropic from "@anthropic-ai/sdk";

// maxRetries above the SDK's default of 2: transient 5xx/overloaded errors
// happen during normal Anthropic load spikes, and every call site here is a
// non-interactive server action already showing a "thinking" state - a few
// extra retries with backoff costs nothing the analyst notices, but avoids
// dumping them into manual fallback (e.g. deck extraction failing) over a
// blip that would have succeeded a few seconds later.
export function createAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 5 });
}
