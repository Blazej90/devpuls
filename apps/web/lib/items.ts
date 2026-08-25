import { sql } from "@/lib/db";

/**
 * The only place inbox queries are built (ADR-0003).
 *
 * Since migration 005 **every** query has to filter on `deleted_at IS NULL` —
 * exactly the kind of condition you forget when adding yet another view. That
 * is why route handlers and pages never write their own SQL and compose views
 * from the functions below instead.
 */

/** Items below this relevance never reach the inbox at all. */
const MIN_RELEVANCE = 3;

// Tab order. "Starred" sits right after "New" because it is the second
// "this matters to me" bucket — the archive and the full list are needed less.
export const VIEWS = ["new", "starred", "read", "all"] as const;
export type View = (typeof VIEWS)[number];

/** Categories returned by `packages/agent/src/claude.ts`. */
export const TOPICS = [
  "typescript",
  "react",
  "javascript",
  "fullstack",
  "ai",
  "other",
] as const;
export type Topic = (typeof TOPICS)[number];

/** Category labels shown in the UI. Keys must match `TOPICS`. */
export const TOPIC_LABELS: Record<Topic, string> = {
  typescript: "TypeScript",
  react: "React",
  javascript: "JavaScript",
  fullstack: "Fullstack",
  ai: "AI",
  other: "Inne",
};

export const VIEW_LABELS: Record<View, string> = {
  new: "Nowe",
  starred: "Ulubione",
  read: "Przeczytane",
  all: "Wszystkie",
};

export interface Filter {
  view: View;
  /** `null` = not narrowed to a category. */
  topic: Topic | null;
}

/** Tab and filter live in the URL (ADR-0003), so they must survive any input. */
export function parseView(raw: string | string[] | undefined): View {
  return VIEWS.find((view) => view === raw) ?? "new";
}

export function parseTopic(raw: string | string[] | undefined): Topic | null {
  return TOPICS.find((topic) => topic === raw) ?? null;
}

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
  /** When the item was starred; `null` = no star (migration 006). */
  starredAt: string | null;
  /**
   * The date the item is sorted and grouped by: publication date, falling back
   * to the moment it was stored. Computed in the database so the view does not
   * have to repeat the rule used by `ORDER BY`.
   */
  recency: string;
}

/**
 * The row shape as the driver actually returns it — not as it looks in SQL.
 * Two traps: BIGINT arrives as a string and TIMESTAMPTZ as a `Date` object.
 * Both are normalised in `toItem` so `NewsItem` is what it claims to be and
 * nothing downstream has to remember this.
 */
interface ItemRow {
  id: string;
  url: string;
  title_original: string;
  summary_pl: string | null;
  relevance_score: number | null;
  topics: string[] | null;
  published_at: Date | string | null;
  source_name: string;
  read_at: Date | string | null;
  starred_at: Date | string | null;
  recency: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoOrNull(value: Date | string | null): string | null {
  return value === null ? null : toIso(value);
}

function toItem(row: ItemRow): NewsItem {
  return {
    id: Number(row.id),
    url: row.url,
    title: row.title_original,
    summaryPl: row.summary_pl,
    relevance: row.relevance_score,
    topics: row.topics,
    publishedAt: toIsoOrNull(row.published_at),
    sourceName: row.source_name,
    readAt: toIsoOrNull(row.read_at),
    starredAt: toIsoOrNull(row.starred_at),
    recency: toIso(row.recency),
  };
}

/**
 * Inbox ordering. Until migration 005 this was plain `created_at`, the moment
 * the agent stored the item — identical for every item within a single run, so
 * the real ordering was the order sources happened to be polled and a week-old
 * post could land above today's. The indexes from 005 are built on exactly
 * this expression.
 */
const RECENCY = "COALESCE(i.published_at, i.created_at)";

/**
 * Conditions shared by every view, as parameterised SQL.
 * The returned `where` is interpolated into the query — but it is built purely
 * from our own literals, while every user-supplied value goes through `params`.
 */
function buildConditions(filter: Filter): { where: string; params: unknown[] } {
  const params: unknown[] = [MIN_RELEVANCE];
  const parts = ["i.deleted_at IS NULL", "i.relevance_score >= $1"];

  if (filter.view === "new") parts.push("i.read_at IS NULL");
  if (filter.view === "read") parts.push("i.read_at IS NOT NULL");
  // Starring is orthogonal to read state — the tab shows starred items
  // whether or not they have been marked read.
  if (filter.view === "starred") parts.push("i.starred_at IS NOT NULL");

  if (filter.topic) {
    params.push([filter.topic]);
    // `&&` = array overlap; uses the GIN index from migration 002.
    parts.push(`i.topics && $${params.length}::text[]`);
  }

  return { where: parts.join(" AND "), params };
}

/** How many items fit on one inbox page. */
export const PAGE_SIZE = 30;

/** Page number from the address; must survive any input, being a URL param. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value > 1 ? value : 1;
}

export interface Page {
  items: NewsItem[];
  /** Whether older items exist beyond this page. */
  hasMore: boolean;
}

