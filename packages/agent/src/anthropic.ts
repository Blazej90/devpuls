import Anthropic from "@anthropic-ai/sdk";

import { requireEnv } from "@/config.js";

/**
 * Współdzielony klient Claude — używany przez `claude.ts` (ocena trafności)
 * i `sources/scrape.ts` (wyciąganie wpisów ze stron bez RSS).
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  }
  return client;
}

export const MODEL = "claude-opus-5";
