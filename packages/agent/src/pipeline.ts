import { loadSources } from "@/config.js";
import { assessItem } from "@/claude.js";
import {
  findKnownUrls,
  insertItem,
  listMutedSources,
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
 * Orchestration of a single run:
 * config → fetch sources → deduplicate by URL → assess with Claude
 * → store in the database → one push digest per run (ADR-0002).
 *
 * Executed as a one-shot script from `.github/workflows/ingest.yml`.
 * Run health is collected by `monitor.ts` and stored by `saveRun` (Phase 8).
 */
async function run(): Promise<void> {
  const configured = await loadSources();
  // The upsert has to happen before reading the mutes, so a source added to the
  // config today exists in the table by the time we ask about it.
  await syncSources(configured);

  /*
    Muting (migration 008) cuts in here, before anything is fetched — not at
    delivery time. The expensive part of a run is the Claude call per item, and
    paying to summarise a source the user has silenced would defeat the point of
    silencing it. The trade-off: while a source is muted nothing is collected
    from it, and an RSS feed only carries its most recent entries, so unmuting
    brings back the current window rather than the whole gap.
  */
  const muted = await listMutedSources();
  const sources = configured.filter((source) => !muted.has(source.id));

  for (const source of configured) {
    if (muted.has(source.id)) console.log(`[${source.id}] muted — skipped`);
  }

  // Sources from the same host go one after another, different hosts in
  // parallel. Sequencing alone is not enough for Reddit — it allows one
  // unauthenticated request per window of about a minute per IP, so the three
  // feeds also have to be spaced out in time. That part is `sources/http.ts`,
  // which paces itself by the rate-limit headers; grouping by host is what
  // gives it a queue to pace.
  const byHost = new Map<string, SourceConfig[]>();
  for (const source of sources) {
    const host = new URL(source.url).hostname;
    const group = byHost.get(host);
    if (group) group.push(source);
    else byHost.set(host, [source]);
  }

  // One source going down must not take the others with it.
  const grouped = await Promise.all(
    [...byHost.values()].map(async (group) => {
      const results: { source: SourceConfig; items: NormalizedItem[] | null }[] = [];
      for (const source of group) {
        try {
          results.push({ source, items: await fetchSource(source) });
        } catch (error: unknown) {
          console.error(`[${source.id}] fetch failed:`, error);
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

    console.log(`[${source.id}] fetched ${items.length} items`);
    count("sourcesOk");
    candidates.push(...items);

    // A feed that answers 200 and returns an empty list is the quietest failure
    // mode there is — that is how three Reddit feeds stayed silent for a week
    // before it turned out `.rss` serves Atom. A healthy source always has some
    // items.
    if (items.length === 0) {
      noteError("empty", source.id, "HTTP OK but zero items — check the parser");
    }
  }

  const known = await findKnownUrls(candidates.map((item) => item.url));
  const fresh = candidates.filter((item) => !known.has(item.url));

  set("candidates", candidates.length);
  set("fresh", fresh.length);

  console.log(
    `Candidates: ${candidates.length}, new after deduplication: ${fresh.length}`,
  );

  const assessed: { id: number; item: AssessedItem }[] = [];

  // Sequentially — a dozen or so items per run does not need parallelism, and
  // this way we stay clear of API rate limits.
  for (const item of fresh) {
    let assessment: Assessment | null;
    try {
      assessment = await assessItem(item);
    } catch (error: unknown) {
      console.error(`[claude] assessment failed: ${item.url}`, error);
      noteError("claude", item.url, error);
      continue;
    }
    if (!assessment) continue;

    const withAssessment: AssessedItem = { ...item, assessment };
    const itemId = await insertItem(withAssessment);
    if (itemId === null) continue;

    assessed.push({ id: itemId, item: withAssessment });
  }

  set("assessed", assessed.length);

  // One combined notification for the whole run, not one per item (ADR-0002).
  // Filtering by threshold and categories happens inside `sendDigest`,
  // separately for each subscription, so here we pass the full set.
  const delivered = await sendDigest(assessed.map((entry) => entry.item));
  set("delivered", delivered);

  // `notified_at` is set only once the digest actually went out — otherwise
  // items would look announced even though nobody ever heard about them.
  if (delivered > 0) {
    await markNotified(assessed.map((entry) => entry.id));
  }
}

async function main(): Promise<void> {
  startRun();

  try {
    await run();
  } catch (error: unknown) {
    // An exception does not end the process straight away: we still want to
    // record that the run failed and leave an annotation in GitHub Actions.
    console.error("Pipeline aborted:", error);
    noteError("fatal", "pipeline", error);
  }

  const report = buildReport();

  await saveRun(report);
  await publishToActions(report);

  console.log(
    `Done in ${Math.round(report.durationMs / 1000)}s — status ${report.status}, ` +
      `sources ${report.sourcesOk} OK / ${report.sourcesFailed} failed, ` +
      `assessed ${report.assessed}, digests delivered ${report.delivered}, ` +
      `warnings ${report.errors.length}`,
  );

  // A red workflow (and an email from GitHub) only on a hard failure.
  // `degraded` shows up in the annotations, the step summary and the app itself.
  if (report.status === "failed") {
    process.exitCode = 1;
  }
}

void main();
