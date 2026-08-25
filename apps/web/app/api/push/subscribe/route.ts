import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "@/lib/db";

/** The route reads the database on every request — nothing here to prerender. */
export const dynamic = "force-dynamic";

/**
 * The shape returned by `PushSubscription.toJSON()` in the browser.
 * We validate it because the endpoint is public — the database must not receive
 * whatever anyone happens to POST.
 */
const SubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription shape" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;

  try {
    // The same browser re-granting permission sends the same endpoint — we
    // refresh the keys instead of multiplying rows.
    await sql()`
      INSERT INTO push_subscriptions (endpoint, keys_json)
      VALUES (${endpoint}, ${JSON.stringify(keys)}::jsonb)
      ON CONFLICT (endpoint) DO UPDATE SET keys_json = EXCLUDED.keys_json
    `;
  } catch (error: unknown) {
    console.error("[api/push/subscribe] write failed", error);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Unsubscribing — the browser calls this after `unsubscribe()`. */
export async function DELETE(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z.object({ endpoint: z.url().max(2048) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  try {
    await sql()`DELETE FROM push_subscriptions WHERE endpoint = ${parsed.data.endpoint}`;
  } catch (error: unknown) {
    console.error("[api/push/subscribe] delete failed", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
