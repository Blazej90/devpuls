import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { getAnthropic, MODEL } from "@/anthropic.js";
import { noteError } from "@/monitor.js";
import type { Assessment, NormalizedItem } from "@/types.js";

const AssessmentSchema = z.object({
  relevance: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("1 = zupełnie nietrafione, 5 = must-read dla tego profilu"),
  summary_pl: z
    .string()
    .describe("Streszczenie po polsku, 2-3 zdania, bez powtarzania tytułu"),
  topics: z
    .array(z.enum(["typescript", "react", "javascript", "fullstack", "ai", "other"]))
    .describe("Tematy, których wpis faktycznie dotyczy"),
});

// The prompt stays in Polish: it is product content, not code — the summaries
// it produces go straight into a Polish-language app.
const SYSTEM_PROMPT = `Oceniasz nowinki techniczne dla jednego, konkretnego odbiorcy:
programisty fullstack pracującego na co dzień w TypeScript i React, śledzącego
ekosystem JavaScriptu oraz narzędzia AI dla deweloperów.

Skala trafności:
5 — bezpośrednio dotyczy jego stacku, realnie zmienia sposób pracy (release TypeScript/React,
    przełomowe narzędzie deweloperskie, istotna zmiana w API modelu, którego może użyć)
4 — mocno powiązane z jego stackiem, warte przeczytania w tym tygodniu
3 — ogólnie ciekawe dla programisty, ale nie z jego działki
2 — luźno powiązane z technologią
1 — poza obszarem zainteresowań (polityka, biznes, sprzęt konsumencki, kryptowaluty)

Streszczenie pisz po polsku, rzeczowo, 2-3 zdania. Zero marketingowego tonu, zero
"w tym artykule dowiesz się". Pisz, co konkretnie się wydarzyło i co z tego wynika.
Jeśli masz tylko tytuł i krótki lead, streszczaj to, co jest — nie zmyślaj szczegółów.`;

/** One Claude call per item: relevance score plus a Polish summary. */
export async function assessItem(item: NormalizedItem): Promise<Assessment | null> {
  const excerpt = item.excerpt ? `\nLead: ${item.excerpt.slice(0, 2000)}` : "";

  const parsed = await getAnthropic().messages.parse({
    model: MODEL,
    max_tokens: 1024,
    // No `effort` — Haiku 4.5 rejects that parameter with a 400.
    output_config: { format: zodOutputFormat(AssessmentSchema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Źródło: ${item.sourceId}\nTytuł: ${item.title}\nURL: ${item.url}${excerpt}`,
      },
    ],
  });

  // Refusals happen for instance on exploit-related posts from Hacker News.
  // We skip the item instead of bringing down the whole run.
  if (parsed.stop_reason === "refusal") {
    console.warn(`[claude] assessment refused: ${item.url}`);
    noteError("claude", item.url, "the model refused to assess the item");
    return null;
  }

  const output = parsed.parsed_output;
  if (!output) {
    console.warn(`[claude] empty parsed_output for: ${item.url}`);
    noteError("claude", item.url, "empty parsed_output");
    return null;
  }

  return {
    relevance: output.relevance,
    summaryPl: output.summary_pl,
    topics: output.topics,
  };
}
