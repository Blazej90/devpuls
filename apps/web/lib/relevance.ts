import type { Group } from "@/lib/date-groups";

/**
 * The relevance floor — one setting, two places that have to honour it.
 *
 * The agent scores every item 1-5 and stores all of them; what the number is
 * *for* is deciding how much of that reaches the reader. Until now the app had
 * two unrelated answers: a constant of 3 buried in `lib/items.ts` for the inbox
 * and `push_subscriptions.min_relevance` for the notifications, so "Trafność
 * 4+" on `/settings` quietened the phone and changed nothing on the list.
 *
 * Now the choice is one, and it lives in two stores because the two readers
 * live in different worlds:
 *  - the cookie below, read on the server by `lib/preferences.ts`, filters the
 *    inbox;
 *  - `push_subscriptions.min_relevance` filters the digest, because the agent
 *    runs in GitHub Actions and never sees a browser.
 * `push-settings.tsx` writes both from a single "Zapisz", which is what keeps
 * them from drifting apart.
 *
 * No `next/headers` here on purpose: this module is imported by a client
 * component, and anything that reaches a client bundle may not touch the
 * request. The server-side read is in `lib/preferences.ts`.
 */

/**
 * What the threshold can be set to. 1 is deliberately not offered: the agent
 * uses it for items it judged off-topic, and a list with no floor at all would
 * be the raw feed the app exists to filter.
 */
export const RELEVANCE_LEVELS = [2, 3, 4, 5] as const;
export type RelevanceLevel = (typeof RELEVANCE_LEVELS)[number];

/**
 * Matches the DEFAULT of `push_subscriptions.min_relevance` (migration 002) and
 * `RELEVANCE_THRESHOLD` in the agent — a device that has never opened the
 * settings sees exactly what it would be notified about.
 */
export const DEFAULT_RELEVANCE: RelevanceLevel = 4;

export const RELEVANCE_COOKIE = "min-relevance";

/** A year — the threshold is chosen once and has to survive a closed tab. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * A cookie is user input like any other: anything that is not one of the four
 * levels means the default, never a value smuggled into the SQL.
 */
export function parseRelevance(raw: string | undefined | null): RelevanceLevel {
  const value = Number(raw);
  return RELEVANCE_LEVELS.find((level) => level === value) ?? DEFAULT_RELEVANCE;
}

/**
 * Writes what the next request will read. `document.cookie` rather than a route
 * of its own: the value is a display preference, not a secret, and a device
 * without notifications has no subscription row to write it to anyway.
 *
 * `samesite=lax` because the cookie is only ever read by our own pages, and no
 * `secure` flag so the setting also works over plain http on localhost.
 */
export function rememberRelevance(level: RelevanceLevel): void {
  document.cookie = `${RELEVANCE_COOKIE}=${level}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Sections for the "Najtrafniejsze" order — the counterpart of `groupByDate`.
 *
 * Sorted by relevance, date headers would scatter the very order they are there
 * to show: a five from July would open a "Starsze" section below three days of
 * fours. So the sections switch to the number the list is sorted by.
 *
 * Input order is preserved exactly as in `groupByDate` — the query has already
 * sorted the rows, and a `Map` keeps the order they arrive in.
 */
export function groupByRelevance<T extends { relevance: number | null }>(
  items: T[],
): Group<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const bucket = item.relevance === null ? "none" : String(item.relevance);
    const existing = groups.get(bucket);
    if (existing) existing.push(item);
    else groups.set(bucket, [item]);
  }

  return [...groups].map(([bucket, grouped]) => ({
    bucket,
    label: bucket === "none" ? "Bez oceny" : `Trafność ${bucket}`,
    items: grouped,
  }));
}

/** The value the browser is currently sending, for the settings form. */
export function readRememberedRelevance(): RelevanceLevel {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${RELEVANCE_COOKIE}=([^;]*)`),
  );
  return parseRelevance(match?.[1]);
}
