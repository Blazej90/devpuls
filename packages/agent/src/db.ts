import { neon } from "@neondatabase/serverless";

import { requireEnv } from "@/config.js";
import type { AssessedItem, SourceConfig } from "@/types.js";

/**
 * Klient HTTP Neona — bez utrzymywania puli połączeń, co pasuje do agenta
 * uruchamianego jako jednorazowy skrypt z GitHub Actions.
 * Migracje tabel: Faza 2 w TODO.md (sources, items, push_subscriptions).
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
}

/** Upsert źródeł z `sources.json`, żeby `items.source_id` miał na co wskazywać. */
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
 * Deduplikacja po URL — zwraca URL-e, które już widzieliśmy.
 * Jedno zapytanie na przebieg zamiast jednego na wpis.
 */
export async function findKnownUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();

  const rows = (await db()`
    SELECT url FROM items WHERE url = ANY(${urls})
  `) as { url: string }[];

  return new Set(rows.map((row) => row.url));
}

/** Zapisuje oceniony wpis. Zwraca id — potrzebne do oznaczenia wysyłki push. */
export async function insertItem(item: AssessedItem): Promise<number | null> {
  const rows = (await db()`
    INSERT INTO items
      (source_id, url, title_original, summary_pl, relevance_score, published_at)
    VALUES
      (${item.sourceId}, ${item.url}, ${item.title}, ${item.assessment.summaryPl},
       ${item.assessment.relevance}, ${item.publishedAt})
    ON CONFLICT (url) DO NOTHING
    RETURNING id
  `) as { id: number }[];

  return rows[0]?.id ?? null;
}

export async function markNotified(itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) return;

  await db()`
    UPDATE items SET notified_at = NOW() WHERE id = ANY(${itemIds})
  `;
}

export async function listSubscriptions(): Promise<PushSubscriptionRow[]> {
  const rows = (await db()`
    SELECT endpoint, keys_json FROM push_subscriptions
  `) as { endpoint: string; keys_json: PushSubscriptionRow["keysJson"] }[];

  return rows.map((row) => ({ endpoint: row.endpoint, keysJson: row.keys_json }));
}

/** Subskrypcja odrzucona przez push service (410/404) — nie ma po co jej trzymać. */
export async function deleteSubscription(endpoint: string): Promise<void> {
  await db()`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}
