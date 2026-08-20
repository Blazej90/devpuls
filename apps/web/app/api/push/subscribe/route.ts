import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "@/lib/db";

/** Route czyta bazę przy każdym żądaniu — nic tu nie ma do prerenderowania. */
export const dynamic = "force-dynamic";

/**
 * Kształt zwracany przez `PushSubscription.toJSON()` w przeglądarce.
 * Walidujemy go, bo endpoint jest publiczny — do bazy nie może trafić
 * cokolwiek, co ktoś wyśle POST-em.
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
    return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Nieprawidłowy kształt subskrypcji" },
      { status: 400 },
    );
  }

  const { endpoint, keys } = parsed.data;

  try {
    // Ta sama przeglądarka po ponownym udzieleniu zgody przysyła ten sam
    // endpoint — odświeżamy klucze zamiast mnożyć wiersze.
    await sql()`
      INSERT INTO push_subscriptions (endpoint, keys_json)
      VALUES (${endpoint}, ${JSON.stringify(keys)}::jsonb)
      ON CONFLICT (endpoint) DO UPDATE SET keys_json = EXCLUDED.keys_json
    `;
  } catch (error: unknown) {
    console.error("[api/push/subscribe] zapis nieudany", error);
    return NextResponse.json({ error: "Zapis nieudany" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Wypisanie się — przeglądarka woła to po `unsubscribe()`. */
export async function DELETE(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const parsed = z.object({ endpoint: z.url().max(2048) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Brak endpointu" }, { status: 400 });
  }

  try {
    await sql()`DELETE FROM push_subscriptions WHERE endpoint = ${parsed.data.endpoint}`;
  } catch (error: unknown) {
    console.error("[api/push/subscribe] usunięcie nieudane", error);
    return NextResponse.json({ error: "Usunięcie nieudane" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
