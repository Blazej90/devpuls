import { CircleAlert, CircleCheck, Clock, TriangleAlert } from "lucide-react";

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

type Ton = "ok" | "uwaga" | "awaria";

const TONY: Record<Ton, { box: string; icon: string }> = {
  ok: { box: "text-muted-foreground", icon: "text-muted-foreground" },
  uwaga: {
    box: "rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
  },
  awaria: {
    box: "border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3",
    icon: "text-destructive",
  },
};

/**
 * Pasek zdrowia pipeline'u (Faza 8).
 *
 * Przy cronie co 2 dni (ADR-0002) cicha awaria byłaby niewidoczna do
 * następnego wejścia do zakładki Actions. Ten pasek jest w appce, bo to
 * jedyne miejsce, które użytkownik i tak otwiera.
 *
 * Gdy wszystko działa, zajmuje jedną linijkę szarym tekstem — monitoring,
 * który krzyczy przy zdrowym stanie, przestaje być czytany.
 */
export function RunStatus({ run }: { run: LastRun | null }) {
  if (run === null) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Clock className="size-4 shrink-0" aria-hidden />
        Agent nie zapisał jeszcze żadnego przebiegu.
      </p>
    );
  }

  const przeterminowany = isStale(run);
  const ton: Ton =
    run.status === "failed" || przeterminowany
      ? "awaria"
      : run.status === "degraded"
        ? "uwaga"
        : "ok";

  const Icon =
    ton === "awaria" ? CircleAlert : ton === "uwaga" ? TriangleAlert : CircleCheck;

  const naglowek = przeterminowany
    ? `Brak przebiegu od ponad ${Math.round(STALE_AFTER_HOURS / 24)} dni — sprawdź harmonogram w GitHub Actions`
    : run.status === "failed"
      ? "Ostatni przebieg nie doszedł do końca"
      : run.status === "degraded"
        ? `Ostatni przebieg z zastrzeżeniami (${run.errors.length})`
        : `Sprawdzono ${relativeTime(run.hoursAgo)} · ${run.sourcesOk} źródeł · ${run.assessed} nowych wpisów`;

  return (
    <div className={cn("text-sm", TONY[ton].box)}>
      <p className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", TONY[ton].icon)} aria-hidden />
        <span>{naglowek}</span>
      </p>

      {ton !== "ok" && run.errors.length > 0 && (
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

      {ton !== "ok" && !przeterminowany && (
        <p className="mt-2 text-xs opacity-70">
          Sprawdzono {relativeTime(run.hoursAgo)} · {run.sourcesOk} źródeł OK,{" "}
          {run.sourcesFailed} nieudanych
        </p>
      )}
    </div>
  );
}
