import { sql } from "@/lib/db";

export interface NewsItem {
  id: number;
  url: string;
  title: string;
  summaryPl: string | null;
  relevance: number | null;
  topics: string[] | null;
  publishedAt: string | null;
  sourceName: string;
  readAt: string | null;
}

interface ItemRow {
  /** BIGINT — sterownik Neona zwraca go jako string, nie number. */
  id: string;
  url: string;
  title_original: string;
  summary_pl: string | null;
  relevance_score: number | null;
  topics: string[] | null;
  published_at: string | null;
  source_name: string;
  read_at: string | null;
}

function toItem(row: ItemRow): NewsItem {
  return {
    id: Number(row.id),
    url: row.url,
    title: row.title_original,
    summaryPl: row.summary_pl,
    relevance: row.relevance_score,
    topics: row.topics,
    publishedAt: row.published_at,
    sourceName: row.source_name,
    readAt: row.read_at,
  };
}

/**
 * Skrzynka odbiorcza: nieprzeczytane, **od najnowszych** (ADR-0002).
 *
 * Sortowanie po świeżości, nie po trafności — inaczej wpis, o którym przyszło
 * powiadomienie, lądował w środku rankingu nieodróżnialny od tygodniowego.
 * Trafność zostaje jako badge i próg widoczności, przestaje porządkować listę.
 */
export async function listUnread(limit = 100): Promise<NewsItem[]> {
  const rows = (await sql()`
    SELECT
      i.id, i.url, i.title_original, i.summary_pl, i.relevance_score,
      i.topics, i.published_at, i.read_at, s.name AS source_name
    FROM items i
    JOIN sources s ON s.id = i.source_id
    WHERE i.read_at IS NULL AND i.relevance_score >= 3
    ORDER BY i.created_at DESC
    LIMIT ${limit}
  `) as ItemRow[];

  return rows.map(toItem);
}

/** Archiwum: przeczytane, od ostatnio przeczytanych. */
export async function listRead(limit = 30): Promise<NewsItem[]> {
  const rows = (await sql()`
    SELECT
      i.id, i.url, i.title_original, i.summary_pl, i.relevance_score,
      i.topics, i.published_at, i.read_at, s.name AS source_name
    FROM items i
    JOIN sources s ON s.id = i.source_id
    WHERE i.read_at IS NOT NULL
    ORDER BY i.read_at DESC
    LIMIT ${limit}
  `) as ItemRow[];

  return rows.map(toItem);
}

export async function countUnread(): Promise<number> {
  const rows = (await sql()`
    SELECT COUNT(*)::int AS n FROM items
    WHERE read_at IS NULL AND relevance_score >= 3
  `) as { n: number }[];

  return rows[0]?.n ?? 0;
}
