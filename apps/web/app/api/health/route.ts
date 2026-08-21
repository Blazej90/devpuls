import { NextResponse } from "next/server";

import { getLastRun, isStale, STALE_AFTER_HOURS } from "@/lib/runs";

export const dynamic = "force-dynamic";

/**
 * Zdrowie pipeline'u w jednym GET-cie (Faza 8).
 *
 * Istnieje po to, żeby dało się podpiąć zewnętrzny monitoring (UptimeRobot,
 * Better Stack) — appka pokazuje ten sam stan, ale ktoś musi ją otworzyć.
 * Kod odpowiedzi jest nośnikiem alarmu, bo monitoringi reagują na status HTTP,
 * nie na treść JSON-a. 503 dostaje wyłącznie twarda awaria i cisza (brak
 * świeżego przebiegu) — `degraded` zostaje na 200, bo jeden feed z chwilowym
 * 503 nie jest powodem do budzenia nikogo o trzeciej w nocy. Szczegóły
 * zastrzeżeń są w treści odpowiedzi i w samej appce.
 *
 * Brak nowych przebiegów jest tu traktowany jak awaria — to jedyna droga,
 * żeby wykryć wyłączony workflow albo wygasły sekret. Sam agent wtedy nie
 * zgłosi niczego, bo w ogóle się nie uruchamia.
 */
export async function GET() {
  let run;
  try {
    run = await getLastRun();
  } catch (error: unknown) {
    console.error("[api/health] odczyt przebiegów nieudany", error);
    return NextResponse.json(
      { status: "failed", reason: "database-unreachable" },
      { status: 503 },
    );
  }

  const stale = isStale(run);
  const zdrowy = run !== null && run.status !== "failed" && !stale;

  return NextResponse.json(
    {
      status: run?.status ?? "unknown",
      stale,
      staleAfterHours: STALE_AFTER_HOURS,
      lastRun: run && {
        finishedAt: run.finishedAt,
        hoursAgo: Math.round(run.hoursAgo * 10) / 10,
        durationMs: run.durationMs,
        sourcesOk: run.sourcesOk,
        sourcesFailed: run.sourcesFailed,
        assessed: run.assessed,
        delivered: run.delivered,
        errors: run.errors,
      },
    },
    { status: zdrowy ? 200 : 503 },
  );
}
