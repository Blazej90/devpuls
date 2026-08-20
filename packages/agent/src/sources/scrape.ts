import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { getAnthropic, MODEL } from "@/anthropic.js";
import { MAX_ITEMS_PER_SOURCE } from "@/config.js";
import type { NormalizedItem, SourceConfig } from "@/types.js";

/** Ile znaków HTML wysyłamy do modelu — strony indeksowe bywają ogromne. */
const MAX_HTML_CHARS = 120_000;

const ScrapedEntries = z.object({
  entries: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      publishedAt: z
        .string()
        .nullable()
        .describe("Data publikacji w ISO 8601 albo null, jeśli strona jej nie podaje"),
    }),
  ),
});

/** Usuwa to, co i tak nie niesie treści — skrypty, style, komentarze. */
function stripNoise(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Źródła bez RSS (np. Anthropic News). Zamiast dedykowanego parsera HTML
 * — który psuje się przy każdym redesignie — prosimy Claude o listę wpisów
 * jako ustrukturyzowany JSON (patrz CLAUDE.md, sekcja "Źródła danych agenta").
 */
export async function fetchScrape(
  source: SourceConfig,
): Promise<NormalizedItem[]> {
  const response = await fetch(source.url, {
    headers: { "user-agent": "DevPuls/0.1 (+https://github.com/Blazej90/devpuls)" },
  });

  if (!response.ok) {
    throw new Error(`${source.id}: HTTP ${response.status} z ${source.url}`);
  }

  const cleaned = stripNoise(await response.text());
  if (cleaned.length > MAX_HTML_CHARS) {
    console.warn(
      `[${source.id}] HTML ma ${cleaned.length} znaków — przycinam do ${MAX_HTML_CHARS}. ` +
        `Część starszych wpisów z tej strony może zostać pominięta w tym przebiegu.`,
    );
  }

  const parsed = await getAnthropic().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    // Bez `effort` — Haiku 4.5 odrzuca ten parametr błędem 400.
    output_config: { format: zodOutputFormat(ScrapedEntries) },
    system:
      "Wyciągasz listę wpisów blogowych/newsowych ze strony indeksowej. " +
      "Zwracaj wyłącznie wpisy faktycznie obecne w podanym HTML — nie zgaduj i nie dopisuj własnych. " +
      "URL-e podawaj jako absolutne (dopełnij domeną, jeśli w HTML są względne).",
    messages: [
      {
        role: "user",
        content:
          `Strona: ${source.url}\n\nHTML:\n` + cleaned.slice(0, MAX_HTML_CHARS),
      },
    ],
  });

  if (parsed.stop_reason === "refusal") {
    console.warn(`[${source.id}] model odmówił przetworzenia strony — pomijam źródło`);
    return [];
  }

  const entries = parsed.parsed_output?.entries ?? [];

  return entries.slice(0, MAX_ITEMS_PER_SOURCE).map((entry) => ({
    sourceId: source.id,
    url: entry.url,
    title: entry.title,
    publishedAt: entry.publishedAt,
  }));
}
