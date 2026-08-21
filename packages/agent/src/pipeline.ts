import { loadSources } from "@/config.js";
import { assessItem } from "@/claude.js";
import {
  findKnownUrls,
  insertItem,
  markNotified,
  saveRun,
  syncSources,
} from "@/db.js";
import {
  buildReport,
  count,
  noteError,
  publishToActions,
  set,
  startRun,
} from "@/monitor.js";
import { sendDigest } from "@/push.js";
import { fetchSource } from "@/sources/index.js";
import type {
  Assessment,
  AssessedItem,
  NormalizedItem,
  SourceConfig,
} from "@/types.js";

/**
 * Orkiestracja jednego przebiegu:
 * config → pobranie źródeł → deduplikacja po URL → ocena przez Claude
 * → zapis do bazy → jeden digest push na przebieg (ADR-0002).
 *
 * Uruchamiany jako jednorazowy skrypt z `.github/workflows/ingest.yml`.
 * Zdrowie przebiegu zbiera `monitor.ts` i zapisuje `saveRun` (Faza 8).
 */
async function run(): Promise<void> {
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
          noteError("source", source.id, error);
          results.push({ source, items: null });
        }
      }
      return results;
    }),
  );

  const candidates: NormalizedItem[] = [];

  for (const { source, items } of grouped.flat()) {
    if (items === null) {
      count("sourcesFailed");
      continue;
    }

    console.log(`[${source.id}] pobrano ${items.length} wpisów`);
    count("sourcesOk");
    candidates.push(...items);

    // Feed, który odpowiada 200 i zwraca pustą listę, to najcichszy tryb
    // awarii — tak przez tydzień milczały trzy feedy Reddita, zanim okazało
    // się, że `.rss` serwuje Atoma. Zdrowe źródło zawsze ma jakieś wpisy.
    if (items.length === 0) {
      noteError("empty", source.id, "HTTP OK, ale zero wpisów — sprawdź parser");
    }
  }

  const known = await findKnownUrls(candidates.map((item) => item.url));
  const fresh = candidates.filter((item) => !known.has(item.url));

  set("candidates", candidates.length);
  set("fresh", fresh.length);

  console.log(
    `Kandydatów: ${candidates.length}, nowych po deduplikacji: ${fresh.length}`,
  );

  const oceniona: { id: number; item: AssessedItem }[] = [];

  // Sekwencyjnie — kilkanaście wpisów na przebieg nie potrzebuje
  // zrównoleglenia, a tak nie wpadamy w rate limity API.
  for (const item of fresh) {
    let assessment: Assessment | null;
    try {
      assessment = await assessItem(item);
    } catch (error: unknown) {
      console.error(`[claude] ocena nieudana: ${item.url}`, error);
      noteError("claude", item.url, error);
      continue;
    }
    if (!assessment) continue;

    const assessed: AssessedItem = { ...item, assessment };
    const itemId = await insertItem(assessed);
    if (itemId === null) continue;

    oceniona.push({ id: itemId, item: assessed });
  }

  set("assessed", oceniona.length);

  // Jedno powiadomienie zbiorcze na cały przebieg, nie jedno na wpis (ADR-0002).
  // Filtrowanie po progu i kategoriach robi `sendDigest` osobno dla każdej
  // subskrypcji, więc tutaj podajemy komplet.
  const delivered = await sendDigest(oceniona.map((wpis) => wpis.item));
  set("delivered", delivered);

  // `notified_at` oznaczamy dopiero, gdy digest faktycznie poszedł — inaczej
  // wpisy wyglądałyby na zapowiedziane, mimo że nikt się o nich nie dowiedział.
  if (delivered > 0) {
    await markNotified(oceniona.map((wpis) => wpis.id));
  }
}

async function main(): Promise<void> {
  startRun();

  try {
    await run();
  } catch (error: unknown) {
    // Wyjątek nie kończy procesu od razu: chcemy jeszcze zapisać, że przebieg
    // padł, i zostawić adnotację w GitHub Actions.
    console.error("Pipeline przerwany:", error);
    noteError("fatal", "pipeline", error);
  }

  const report = buildReport();

  await saveRun(report);
  await publishToActions(report);

  console.log(
    `Gotowe w ${Math.round(report.durationMs / 1000)}s — status ${report.status}, ` +
      `źródła ${report.sourcesOk} OK / ${report.sourcesFailed} nieudane, ` +
      `ocenionych ${report.assessed}, digestów wysłanych ${report.delivered}, ` +
      `zastrzeżeń ${report.errors.length}`,
  );

  // Czerwony workflow (i mail od GitHuba) tylko przy twardej awarii.
  // `degraded` widać w adnotacjach, podsumowaniu kroku i w samej appce.
  if (report.status === "failed") {
    process.exitCode = 1;
  }
}

void main();
