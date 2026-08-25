import Anthropic from "@anthropic-ai/sdk";

import { requireEnv } from "@/config.js";

/**
 * The shared Claude client — used by `claude.ts` (relevance assessment) and
 * `sources/scrape.ts` (extracting items from pages without RSS).
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  return client;
}

/**
 * Haiku 4.5 — a 1-5 classification plus a 2-3 sentence summary is a task where
 * a stronger model does not pay for itself (5x cheaper input/output than Opus).
 * 200K of context is more than enough even for HTML scraping.
 *
 * A warning when swapping it: Haiku 4.5 does not accept
 * `output_config.effort` — setting it ends with a 400.
 */
export const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5";
