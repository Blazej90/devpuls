import { NextResponse } from "next/server";
import { z } from "zod";

import { countUnread, setStarred } from "@/lib/items";

export const dynamic = "force-dynamic";

/**
 * Ulubione (migracja 006). Osobna trasa, a nie flaga przy `/read`, bo to inna
 * właściwość wpisu: gwiazdka nie mówi nic o tym, czy wpis został przeczytany,
 * i odwrotnie.
 *
 * `gwiazdka` jest jawne zamiast przełączania po stronie serwera — klient zna
 * bieżący stan każdej karty, a przełącznik na serwerze rozjechałby się przy
 * dwóch kliknięciach z rzędu albo przy akcji na zaznaczeniu o mieszanym stanie.
 */
const Schema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  gwiazdka: z.boolean(),
});

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }

  try {
    await setStarred(parsed.data.ids, parsed.data.gwiazdka);
  } catch (error: unknown) {
    console.error("[api/items/star] zapis nieudany", error);
    return NextResponse.json({ error: "Zapis nieudany" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, nieprzeczytane: await countUnread() });
}
