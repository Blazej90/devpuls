import { sql } from "@/lib/db";

/** Rodzaje zastrzeżeń — muszą się zgadzać z `packages/agent/src/monitor.ts`. */
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
  /** Ile godzin temu skończył się przebieg — liczone w bazie, żeby nie zależeć
   *  od strefy czasowej serwera renderującego. */
  hoursAgo: number;
}

interface RunRow {
  /** TIMESTAMPTZ — sterownik Neona parsuje go do obiektu `Date`, nie do stringa. */
  finished_at: Date | string;
  duration_ms: number;
  status: RunStatus;
  sources_ok: number;
  sources_failed: number;
  assessed: number;
  delivered: number;
  errors: RunError[];
  /** `EXTRACT(EPOCH …)` zwraca numeric, a sterownik Neona numeric jako string. */
  hours_ago: string | number;
}

/**
 * Ostatni przebieg agenta (migracja 004). `null`, gdy agent nie zdążył jeszcze
 * nic zapisać — świeża baza albo pierwsze uruchomienie po wdrożeniu Fazy 8.
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
 * Cron chodzi co 2 dni (ADR-0002), a GitHub potrafi opóźnić albo pominąć slot,
 * więc alarmujemy dopiero po trzech dobach. Powyżej tego progu milczenie
 * przestaje być normalne: wyłączony workflow, wygasły sekret albo padnięty
 * harmonogram wyglądają dokładnie tak — brak nowych wierszy w `runs`.
 */
export const STALE_AFTER_HOURS = 72;

export function isStale(run: LastRun | null): boolean {
  return run === null || run.hoursAgo > STALE_AFTER_HOURS;
}

/**
 * Wariant dla strony głównej: nie wywraca renderu.
 *
 * Wdrożenie na Vercela idzie przed migracją bazy, więc tuż po wypuszczeniu
 * Fazy 8 tabela `runs` jeszcze nie istnieje — a brak dziennika nie jest
 * powodem, żeby skrzynka przestała się otwierać. Alarmowanie zostaje po
 * stronie `/api/health`, gdzie błąd odczytu ma zwrócić 503, a nie `null`.
 */
export async function getLastRunSafe(): Promise<LastRun | null> {
  try {
    return await getLastRun();
  } catch (error: unknown) {
    console.error("[runs] odczyt ostatniego przebiegu nieudany", error);
    return null;
  }
}
