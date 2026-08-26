import { CircleAlert, CircleCheck, Clock, TriangleAlert } from "lucide-react";

import { RefreshButton } from "@/components/inbox-refresh";
import { formatNextRun } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { isStale, STALE_AFTER_HOURS, type LastRun, type RunError } from "@/lib/runs";

const KIND_LABELS: Record<RunError["kind"], string> = {
  source: "źródło",
  empty: "pusty feed",
  claude: "ocena",
  push: "powiadomienie",
  fatal: "przebieg",
};

function relativeTime(hoursAgo: number): string {
  const format = new Intl.RelativeTimeFormat("pl", { numeric: "auto" });
  if (hoursAgo < 1) return "przed chwilą";
  if (hoursAgo < 24) return format.format(-Math.round(hoursAgo), "hour");
  return format.format(-Math.round(hoursAgo / 24), "day");
}

type Tone = "ok" | "warning" | "failure";

const TONES: Record<Tone, { box: string; icon: string }> = {
  ok: { box: "text-muted-foreground", icon: "text-muted-foreground" },
  warning: {
    box: "rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
  },
  failure: {
    box: "border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3",
    icon: "text-destructive",
  },
};

/**
 * Pipeline health strip (Phase 8).
 *
 * With a cron running every 2 days (ADR-0002) a silent failure would stay
 * invisible until someone opened the Actions tab. This strip lives in the app
 * because that is the one place the user opens anyway.
 *
 * When everything works it takes a single line of grey text — monitoring that
 * shouts while healthy stops being read.
 *
 * The refresh button lives here (Phase 11) because this is the sentence that
 * makes someone want to press it: it says how old what you are looking at is.
 */
export function RunStatus({ run, latestId }: { run: LastRun | null; latestId: number }) {
  if (run === null) {
    return (
      <div className="text-muted-foreground space-y-1 text-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-2">
            <Clock className="size-4 shrink-0" aria-hidden />
            Agent nie zapisał jeszcze żadnego przebiegu.
          </p>
          <RefreshButton latestId={latestId} />
        </div>
        <NextRun />
      </div>
    );
  }

  const stale = isStale(run);
  const tone: Tone =
    run.status === "failed" || stale
      ? "failure"
      : run.status === "degraded"
        ? "warning"
        : "ok";

  const Icon =
    tone === "failure" ? CircleAlert : tone === "warning" ? TriangleAlert : CircleCheck;

  const headline = stale
    ? `Brak przebiegu od ponad ${Math.round(STALE_AFTER_HOURS / 24)} dni — sprawdź harmonogram w GitHub Actions`
    : run.status === "failed"
      ? "Ostatni przebieg nie doszedł do końca"
      : run.status === "degraded"
        ? `Ostatni przebieg z zastrzeżeniami (${run.errors.length})`
        : `Sprawdzono ${relativeTime(run.hoursAgo)} · ${run.sourcesOk} źródeł · ${run.assessed} nowych wpisów`;

  return (
    <div className={cn("text-sm", TONES[tone].box)}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2">
          <Icon className={cn("size-4 shrink-0", TONES[tone].icon)} aria-hidden />
          <span>{headline}</span>
        </p>
        <RefreshButton latestId={latestId} />
      </div>

      {tone !== "ok" && run.errors.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs opacity-80">
            Szczegóły ({run.errors.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs opacity-90">
            {run.errors.map((error, index) => (
              <li key={`${error.kind}-${error.ref}-${index}`}>
                <span className="font-medium">{KIND_LABELS[error.kind]}</span>{" "}
                <span className="font-mono">{error.ref}</span> — {error.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      {tone !== "ok" && !stale && (
        <p className="mt-2 text-xs opacity-70">
          Sprawdzono {relativeTime(run.hoursAgo)} · {run.sourcesOk} źródeł OK,{" "}
          {run.sourcesFailed} nieudanych
        </p>
      )}

      {/* Not while stale: the headline is saying the schedule looks broken, and
          naming a date under it would contradict that in the same breath. */}
      {!stale && <NextRun className="mt-1" />}
    </div>
  );
}

/**
 * The next slot in the cron (`lib/schedule.ts`), the counterpart of "Sprawdzono
 * …" above it: one line says how old this is, the other when it stops being.
 *
 * Rendered on the server, which is safe only because the time zone in
 * `date-groups.ts` is pinned — read from the environment it would print the
 * Vercel hour (UTC) rather than the reader's.
 */
function NextRun({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs opacity-70", className)}>
      Najbliższy zaplanowany przebieg: {formatNextRun()}
    </p>
  );
}
