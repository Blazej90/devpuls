import { NextResponse } from "next/server";
import { z } from "zod";

import { countUnread } from "@/lib/items";
import { setMuted } from "@/lib/sources";

export const dynamic = "force-dynamic";

/**
 * Muting a source (migration 008).
 *
 * Unlike the item routes this one takes a single id: muting is a deliberate,
 * one-at-a-time decision, and there is no selection of sources anywhere in the
 * interface to act on in bulk.
 *
 * The id shape matches `parseSource` — `sources.json` guarantees it, and an id
 * that matches nothing simply updates no rows.
 */
const Schema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  muted: z.boolean(),
});

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await setMuted(parsed.data.id, parsed.data.muted);
  } catch (error: unknown) {
    console.error("[api/sources/mute] write failed", error);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  // Muting hides every item from that source, so the badge on the PWA icon
  // changes with it — same contract as the item routes.
  return NextResponse.json({ ok: true, unread: await countUnread() });
}