/**
 * One page of the inbox.
 *
 * Classic OFFSET pages rather than loading more with a growing limit: the
 * archive grows by a dozen or so items every two days with no upper bound, so
 * a growing limit sooner or later drags hundreds of rows per request. Here the
 * response size stays constant no matter how deep we reach.
 *
 * A deliberate trade-off: with OFFSET, page boundaries shift when an item
 * changes which tab it belongs to (unmarking, deleting). A cursor would avoid
 * that but would remove the ability to jump to a specific page — which is the
 * whole point of pagination.
 */
export async function listItems(filter: Filter, page = 1): Promise<Page> {
  const { where, params } = buildConditions(filter);

  // One row beyond the page: a cheap and exact "is there more", independent of
  // a count from a separate query.
  params.push(PAGE_SIZE + 1);
  const limitParam = params.length;
  params.push((page - 1) * PAGE_SIZE);

  const rows = (await sql().query(
    `SELECT
       i.id, i.url, i.title_original, i.summary_pl, i.relevance_score,
       i.topics, i.published_at, i.read_at, i.starred_at, s.name AS source_name,
       ${RECENCY} AS recency
     FROM items i
     JOIN sources s ON s.id = i.source_id
     WHERE ${where}
     ORDER BY ${RECENCY} DESC
     LIMIT $${limitParam} OFFSET $${params.length}`,
    params,
  )) as ItemRow[];

  return {
    items: rows.slice(0, PAGE_SIZE).map(toItem),
    hasMore: rows.length > PAGE_SIZE,
  };
}

/**
 * Counts next to the tabs. They respect the active topic filter — otherwise a
 * tab would promise items that are not visible once narrowed down.
 */
export async function counts(topic: Topic | null): Promise<Record<View, number>> {
  const { where, params } = buildConditions({ view: "all", topic });

  const rows = (await sql().query(
    `SELECT
       COUNT(*) FILTER (WHERE i.read_at IS NULL)::int        AS "new",
       COUNT(*) FILTER (WHERE i.starred_at IS NOT NULL)::int AS "starred",
       COUNT(*) FILTER (WHERE i.read_at IS NOT NULL)::int    AS "read",
       COUNT(*)::int                                         AS "all"
     FROM items i
     WHERE ${where}`,
    params,
  )) as Record<View, number>[];

  return rows[0] ?? { new: 0, starred: 0, read: 0, all: 0 };
}

/**
 * Unread count without any category filter — this is what ends up on the PWA
 * icon badge, so it has to describe the whole inbox, not the current view.
 */
export async function countUnread(): Promise<number> {
  const rows = (await sql()`
    SELECT COUNT(*)::int AS n FROM items
    WHERE read_at IS NULL
      AND deleted_at IS NULL
      AND relevance_score >= ${MIN_RELEVANCE}
  `) as { n: number }[];

  return rows[0]?.n ?? 0;
}

