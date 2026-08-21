import { NextResponse } from "next/server";
import { z } from "zod";

import { countUnread, markAllRead, markRead, markUnread, TEMATY } from "@/lib/items";

export const dynamic = "force-dynamic";

/**
 * Stan przeczytania. Wspólny dla wszystkich urządzeń (ADR-0002) — użytkownik
 * jest jeden, a osobna skrzynka na telefon i desktop byłaby uciążliwa.
 *
 * `ids` obsługuje pojedynczy wpis, całą grupę i zaznaczenie wielu (ADR-0003) —
 * klient zna widoczne id, więc nie ma powodu powtarzać logiki grupowania na
 * serwerze. `odznacz: true` cofa odhaczenie: bez tego stan był jednokierunkowy
 * i pomyłkowe kliknięcie dało się odwrócić tylko przez bazę.
 *
 * `all: true` czyści skrzynkę, ale **z zawężeniem do aktywnej kategorii**:
 * przycisk widoczny przy odfiltrowanym widoku nie może kasować wpisów,
 * których użytkownik w tym momencie nie widzi.
 */
const Schema = z.union([
  z.object({
    ids: z.array(z.number().int().positive()).min(1).max(500),
    odznacz: z.boolean().optional(),
  }),
  z.object({ all: z.literal(true), temat: z.enum(TEMATY).nullish() }),
]);

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }

  try {
    if ("all" in parsed.data) await markAllRead(parsed.data.temat ?? null);
    else if (parsed.data.odznacz) await markUnread(parsed.data.ids);
    else await markRead(parsed.data.ids);
  } catch (error: unknown) {
    console.error("[api/items/read] zapis nieudany", error);
    return NextResponse.json({ error: "Zapis nieudany" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, nieprzeczytane: await countUnread() });
}
