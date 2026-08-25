import { neon } from "@neondatabase/serverless";

import { requireEnv } from "@/config.js";
import type { RunReport } from "@/monitor.js";
import type { AssessedItem, SourceConfig } from "@/types.js";

/**
 * The Neon HTTP client — no connection pool to keep alive, which suits an agent
 * running as a one-shot script from GitHub Actions.
 * Table migrations: Phase 2 in TODO.md (sources, items, push_subscriptions).
 */
let sql: ReturnType<typeof neon> | null = null;

function db() {
  if (!sql) {
    sql = neon(requireEnv("DATABASE_URL"));
  }
  return sql;
}

export interface PushSubscriptionRow {
  endpoint: string;
  keysJson: { p256dh: string; auth: string };
  /** This subscription's relevance threshold (1-5). */
  minRelevance: number;
  /** Selected categories; `null` = all of them. */
  topics: string[] | null;
}

/** Upsert of the sources from `sources.json`, so `items.source_id` has a target. */
export async function syncSources(sources: SourceConfig[]): Promise<void> {
  for (const source of sources) {
    await db()`
      INSERT INTO sources (id, name, url, type)
      VALUES (${source.id}, ${source.name}, ${source.url}, ${source.type})
      ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            url  = EXCLUDED.url,
            type = EXCLUDED.type
    `;
  }
}

/**
 * Deduplication by URL — returns the URLs we have seen already.
 * One query per run instead of one per item.
 */
export async function findKnownUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();

  const rows = (await db()`
    SELECT url FROM items WHERE url = ANY(${urls})
  `) as { url: string }[];

  return new Set(rows.map((row) => row.url));
}

/** Stores an assessed item. Returns the id — needed to mark the push as sent. */
export async function insertItem(item: AssessedItem): Promise<number | null> {
  const rows = (await db()`
    INSERT INTO items
      (source_id, url, title_original, summary_pl, relevance_score, published_at, topics)
    VALUES
      (${item.sourceId}, ${item.url}, ${item.title}, ${item.assessment.summaryPl},
       ${item.assessment.relevance}, ${item.publishedAt}, ${item.assessment.topics})
    ON CONFLICT (url) DO NOTHING
    RETURNING id
  `) as { id: string }[];

  // BIGINT comes back from the driver as a string — we convert it at the module
  // boundary so the rest of the code does not have to remember.
  const id = rows[0]?.id;
  return id === undefined ? null : Number(id);
}

export async function markNotified(itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) return;

  // Comparison by strings — see the comment on `insertItem`.
  await db()`
    UPDATE items SET notified_at = NOW() WHERE id = ANY(${itemIds.map(String)})
  `;
}

export async function listSubscriptions(): Promise<PushSubscriptionRow[]> {
  const rows = (await db()`
    SELECT endpoint, keys_json, min_relevance, topics FROM push_subscriptions
  `) as {
    endpoint: string;
    keys_json: PushSubscriptionRow["keysJson"];
    min_relevance: number;
    topics: string[] | null;
  }[];

  return rows.map((row) => ({
    endpoint: row.endpoint,
    keysJson: row.keys_json,
    minRelevance: row.min_relevance,
    topics: row.topics,
  }));
}

/** A subscription rejected by the push service (410/404) — no reason to keep it. */
export async function deleteSubscription(endpoint: string): Promise<void> {
  await db()`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

/**
 * One row per run — the agent's health log (migration 004).
 *
 * The write is best effort: if the write itself fails, we do not want that to
 * bring down a run which otherwise delivered items and notifications.
 */
export async function saveRun(report: RunReport): Promise<void> {
  try {
    await db()`
      INSERT INTO runs
        (started_at, duration_ms, status, sources_ok, sources_failed,
         candidates, fresh, assessed, delivered, errors)
      VALUES
        (${report.startedAt.toISOString()}, ${report.durationMs}, ${report.status},
         ${report.sourcesOk}, ${report.sourcesFailed}, ${report.candidates},
         ${report.fresh}, ${report.assessed}, ${report.delivered},
         ${JSON.stringify(report.errors)}::jsonb)
    `;
  } catch (error: unknown) {
    console.error("[monitor] storing the run failed:", error);
  }
}