/* ---------------------------------------------------------------------------
 * Writes. Kept here next to the reads because they share the same conditions
 * (`deleted_at IS NULL`, the relevance threshold) — split apart they would
 * drift the first time the threshold changed.
 * ------------------------------------------------------------------------ */

/**
 * Ids arrive from JSON as numbers, but the column is BIGINT and the Neon
 * driver serialises bigint to a string — the comparison has to be textual.
 */
function asText(ids: number[]): string[] {
  return ids.map(String);
}

export async function markRead(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await sql()`
    UPDATE items SET read_at = NOW()
    WHERE read_at IS NULL
      AND deleted_at IS NULL
      AND id = ANY(${asText(ids)})
  `;
}

/**
 * "Mark all" narrowed to the active category. Without that narrowing, a button
 * shown on a filtered view would also clear items the user cannot see at that
 * moment.
 */
export async function markAllRead(topic: Topic | null): Promise<void> {
  if (topic === null) {
    await sql()`
      UPDATE items SET read_at = NOW()
      WHERE read_at IS NULL
        AND deleted_at IS NULL
        AND relevance_score >= ${MIN_RELEVANCE}
    `;
    return;
  }

  await sql()`
    UPDATE items SET read_at = NOW()
    WHERE read_at IS NULL
      AND deleted_at IS NULL
      AND relevance_score >= ${MIN_RELEVANCE}
      AND topics && ${[topic]}::text[]
  `;
}

/**
 * Soft delete (ADR-0003). The row stays in the table because `items.url` with
 * its UNIQUE constraint is the only protection against the agent fetching the
 * article again — a hard DELETE would bring the item back on the next run,
 * notification included.
 *
 * The `deleted_at IS NULL` condition makes the operation idempotent: a repeated
 * request will not move the timestamp and break the undo.
 */
export async function softDelete(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await sql()`
    UPDATE items SET deleted_at = NOW()
    WHERE deleted_at IS NULL AND id = ANY(${asText(ids)})
  `;
}

/**
 * Undo marking as read — the item goes back to "New".
 *
 * Without this the read state was one-way: a mistaken click could only be
 * reverted through the database. The `read_at IS NOT NULL` condition makes the
 * operation idempotent.
 */
export async function markUnread(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await sql()`
    UPDATE items SET read_at = NULL
    WHERE read_at IS NOT NULL
      AND deleted_at IS NULL
      AND id = ANY(${asText(ids)})
  `;
}

/**
 * The star (migration 006). Starring is **orthogonal** to read state — this
 * operation never touches `read_at`, and marking as read never touches the star.
 */
export async function setStarred(ids: number[], starred: boolean): Promise<void> {
  if (ids.length === 0) return;

  if (starred) {
    await sql()`
      UPDATE items SET starred_at = NOW()
      WHERE starred_at IS NULL
        AND deleted_at IS NULL
        AND id = ANY(${asText(ids)})
    `;
    return;
  }

  await sql()`
    UPDATE items SET starred_at = NULL
    WHERE id = ANY(${asText(ids)})
  `;
}

/** Undo a delete — backs the "Cofnij" action in the toast. */
export async function restore(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await sql()`
    UPDATE items SET deleted_at = NULL
    WHERE id = ANY(${asText(ids)})
  `;
}

/**
 * Number of configured sources — for the facts strip in the hero.
 *
 * Read from the database rather than written into the copy: the agent syncs the
 * `sources` table from `packages/agent/config/sources.json` on every run, so
 * adding a source updates the header by itself. A literal in JSX would drift
 * silently.
 */
export async function countSources(): Promise<number> {
  const rows = (await sql()`SELECT COUNT(*)::int AS n FROM sources`) as { n: number }[];
  return rows[0]?.n ?? 0;
}
