/** Source type — decides which module from `src/sources/` handles it. */
export type SourceType = "rss" | "atom" | "scrape";

/** An entry from `config/sources.json`. */
export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  topics: string[];
  note?: string;
}

/**
 * A normalised item — every fetcher returns exactly this shape, regardless of
 * the input format (RSS, Atom, HTML).
 */
export interface NormalizedItem {
  sourceId: string;
  url: string;
  title: string;
  /** ISO 8601. `null` when the source gives no date. */
  publishedAt: string | null;
  /** The lead/description from the feed, if any — goes into the prompt as context. */
  excerpt?: string;
}

/** The result of Claude's assessment — one call per item. */
export interface Assessment {
  /** 1 = completely off target, 5 = must-read for this interest profile. */
  relevance: number;
  /** A Polish summary, 2-3 sentences. */
  summaryPl: string;
  /** Topics recognised by the model (typescript, react, ai, ...). */
  topics: string[];
}

/** An item ready to be stored in the database and pushed. */
export interface AssessedItem extends NormalizedItem {
  assessment: Assessment;
}
