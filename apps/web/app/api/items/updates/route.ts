import { NextResponse } from "next/server";
import { z } from "zod";

import { countNewerThan, countUnread } from "@/lib/items";

export const dynamic = "force-dynamic";

/**
 * "Has anything arrived since I loaded this?" — behind the pull-to-refresh
 * gesture and the refresh button (Phase 11).
 *
 * A read of its own rather than diffing the result of `router.refresh()`: the
 * refresh hands back fresh HTML but no way to tell whether it differs from what
 * was already on screen, and the whole point of the gesture is being able to
 * answer "nothing new" — which, with a run every two days (ADR-0002), is the
 * honest answer most of the time.
 *
 * The only read route in the app, hence GET: everything else here writes.
 */
const Schema = z.object({ since: z.coerce.number().int().nonnegative() });

export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get("since");
  // `?? undefined` on purpose — `z.coerce.number()` turns a missing parameter
  // into 0, and 0 would report the entire inbox as new.
  const parsed = Schema.safeParse({ since: since ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const [added, unread] = await Promise.all([
      countNewerThan(parsed.data.since),
      countUnread(),
    ]);

    // `unread` comes back from every route in the app so the badge on the PWA
    // icon cannot drift away from the list — a refresh is no exception.
    return NextResponse.json({ added, unread });
  } catch (error: unknown) {
    console.error("[api/items/updates] read failed", error);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
}
