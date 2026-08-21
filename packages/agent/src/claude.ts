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
    .array(z.enum(["typescript", "react", "javascript", "fullstack", "ai", "inne"]))
    .describe("Tematy, których wpis faktycznie dotyczy"),
});

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

/** Jedno wywołanie Claude na wpis: ocena trafności + streszczenie PL. */
export async function assessItem(item: NormalizedItem): Promise<Assessment | null> {
  const excerpt = item.excerpt ? `\nLead: ${item.excerpt.slice(0, 2000)}` : "";

  const parsed = await getAnthropic().messages.parse({
    model: MODEL,
    max_tokens: 1024,
    // Bez `effort` — Haiku 4.5 odrzuca ten parametr błędem 400.
    output_config: { format: zodOutputFormat(AssessmentSchema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Źródło: ${item.sourceId}\nTytuł: ${item.title}\nURL: ${item.url}${excerpt}`,
      },
    ],
  });

  // Odmowa zdarza się np. przy wpisach o exploitach z Hacker News.
  // Pomijamy wpis zamiast wywracać cały przebieg.
  if (parsed.stop_reason === "refusal") {
    console.warn(`[claude] odmowa oceny: ${item.url}`);
    noteError("claude", item.url, "model odmówił oceny");
    return null;
  }

  const output = parsed.parsed_output;
  if (!output) {
    console.warn(`[claude] pusty parsed_output dla: ${item.url}`);
    noteError("claude", item.url, "pusty parsed_output");
    return null;
  }

  return {
    relevance: output.relevance,
    summaryPl: output.summary_pl,
    topics: output.topics,
  };
}
