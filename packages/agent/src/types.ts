/** Source type — decides which module from `src/sources/` handles it. */
export type SourceType = "rss" | "atom" | "scrape";

/**
 * Who stands behind an entry, which is not the same question as what it is about.
 *
 * `official` — a channel where somebody deliberately announces something:
 *   release notes, a company or team blog. The title and the lead describe an
 *   event that happened.
 * `community` — a forum post (Reddit, Hacker News). Somebody wrote something;
 *   that on its own is not an event.
 *
 * The distinction is passed to the model, because relevance and subject are two
 * different things: a beginner's question about `tsconfig.json` is squarely on
 * topic and still worth nobody's evening.
 */
export type SourceTier = "official" | "community";

/** An entry from `config/sources.json`. */
export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  tier: SourceTier;
  topics: string[];
  /**
   * Per-source cap on how many items a run takes, overriding
   * `MAX_ITEMS_PER_SOURCE`. Used where the feed is a firehose rather than a
   * stream of events — Reddit's top listing is capped low so the community's
   * own selection is what reaches the model.
   */
  maxItems?: number;
  /**
   * Items whose title does not match this regular expression are dropped
   * before anything is charged for them.
   *
   * It is an allow-list, not a block-list, because that is the shape the
   * problem has: GitHub release feeds mix real releases with an open-ended set
   * of names nobody publishes deliberately — `v16.4.0-canary.15`,
   * `8.1.0-dev.6`, `create-vite@9.2.0`, `consolidation-step-7-green`. Listing
   * what a release looks like is finite; listing what it does not is not.
   *
   * Applied **before** the cap, so a page of ten canaries does not consume the
   * budget a stable release should have had.
   */
  titlePattern?: string;
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

/**
 * What one source yielded in a run.
 *
 * `fetched` is the count **before** `titlePattern` and the cap, and it exists
 * for the sake of the empty-feed alarm in `pipeline.ts`: a source that returns
 * ten canary releases and keeps none of them is working exactly as configured,
 * while a source that returns nothing at all is the quiet failure the alarm is
 * there to catch. Without the raw count the two look identical.
 */
export interface FetchResult {
  items: NormalizedItem[];
  fetched: number;
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
