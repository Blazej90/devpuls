import { NextResponse } from "next/server";
import { z } from "zod";

import { countUnread, markAllRead, markRead, markUnread, TOPICS } from "@/lib/items";
import { readMinRelevance } from "@/lib/preferences";

export const dynamic = "force-dynamic";

/**
 * Read state. Shared across all devices (ADR-0002) — there is a single user,
 * and a separate inbox for phone and desktop would be a nuisance.
 *
 * `ids` covers a single item, a whole group and a multi-selection (ADR-0003) —
 * the client knows the visible ids, so there is no reason to duplicate the
 * grouping logic on the server. `unmark: true` reverts marking as read: without
 * it the state was one-way and a mistaken click could only be undone through
 * the database.
 *
 * `all: true` clears the inbox, but **narrowed to the active category**: a
 * button shown on a filtered view must not clear items the user cannot see at
 * that moment.
 */
const Schema = z.union([
  z.object({
    ids: z.array(z.number().int().positive()).min(1).max(500),
    unmark: z.boolean().optional(),
  }),
  z.object({ all: z.literal(true), topic: z.enum(TOPICS).nullish() }),
]);

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // "Mark all" must not reach past the visible list, and the badge has to be
  // counted with the same floor the list was rendered with.
  const minRelevance = await readMinRelevance();

  try {
    if ("all" in parsed.data) await markAllRead(parsed.data.topic ?? null, minRelevance);
    else if (parsed.data.unmark) await markUnread(parsed.data.ids);
    else await markRead(parsed.data.ids);
  } catch (error: unknown) {
    console.error("[api/items/read] write failed", error);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, unread: await countUnread(minRelevance) });
}
