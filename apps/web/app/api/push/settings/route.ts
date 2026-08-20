import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Kategorie zwracane przez `packages/agent/src/claude.ts`. */
const TOPICS = ["typescript", "react", "javascript", "fullstack", "ai", "inne"] as const;

/**
 * Endpoint subskrypcji identyfikuje urządzenie, więc chodzi wyłącznie w ciele
 * żądania — nigdy w query stringu, żeby nie lądował w logach ani historii.
 */
const EndpointSchema = z.object({ endpoint: z.url().max(2048) });

const SettingsSchema = EndpointSchema.extend({
  minRelevance: z.number().int().min(1).max(5),
  // null = wszystkie kategorie.
  topics: z.array(z.enum(TOPICS)).nullable(),
});

/** Odczyt ustawień danej subskrypcji. */
export async function POST(request: Request) {
  const parsed = EndpointSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Brak endpointu" }, { status: 400 });
  }

  const rows = (await sql()`
    SELECT min_relevance, topics FROM push_subscriptions
    WHERE endpoint = ${parsed.data.endpoint}
  `) as { min_relevance: number; topics: string[] | null }[];

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Nie znaleziono subskrypcji" }, { status: 404 });
  }

  return NextResponse.json({ minRelevance: row.min_relevance, topics: row.topics });
}

/** Zapis ustawień. Agent czyta je przy każdej wysyłce, więc działają od razu. */
export async function PATCH(request: Request) {
  const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe ustawienia" }, { status: 400 });
  }

  const { endpoint, minRelevance, topics } = parsed.data;
  // Pusta lista znaczyłaby "nic mnie nie interesuje" — traktujemy ją jak brak
  // filtra, bo to prawie na pewno pomyłka, a nie świadomy wybór.
  const normalized = topics && topics.length > 0 ? topics : null;

  const rows = (await sql()`
    UPDATE push_subscriptions
    SET min_relevance = ${minRelevance}, topics = ${normalized}
    WHERE endpoint = ${endpoint}
    RETURNING min_relevance, topics
  `) as { min_relevance: number; topics: string[] | null }[];

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Nie znaleziono subskrypcji" }, { status: 404 });
  }

  return NextResponse.json({ minRelevance: row.min_relevance, topics: row.topics });
}
