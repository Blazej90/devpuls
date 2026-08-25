import { sql } from "@/lib/db";

/** Warning kinds — must stay in sync with `packages/agent/src/monitor.ts`. */
export type ErrorKind = "source" | "empty" | "claude" | "push" | "fatal";
export type RunStatus = "ok" | "degraded" | "failed";

export interface RunError {
  kind: ErrorKind;
  ref: string;
  message: string;
}

export interface LastRun {
  finishedAt: string;
  durationMs: number;
  status: RunStatus;
  sourcesOk: number;
  sourcesFailed: number;
  assessed: number;
  delivered: number;
  errors: RunError[];
  /** How many hours ago the run finished — computed in the database so it does
   *  not depend on the time zone of the rendering server. */
  hoursAgo: number;
}

interface RunRow {
  /** TIMESTAMPTZ — the Neon driver parses it into a `Date` object, not a string. */
  finished_at: Date | string;
  duration_ms: number;
  status: RunStatus;
  sources_ok: number;
  sources_failed: number;
  assessed: number;
  delivered: number;
  errors: RunError[];
  /** `EXTRACT(EPOCH …)` returns numeric, and the Neon driver returns numeric as a string. */
  hours_ago: string | number;
}

/**
 * The agent's last run (migration 004). `null` when the agent has not managed
 * to store anything yet — a fresh database, or the first start after Phase 8
 * was deployed.
 */
export async function getLastRun(): Promise<LastRun | null> {
  const rows = (await sql()`
    SELECT
      finished_at, duration_ms, status, sources_ok, sources_failed,
      assessed, delivered, errors,
      EXTRACT(EPOCH FROM (NOW() - finished_at)) / 3600 AS hours_ago
    FROM runs
    ORDER BY finished_at DESC
    LIMIT 1
  `) as RunRow[];

  const row = rows[0];
  if (!row) return null;

  return {
    finishedAt:
      row.finished_at instanceof Date
        ? row.finished_at.toISOString()
        : row.finished_at,
    durationMs: row.duration_ms,
    status: row.status,
    sourcesOk: row.sources_ok,
    sourcesFailed: row.sources_failed,
    assessed: row.assessed,
    delivered: row.delivered,
    errors: row.errors ?? [],
    hoursAgo: Number(row.hours_ago),
  };
}

/**
 * The cron runs every 2 days (ADR-0002) and GitHub can delay or skip a slot, so
 * we only raise the alarm after three days. Beyond that threshold silence stops
 * being normal: a disabled workflow, an expired secret or a broken schedule all
 * look exactly like this — no new rows in `runs`.
 */
export const STALE_AFTER_HOURS = 72;

export function isStale(run: LastRun | null): boolean {
  return run === null || run.hoursAgo > STALE_AFTER_HOURS;
}

/**
 * The variant for the home page: it never breaks the render.
 *
 * The Vercel deployment goes out before the database migration, so right after
 * Phase 8 shipped the `runs` table did not exist yet — and a missing log is no
 * reason for the inbox to stop opening. Raising the alarm stays with
 * `/api/health`, where a read error should return a 503 rather than `null`.
 */
export async function getLastRunSafe(): Promise<LastRun | null> {
  try {
    return await getLastRun();
  } catch (error: unknown) {
    console.error("[runs] reading the last run failed", error);
    return null;
  }
}
