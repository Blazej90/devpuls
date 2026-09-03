import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { getAnthropic, MODEL } from "@/anthropic.js";
import { noteError } from "@/monitor.js";
import type { NormalizedItem, SourceConfig } from "@/types.js";

/** How many HTML characters we send to the model — index pages can be huge. */
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

/** Strips what carries no content anyway — scripts, styles, comments. */
function stripNoise(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sources without RSS (e.g. Anthropic News). Instead of a dedicated HTML parser
 * — which breaks with every redesign — we ask Claude for the list of items as
 * structured JSON (see CLAUDE.md, the "Źródła danych agenta" section).
 */
export async function fetchScrape(
  source: SourceConfig,
): Promise<NormalizedItem[]> {
  const response = await fetch(source.url, {
    headers: { "user-agent": "DevPuls/0.1 (+https://github.com/Blazej90/devpuls)" },
  });

  if (!response.ok) {
    throw new Error(`${source.id}: HTTP ${response.status} from ${source.url}`);
  }

  const cleaned = stripNoise(await response.text());
  if (cleaned.length > MAX_HTML_CHARS) {
    console.warn(
      `[${source.id}] the HTML is ${cleaned.length} characters — truncating to ${MAX_HTML_CHARS}. ` +
        `Some older items from this page may be skipped in this run.`,
    );
  }

  const parsed = await getAnthropic().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    // No `effort` — Haiku 4.5 rejects that parameter with a 400.
    output_config: { format: zodOutputFormat(ScrapedEntries) },
    // The prompt stays in Polish, like the rest of the model-facing copy.
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
    console.warn(`[${source.id}] the model refused to process the page — skipping source`);
    noteError("source", source.id, "the model refused to process the page");
    return [];
  }

  const entries = parsed.parsed_output?.entries ?? [];

  return entries.map((entry) => ({
    sourceId: source.id,
    url: entry.url,
    title: entry.title,
    publishedAt: entry.publishedAt,
  }));
}
