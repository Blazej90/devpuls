import { NextResponse } from "next/server";

import { getLastRun, isStale, STALE_AFTER_HOURS } from "@/lib/runs";

export const dynamic = "force-dynamic";

/**
 * Pipeline health in a single GET (Phase 8).
 *
 * It exists so external monitoring (UptimeRobot, Better Stack) can be wired up
 * — the app shows the same state, but somebody has to open it. The response
 * code carries the alarm, because monitors react to HTTP status rather than to
 * the JSON body. Only a hard failure and silence (no recent run) get a 503 —
 * `degraded` stays at 200, because one feed with a transient 503 is no reason
 * to wake anyone at three in the morning. The details of the warnings are in
 * the response body and in the app itself.
 *
 * No recent runs is treated here as a failure — that is the only way to detect
 * a disabled workflow or an expired secret. The agent itself will report
 * nothing then, because it never starts at all.
 */
export async function GET() {
  let run;
  try {
    run = await getLastRun();
  } catch (error: unknown) {
    console.error("[api/health] reading runs failed", error);
    return NextResponse.json(
      { status: "failed", reason: "database-unreachable" },
      { status: 503 },
    );
  }

  const stale = isStale(run);
  const healthy = run !== null && run.status !== "failed" && !stale;

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
    { status: healthy ? 200 : 503 },
  );
}
