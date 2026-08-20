import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Oznaczanie jako przeczytane. Stan jest **wspólny dla wszystkich urządzeń**
 * (ADR-0002) — użytkownik jest jeden, a osobna skrzynka na telefon i desktop
 * byłaby uciążliwa.
 *
 * `ids` oznacza konkretne wpisy, `all: true` czyści całą skrzynkę.
 */
const Schema = z.union([
  z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }),
  z.object({ all: z.literal(true) }),
]);

export async function POST(request: Request) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }

  try {
    if ("all" in parsed.data) {
      await sql()`
        UPDATE items SET read_at = NOW()
        WHERE read_at IS NULL AND relevance_score >= 3
      `;
    } else {
      // Id trafiają tu jako liczby z JSON-a, ale kolumna to BIGINT i Postgres
      // dopasuje je tylko przy porównaniu tekstowym — sterownik Neona i tak
      // serializuje bigint jako string.
      await sql()`
        UPDATE items SET read_at = NOW()
        WHERE read_at IS NULL AND id = ANY(${parsed.data.ids.map(String)})
      `;
    }
  } catch (error: unknown) {
    console.error("[api/items/read] zapis nieudany", error);
    return NextResponse.json({ error: "Zapis nieudany" }, { status: 500 });
  }

  const rows = (await sql()`
    SELECT COUNT(*)::int AS n FROM items
    WHERE read_at IS NULL AND relevance_score >= 3
  `) as { n: number }[];

  return NextResponse.json({ ok: true, nieprzeczytane: rows[0]?.n ?? 0 });
}
