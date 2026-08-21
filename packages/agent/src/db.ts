import { neon } from "@neondatabase/serverless";

import { requireEnv } from "@/config.js";
import type { RunReport } from "@/monitor.js";
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
  /** Próg trafności tej subskrypcji (1-5). */
  minRelevance: number;
  /** Wybrane kategorie; `null` = wszystkie. */
  topics: string[] | null;
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
      (source_id, url, title_original, summary_pl, relevance_score, published_at, topics)
    VALUES
      (${item.sourceId}, ${item.url}, ${item.title}, ${item.assessment.summaryPl},
       ${item.assessment.relevance}, ${item.publishedAt}, ${item.assessment.topics})
    ON CONFLICT (url) DO NOTHING
    RETURNING id
  `) as { id: string }[];

  // BIGINT wraca ze sterownika jako string — konwertujemy na granicy modułu,
  // żeby reszta kodu nie musiała o tym pamiętać.
  const id = rows[0]?.id;
  return id === undefined ? null : Number(id);
}

export async function markNotified(itemIds: number[]): Promise<void> {
  if (itemIds.length === 0) return;

  // Porównanie po stringach — patrz komentarz przy `insertItem`.
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

/** Subskrypcja odrzucona przez push service (410/404) — nie ma po co jej trzymać. */
export async function deleteSubscription(endpoint: string): Promise<void> {
  await db()`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

/**
 * Jeden wiersz na przebieg — dziennik zdrowia agenta (migracja 004).
 *
 * Zapis jest „best effort": jeśli padnie sam zapis, nie chcemy z tego powodu
 * wywracać przebiegu, który poza tym dowiózł wpisy i powiadomienia.
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
    console.error("[monitor] nie udało się zapisać przebiegu:", error);
  }
}
