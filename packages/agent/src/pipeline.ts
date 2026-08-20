import { loadSources, RELEVANCE_THRESHOLD } from "@/config.js";
import { assessItem } from "@/claude.js";
import {
  findKnownUrls,
  insertItem,
  markNotified,
  syncSources,
} from "@/db.js";
import { sendPush } from "@/push.js";
import { fetchSource } from "@/sources/index.js";
import type { AssessedItem, NormalizedItem, SourceConfig } from "@/types.js";

/**
 * Orkiestracja jednego przebiegu:
 * config → pobranie źródeł → deduplikacja po URL → ocena przez Claude
 * → zapis do bazy → push dla wpisów powyżej progu trafności.
 *
 * Uruchamiany jako jednorazowy skrypt z `.github/workflows/ingest.yml`.
 */
async function main(): Promise<void> {
  const startedAt = Date.now();
  const sources = await loadSources();
  await syncSources(sources);

  // Źródła z tego samego hosta lecą po kolei, różne hosty równolegle.
  // Reddit odbija 429, gdy trzy jego feedy uderzą jednocześnie z tego samego IP.
  const byHost = new Map<string, SourceConfig[]>();
  for (const source of sources) {
    const host = new URL(source.url).hostname;
    const group = byHost.get(host);
    if (group) group.push(source);
    else byHost.set(host, [source]);
  }

  // Jedno źródło, które padnie, nie może zabrać ze sobą pozostałych.
  const grouped = await Promise.all(
    [...byHost.values()].map(async (group) => {
      const results: { source: SourceConfig; items: NormalizedItem[] | null }[] = [];
      for (const source of group) {
        try {
          results.push({ source, items: await fetchSource(source) });
        } catch (error: unknown) {
          console.error(`[${source.id}] pobieranie nieudane:`, error);
          results.push({ source, items: null });
        }
      }
      return results;
    }),
  );

  const candidates: NormalizedItem[] = [];

  for (const { source, items } of grouped.flat()) {
    if (items === null) continue;

    console.log(`[${source.id}] pobrano ${items.length} wpisów`);
    candidates.push(...items);
  }

  const known = await findKnownUrls(candidates.map((item) => item.url));
  const fresh = candidates.filter((item) => !known.has(item.url));

  console.log(
    `Kandydatów: ${candidates.length}, nowych po deduplikacji: ${fresh.length}`,
  );

  const notifiedIds: number[] = [];
  let assessedCount = 0;

  // Sekwencyjnie — kilkanaście wpisów na przebieg nie potrzebuje
  // zrównoleglenia, a tak nie wpadamy w rate limity API.
  for (const item of fresh) {
    const assessment = await assessItem(item);
    if (!assessment) continue;

    assessedCount += 1;
    const assessed: AssessedItem = { ...item, assessment };

    const itemId = await insertItem(assessed);
    if (itemId === null) continue;

    if (assessment.relevance >= RELEVANCE_THRESHOLD) {
      const delivered = await sendPush(assessed);
      if (delivered > 0) notifiedIds.push(itemId);
      console.log(
        `[push] "${item.title}" (trafność ${assessment.relevance}) → ${delivered} subskrypcji`,
      );
    }
  }

  await markNotified(notifiedIds);

  console.log(
    `Gotowe w ${Math.round((Date.now() - startedAt) / 1000)}s — ` +
      `ocenionych ${assessedCount}, powiadomień ${notifiedIds.length}, ` +
      `próg trafności ${RELEVANCE_THRESHOLD}`,
  );
}

main().catch((error: unknown) => {
  console.error("Pipeline przerwany:", error);
  process.exitCode = 1;
});
