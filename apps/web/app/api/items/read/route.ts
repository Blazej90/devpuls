import { NextResponse } from "next/server";
import { z } from "zod";

import { countUnread, markAllRead, markRead, TEMATY } from "@/lib/items";

export const dynamic = "force-dynamic";

/**
 * Oznaczanie jako przeczytane. Stan jest **wspólny dla wszystkich urządzeń**
 * (ADR-0002) — użytkownik jest jeden, a osobna skrzynka na telefon i desktop
 * byłaby uciążliwa.
 *
 * `ids` obsługuje zarówno pojedynczy wpis, jak i całą grupę czy zaznaczenie
 * wielu (ADR-0003) — klient zna widoczne id, więc nie ma powodu powtarzać
 * logiki grupowania po stronie serwera.
 *
 * `all: true` czyści skrzynkę, ale **z zawężeniem do aktywnej kategorii**:
 * przycisk widoczny przy odfiltrowanym widoku nie może kasować wpisów,
 * których użytkownik w tym momencie nie widzi.
 */
const Schema = z.union([
  z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }),
  z.object({ all: z.literal(true), temat: z.enum(TEMATY).nullish() }),
]);

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }

  try {
    if ("all" in parsed.data) await markAllRead(parsed.data.temat ?? null);
    else await markRead(parsed.data.ids);
  } catch (error: unknown) {
    console.error("[api/items/read] zapis nieudany", error);
    return NextResponse.json({ error: "Zapis nieudany" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, nieprzeczytane: await countUnread() });
}
