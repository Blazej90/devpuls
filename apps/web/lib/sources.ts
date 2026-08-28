import { sql } from "@/lib/db";

/**
 * The sources themselves — the list, and the mute (migration 008).
 *
 * A module of its own rather than another corner of `lib/items.ts`: a source is
 * not a view of the inbox, it is the thing items arrive from, and muting is
 * read by the agent as well. The one place the two meet is the condition in
 * `buildConditions` that hides items from muted sources.
 */

export interface Source {
  id: string;
  name: string;
  /** When the source was muted; `null` = active. */
  mutedAt: string | null;
}

/** A row of the source list, with what the mute is holding back. */
export interface SourceStat extends Source {
  /** All items from this source, muted or not — nothing is deleted by muting. */
  items: number;
  unread: number;
}

/** TIMESTAMPTZ arrives from the driver as a `Date` — see `lib/items.ts`. */
function toIsoOrNull(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Id-to-name mapping. It is what turns `?source=ts-blog` in the address into
 * "TypeScript Blog" on the chip — the id alone would be a filter the user
 * cannot read.
 */
export async function listSources(): Promise<Source[]> {
  const rows = (await sql()`
    SELECT id, name, muted_at FROM sources ORDER BY name
  `) as { id: string; name: string; muted_at: Date | string | null }[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mutedAt: toIsoOrNull(row.muted_at),
  }));
}

/**
 * The list behind `/sources`, with item counts.
 *
 * The counts deliberately ignore the mute: a muted source shows how much is
 * parked behind it, because that is exactly what unmuting brings back. Only the
 * relevance threshold and deleted items are excluded, so the numbers match what
 * the inbox would show.
 *
 * A LEFT JOIN, so a source that has not delivered anything yet is still on the
 * list — otherwise it could never be muted in advance.
 */
export async function listSourceStats(minRelevance: number): Promise<SourceStat[]> {
  const rows = (await sql()`
    SELECT s.id,
           s.name,
           s.muted_at,
           COUNT(i.id)::int                                   AS items,
           COUNT(i.id) FILTER (WHERE i.read_at IS NULL)::int   AS unread
      FROM sources s
      LEFT JOIN items i
        ON i.source_id = s.id
       AND i.deleted_at IS NULL
       AND i.relevance_score >= ${minRelevance}
     GROUP BY s.id, s.name, s.muted_at
     ORDER BY items DESC, s.name
  `) as {
    id: string;
    name: string;
    muted_at: Date | string | null;
    items: number;
    unread: number;
  }[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mutedAt: toIsoOrNull(row.muted_at),
    items: row.items,
    unread: row.unread,
  }));
}

/**
 * Mute or unmute a source.
 *
 * The `muted_at IS NULL` / `IS NOT NULL` conditions make it idempotent: a
 * repeated request will not move the timestamp, so "muted since" stays the
 * moment it actually went quiet.
 */
export async function setMuted(id: string, muted: boolean): Promise<void> {
  if (muted) {
    await sql()`UPDATE sources SET muted_at = NOW() WHERE id = ${id} AND muted_at IS NULL`;
    return;
  }

  await sql()`UPDATE sources SET muted_at = NULL WHERE id = ${id}`;
}
