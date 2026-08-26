import { TIME_ZONE, calendarDay, formatDate } from "@/lib/date-groups";

/**
 * When the agent next looks at the sources.
 *
 * The schedule lives in `.github/workflows/ingest.yml` and is repeated here,
 * because the app has no way to read the workflow file at runtime.
 * **Changing the cron means changing both places** — the only thing protecting
 * that is this comment.
 *
 * Answering "when will something new arrive" was the missing half of the
 * refresh (Phase 11): "nothing new" alone reads like a fault, while a date
 * turns the same message into an answer.
 */
// The cron is `0 7 * / 2 * *` (without the spaces around the slash — written
// that way only because the sequence would close a block comment).
const RUN_HOUR_UTC = 7;

// A step of two on the day-of-month field means the **odd days** — 1, 3, 5 … 31
// — not "every 48 hours". The counter restarts with each month, so after the
// 31st comes the 1st and two runs land on consecutive days; the workflow
// accepts that irregularity on purpose rather than growing its own scheduler.
function isRunDay(date: Date): boolean {
  return date.getUTCDate() % 2 === 1;
}

/** The first scheduled run strictly after `from`. */
export function nextRun(from: Date = new Date()): Date {
  const candidate = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
      RUN_HOUR_UTC,
    ),
  );

  // At most two steps: today's slot has passed, tomorrow is an even day.
  // `setUTCDate` rolls over months and years by itself.
  while (candidate <= from || !isRunDay(candidate)) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return candidate;
}

/**
 * The hour in the reader's own time, not UTC — 07:00 UTC is 9:00 in Poland in
 * summer and 8:00 in winter, and a date one has to convert answers nothing.
 * The zone is pinned exactly as in `date-groups.ts`, so the server and the
 * browser cannot print two different hours.
 */
const TIME = new Intl.DateTimeFormat("pl-PL", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

/** Difference in calendar days between two `YYYY-MM-DD` strings. */
function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

/**
 * "jutro o 9:00", "dziś o 9:00", "27 sierpnia o 9:00".
 *
 * Comparison runs on calendar-day strings rather than on a 24-hour offset:
 * on the night the clocks change a day is 23 or 25 hours long, and "tomorrow"
 * would then come out wrong for an hour around midnight.
 */
export function formatNextRun(now: Date = new Date()): string {
  const next = nextRun(now);
  const distance = daysBetween(calendarDay(now), calendarDay(next));

  const day =
    distance === 0
      ? "dziś"
      : distance === 1
        ? "jutro"
        : (formatDate(next.toISOString()) ?? calendarDay(next));

  return `${day} o ${TIME.format(next)}`;
}
