import { NextResponse } from "next/server";
import { z } from "zod";

import { countUnread, restore, softDelete } from "@/lib/items";

export const dynamic = "force-dynamic";

/**
 * Usuwanie wpisów ze skrzynki — **miękkie** (ADR-0003). Wiersz zostaje w bazie
 * z ustawionym `deleted_at`, bo `items.url` z UNIQUE to jedyna ochrona przed
 * ponownym pobraniem artykułu przez agenta.
 *
 * `przywroc: true` cofa operację — obsługuje „Cofnij" w toaście. Ta sama trasa,
 * bo to ta sama kolumna i ten sam zbiór id.
 */
const Schema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  przywroc: z.boolean().optional(),
});

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }

  const { ids, przywroc } = parsed.data;

  try {
    if (przywroc) await restore(ids);
    else await softDelete(ids);
  } catch (error: unknown) {
    console.error("[api/items/delete] zapis nieudany", error);
    return NextResponse.json({ error: "Zapis nieudany" }, { status: 500 });
  }

  // Usunięcie nieprzeczytanego wpisu zmienia licznik na badge'u ikony PWA,
  // więc odsyłamy go w tej samej odpowiedzi — inaczej badge kłamałby do
  // następnego odświeżenia.
  return NextResponse.json({ ok: true, nieprzeczytane: await countUnread() });
}
