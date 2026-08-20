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
}

/**
 * Ostatnie wpisy do listy w appce. Bierzemy wszystko powyżej progu 3, bo
 * jedynki i dwójki to szum, którego i tak nikt nie przeczyta — próg pushowy
 * jest osobny i siedzi przy subskrypcji.
 */
export async function listRecentItems(limit = 50): Promise<NewsItem[]> {
  const rows = (await sql()`
    SELECT
      i.id,
      i.url,
      i.title_original,
      i.summary_pl,
      i.relevance_score,
      i.topics,
      i.published_at,
      s.name AS source_name
    FROM items i
    JOIN sources s ON s.id = i.source_id
    WHERE i.relevance_score >= 3
    ORDER BY i.relevance_score DESC, i.published_at DESC NULLS LAST, i.created_at DESC
    LIMIT ${limit}
  `) as {
    id: number;
    url: string;
    title_original: string;
    summary_pl: string | null;
    relevance_score: number | null;
    topics: string[] | null;
    published_at: string | null;
    source_name: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title_original,
    summaryPl: row.summary_pl,
    relevance: row.relevance_score,
    topics: row.topics,
    publishedAt: row.published_at,
    sourceName: row.source_name,
  }));
}
