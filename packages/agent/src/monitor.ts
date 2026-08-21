import { appendFile } from "node:fs/promises";

/**
 * Zbieranie zdrowia jednego przebiegu (Faza 8).
 *
 * Kolektor jest modułowy (stan na poziomie modułu), a nie przekazywany
 * parametrem, świadomie: agent to skrypt jednorazowy — jeden proces = jeden
 * przebieg — a przewlekanie obiektu raportu przez `claude.ts`, `push.ts`
 * i fetchery zmieniłoby ich sygnatury tylko po to, żeby dowieźć logowanie.
 * Gdyby agent kiedyś obsługiwał wiele przebiegów naraz, to trzeba przepisać.
 */

/**
 * `source`  — źródło nie odpowiedziało / rzuciło wyjątkiem
 * `empty`   — źródło odpowiedziało 200, ale zwróciło zero wpisów (patrz niżej)
 * `claude`  — odmowa albo pusta odpowiedź modelu dla konkretnego wpisu
 * `push`    — błąd wysyłki inny niż wygaśnięcie subskrypcji (404/410)
 * `fatal`   — wyjątek, który przerwał cały przebieg
 */
export type ErrorKind = "source" | "empty" | "claude" | "push" | "fatal";

export interface RunError {
  kind: ErrorKind;
  /** Czego dotyczy: id źródła, URL wpisu, host push service. */
  ref: string;
  message: string;
}

export type RunStatus = "ok" | "degraded" | "failed";

export interface RunReport {
  startedAt: Date;
  durationMs: number;
  status: RunStatus;
  sourcesOk: number;
  sourcesFailed: number;
  candidates: number;
  fresh: number;
  assessed: number;
  delivered: number;
  errors: RunError[];
}

/** Powyżej tego JSONB przestaje być czytelny, a i tak nic nie wnosi. */
const MAX_ERRORS = 50;
const MAX_MESSAGE_CHARS = 300;

const errors: RunError[] = [];

const counters = {
  sourcesOk: 0,
  sourcesFailed: 0,
  candidates: 0,
  fresh: 0,
  assessed: 0,
  delivered: 0,
};

let startedAt = new Date();

export function startRun(): void {
  startedAt = new Date();
  errors.length = 0;
  for (const key of Object.keys(counters) as (keyof typeof counters)[]) {
    counters[key] = 0;
  }
}

function toMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : String(error ?? "brak szczegółów");
  return raw.length > MAX_MESSAGE_CHARS
    ? `${raw.slice(0, MAX_MESSAGE_CHARS)}…`
    : raw;
}

export function noteError(kind: ErrorKind, ref: string, error: unknown): void {
  if (errors.length >= MAX_ERRORS) return;
  errors.push({ kind, ref, message: toMessage(error) });
}

export function count(key: keyof typeof counters, value = 1): void {
  counters[key] += value;
}

export function set(key: keyof typeof counters, value: number): void {
  counters[key] = value;
}

/**
 * Awaria vs. zadrapanie.
 *
 * `failed` rezerwujemy dla sytuacji, w której przebieg nie mógł zrobić swojego:
 * wyjątek na zewnątrz albo zero działających źródeł. Padnięcie jednego feedu
 * to `degraded` — przebieg dowiózł resztę i nie ma powodu, żeby czerwienić
 * cały workflow.
 *
 * `fresh > 0 && assessed === 0` też jest awarią: były nowe wpisy, a żaden nie
 * przeszedł przez model. To wygląda na wyczerpany limit API albo zły klucz,
 * a nie na dzień bez nowinek.
 */
export function currentStatus(): RunStatus {
  if (errors.some((error) => error.kind === "fatal")) return "failed";
  if (counters.sourcesOk === 0) return "failed";
  if (counters.fresh > 0 && counters.assessed === 0) return "failed";
  return errors.length > 0 ? "degraded" : "ok";
}

export function buildReport(): RunReport {
  return {
    startedAt,
    durationMs: Date.now() - startedAt.getTime(),
    status: currentStatus(),
    ...counters,
    errors: [...errors],
  };
}

const ETYKIETY: Record<RunStatus, string> = {
  ok: "OK",
  degraded: "Z zastrzeżeniami",
  failed: "Nieudany",
};

/**
 * Adnotacje i podsumowanie w GitHub Actions.
 *
 * `::warning::` zamiast czerwonego builda dla `degraded` — inaczej jeden feed
 * z chwilowym 429 gasiłby cały workflow i po tygodniu czerwone przestałoby
 * cokolwiek znaczyć. Twarda awaria idzie jako `::error::` i wywraca run,
 * więc GitHub wysyła maila.
 */
export async function publishToActions(report: RunReport): Promise<void> {
  if (!process.env.GITHUB_ACTIONS) return;

  for (const error of report.errors) {
    const poziom = error.kind === "fatal" ? "error" : "warning";
    // Znaki nowej linii łamią format adnotacji — muszą iść jako %0A.
    const tresc = `[${error.kind}] ${error.ref}: ${error.message}`.replace(
      /\r?\n/g,
      "%0A",
    );
    console.log(`::${poziom}::${tresc}`);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const wiersze = [
    `## DevPuls — przebieg: ${ETYKIETY[report.status]}`,
    "",
    "| Metryka | Wartość |",
    "| --- | ---: |",
    `| Źródła OK | ${report.sourcesOk} |`,
    `| Źródła nieudane | ${report.sourcesFailed} |`,
    `| Kandydatów | ${report.candidates} |`,
    `| Nowych po deduplikacji | ${report.fresh} |`,
    `| Ocenionych przez Claude | ${report.assessed} |`,
    `| Digestów dostarczonych | ${report.delivered} |`,
    `| Czas | ${Math.round(report.durationMs / 1000)}s |`,
    "",
  ];

  if (report.errors.length > 0) {
    wiersze.push(`### Zastrzeżenia (${report.errors.length})`, "");
    for (const error of report.errors) {
      wiersze.push(`- \`${error.kind}\` **${error.ref}** — ${error.message}`);
    }
    wiersze.push("");
  }

  await appendFile(summaryPath, wiersze.join("\n"), "utf8");
}
