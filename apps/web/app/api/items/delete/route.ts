import { NextResponse } from "next/server";
import { z } from "zod";

import { countUnread, restore, softDelete } from "@/lib/items";
import { readMinRelevance } from "@/lib/preferences";

export const dynamic = "force-dynamic";

/**
 * Removing items from the inbox — **soft** (ADR-0003). The row stays in the
 * database with `deleted_at` set, because `items.url` with its UNIQUE
 * constraint is the only protection against the agent fetching the article
 * again.
 *
 * `restore: true` reverts the operation — it backs the "Cofnij" action in the
 * toast. The same route, because it is the same column and the same set of ids.
 */
const Schema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  restore: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { ids, restore: shouldRestore } = parsed.data;

  try {
    if (shouldRestore) await restore(ids);
    else await softDelete(ids);
  } catch (error: unknown) {
    console.error("[api/items/delete] write failed", error);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  // Deleting an unread item changes the count on the PWA icon badge, so we send
  // it back in the same response — otherwise the badge would lie until the next
  // refresh.
  return NextResponse.json({
    ok: true,
    unread: await countUnread(await readMinRelevance()),
  });
}
