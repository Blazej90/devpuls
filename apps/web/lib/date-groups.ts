/**
 * Splitting the inbox into date sections (ADR-0003).
 *
 * The time zone is **pinned**, not read from the browser. The reason is
 * technical: the component renders on the server first (Vercel runs in UTC) and
 * hydrates in the browser afterwards. If "today" depended on the environment's
 * zone, an item published at 00:30 Polish time would land in "yesterday" on the
 * server and in "today" for the user — and React would report a hydration
 * mismatch.
 *
 * DevPuls has a single reader and is entirely in Polish, so pinning it to
 * Europe/Warsaw costs nothing. Should users from other zones ever appear, this
 * has to move into settings rather than be read from the environment.
 */
export const TIME_ZONE = "Europe/Warsaw";

/** `en-CA` yields `YYYY-MM-DD`, which sorts lexicographically. */
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function calendarDay(iso: string | Date): string {
  return DAY_FORMAT.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Day number since the epoch — lets us subtract dates without DST surprises. */
function dayNumber(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / 86_400_000;
}

export const BUCKETS = ["today", "yesterday", "week", "older"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABELS: Record<Bucket, string> = {
  today: "Dziś",
  yesterday: "Wczoraj",
  week: "W tym tygodniu",
  older: "Starsze",
};

/**
 * `today` comes from the outside instead of being computed here — the server
 * decides it once and passes it down, so the client cannot arrive at a
 * different answer even if the render happens past midnight.
 */
export function toBucket(recency: string, today: string): Bucket {
  const diff = dayNumber(today) - dayNumber(calendarDay(recency));

  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return "week";
  return "older";
}

/**
 * A section of the list. `bucket` is a plain string rather than `Bucket`,
 * because the relevance order sections by score instead of by day —
 * `groupByRelevance` in `lib/relevance.ts` returns the same shape.
 */
export interface Group<T> {
  bucket: string;
  label: string;
  items: T[];
}

/**
 * Groups while preserving input order. The list arrives already sorted by date
 * descending (the indexes from migration 005), so the sections line up from the
 * newest by themselves and there is no reason to sort twice.
 */
export function groupByDate<T extends { recency: string }>(
  items: T[],
  today: string,
): Group<T>[] {
  const groups = new Map<Bucket, T[]>();

  for (const item of items) {
    const bucket = toBucket(item.recency, today);
    const existing = groups.get(bucket);
    if (existing) existing.push(item);
    else groups.set(bucket, [item]);
  }

  return BUCKETS.filter((bucket) => groups.has(bucket)).map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    items: groups.get(bucket) ?? [],
  }));
}

/**
 * The date under an item title. Same pinned zone as the buckets — `Intl`
 * without `timeZone` takes it from the environment, so the server (UTC) and the
 * browser (Europe/Warsaw) could print different days and break hydration.
 */
const SHORT_DATE = new Intl.DateTimeFormat("pl-PL", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
});

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.valueOf()) ? null : SHORT_DATE.format(date);
}
