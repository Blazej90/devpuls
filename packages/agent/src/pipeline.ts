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
import type { AssessedItem, NormalizedItem } from "@/types.js";

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

  // Jedno źródło, które padnie, nie może zabrać ze sobą pozostałych.
  const fetched = await Promise.allSettled(
    sources.map(async (source) => ({
      source,
      items: await fetchSource(source),
    })),
  );

  const candidates: NormalizedItem[] = [];

  for (const [index, result] of fetched.entries()) {
    const source = sources[index];
    if (!source) continue;

    if (result.status === "rejected") {
      console.error(`[${source.id}] pobieranie nieudane:`, result.reason);
      continue;
    }

    console.log(`[${source.id}] pobrano ${result.value.items.length} wpisów`);
    candidates.push(...result.value.items);
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
