import { appendFile } from "node:fs/promises";

/**
 * Collecting the health of a single run (Phase 8).
 *
 * The collector is module-scoped (state at module level) rather than passed as
 * a parameter, deliberately: the agent is a one-shot script — one process = one
 * run — and threading a report object through `claude.ts`, `push.ts` and the
 * fetchers would change their signatures only to deliver logging. Should the
 * agent ever handle several runs at once, this has to be rewritten.
 */

/**
 * `source`  — the source did not respond / threw
 * `empty`   — the source responded 200 but returned zero items (see below)
 * `claude`  — a refusal or an empty model response for a specific item
 * `push`    — a delivery error other than an expired subscription (404/410)
 * `fatal`   — an exception that aborted the whole run
 */
export type ErrorKind = "source" | "empty" | "claude" | "push" | "fatal";

export interface RunError {
  kind: ErrorKind;
  /** What it refers to: a source id, an item URL, a push service host. */
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

/** Beyond this the JSONB stops being readable and adds nothing anyway. */
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
    error instanceof Error ? error.message : String(error ?? "no details");
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
 * A failure versus a scratch.
 *
 * `failed` is reserved for a run that could not do its job: an exception
 * escaping, or zero working sources. One feed going down is `degraded` — the
 * run delivered the rest and there is no reason to turn the whole workflow red.
 *
 * `fresh > 0 && assessed === 0` is a failure too: there were new items and none
 * of them made it through the model. That looks like an exhausted API quota or
 * a bad key, not like a day without news.
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

const STATUS_LABELS: Record<RunStatus, string> = {
  ok: "OK",
  degraded: "Z zastrzeżeniami",
  failed: "Nieudany",
};

/**
 * Annotations and the summary in GitHub Actions.
 *
 * `::warning::` instead of a red build for `degraded` — otherwise one feed with
 * a transient 429 would kill the whole workflow and after a week red would stop
 * meaning anything. A hard failure goes out as `::error::` and fails the run,
 * so GitHub sends an email.
 */
export async function publishToActions(report: RunReport): Promise<void> {
  if (!process.env.GITHUB_ACTIONS) return;

  for (const error of report.errors) {
    const level = error.kind === "fatal" ? "error" : "warning";
    // Newlines break the annotation format — they have to go as %0A.
    const text = `[${error.kind}] ${error.ref}: ${error.message}`.replace(
      /\r?\n/g,
      "%0A",
    );
    console.log(`::${level}::${text}`);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const lines = [
    `## DevPuls — przebieg: ${STATUS_LABELS[report.status]}`,
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
    lines.push(`### Zastrzeżenia (${report.errors.length})`, "");
    for (const error of report.errors) {
      lines.push(`- \`${error.kind}\` **${error.ref}** — ${error.message}`);
    }
    lines.push("");
  }

  await appendFile(summaryPath, lines.join("\n"), "utf8");
}
