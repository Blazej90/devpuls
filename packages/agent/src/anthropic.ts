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

/**
 * Haiku 4.5 — klasyfikacja 1-5 plus 2-3 zdania streszczenia to zadanie,
 * na którym mocniejszy model nie zarabia na siebie (5x tańszy input/output
 * niż Opus). 200K kontekstu z zapasem starcza nawet na scraping HTML.
 *
 * Uwaga przy podmianie: Haiku 4.5 nie przyjmuje `output_config.effort`
 * — ustawienie go kończy się błędem 400.
 */
export const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5";
