import { NextResponse } from "next/server";
import { z } from "zod";

import { countUnread, setStarred } from "@/lib/items";
import { readMinRelevance } from "@/lib/preferences";

export const dynamic = "force-dynamic";

/**
 * Favourites (migration 006). A separate route rather than a flag on `/read`,
 * because it is a different property of an item: a star says nothing about
 * whether the item has been read, and vice versa.
 *
 * `starred` is explicit instead of a server-side toggle — the client knows the
 * current state of every card, and a toggle on the server would drift on two
 * clicks in a row or on an action over a selection with mixed state.
 */
const Schema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  starred: z.boolean(),
});

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await setStarred(parsed.data.ids, parsed.data.starred);
  } catch (error: unknown) {
    console.error("[api/items/star] write failed", error);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    unread: await countUnread(await readMinRelevance()),
  });
}
