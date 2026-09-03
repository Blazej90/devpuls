import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { getAnthropic, MODEL } from "@/anthropic.js";
import { noteError } from "@/monitor.js";
import type { Assessment, NormalizedItem, SourceConfig } from "@/types.js";

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

Przy każdym wpisie dostajesz typ źródła i on zmienia sposób oceniania:

- "official" — kanał, w którym ktoś świadomie coś ogłasza: release notes projektu,
  blog firmowy albo zespołu. Tytuł i lead opisują zdarzenie, które faktycznie zaszło.
  Oceniaj wprost według skali powyżej.
- "community" — post na forum (Reddit, Hacker News). To, że ktoś coś napisał, nie
  znaczy jeszcze, że cokolwiek się wydarzyło. W tej grupie typowe są: pytania
  początkujących, autopromocja własnego projektu, opinie bez nowej informacji,
  narzekania i treści żartobliwe. Takim wpisom stawiaj najwyżej 2, nawet jeśli
  temat idealnie pasuje do jego stacku — trafność to nie to samo co temat.
  Ocenę 4-5 z community rezerwuj dla wpisu, który niesie sprawdzalną, nową
  informację: wynik pomiaru, opis realnego problemu wraz z rozwiązaniem, wydanie
  narzędzia, którego ten odbiorca mógłby faktycznie użyć.

Jeden wyjątek od skali, działający tylko w górę: **stabilne wydanie narzędzia z jego
stacku, ogłoszone przez źródło "official", to zawsze co najmniej 4** — nawet jeśli
tytuł jest samym numerem wersji, a lead pusty. Sam fakt, że wyszła nowa wersja
czegoś, czego on używa, jest informacją, którą chce dostać; ubogi opis świadczy
o kanale, nie o wadze wydarzenia. Chodzi o narzędzia pełniące w jego pracy rolę:
język, runtime, framework i router, bundler, ORM i baza, hosting i CDN.

Ten wyjątek NIE obejmuje: wydań wstępnych (canary, beta, rc, dev, nightly, alpha),
wydań pojedynczych paczek pomocniczych z monorepa, wydań narzędzi spoza jego stacku
ani wpisów "community" — tam zostaje zwykła skala i zwykły limit.

Streszczenie pisz po polsku, rzeczowo, 2-3 zdania. Zero marketingowego tonu, zero
"w tym artykule dowiesz się". Pisz, co konkretnie się wydarzyło i co z tego wynika.
Jeśli masz tylko tytuł i krótki lead, streszczaj to, co jest — nie zmyślaj szczegółów.`;

/**
 * One Claude call per item: relevance score plus a Polish summary.
 *
 * The source is passed whole rather than as `item.sourceId` alone, because two
 * of its fields carry meaning the id does not: `name`, which reads like
 * something ("Reddit r/reactjs", not "reddit-reactjs"), and `tier`, which tells
 * the model whether it is looking at an announcement or at somebody's post.
 */
export async function assessItem(
  item: NormalizedItem,
  source: SourceConfig,
): Promise<Assessment | null> {
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
        content:
          `Źródło: ${source.name}\nTyp źródła: ${source.tier}\n` +
          `Tytuł: ${item.title}\nURL: ${item.url}${excerpt}`,
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
