import { NextResponse } from "next/server";
import { z } from "zod";

import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Categories returned by `packages/agent/src/claude.ts`. */
const TOPICS = ["typescript", "react", "javascript", "fullstack", "ai", "other"] as const;

/**
 * The subscription endpoint identifies the device, so it travels in the request
 * body only — never in a query string, so it does not end up in logs or in
 * browser history.
 */
const EndpointSchema = z.object({ endpoint: z.url().max(2048) });

const SettingsSchema = EndpointSchema.extend({
  minRelevance: z.number().int().min(1).max(5),
  // null = all categories.
  topics: z.array(z.enum(TOPICS)).nullable(),
});

/** Reading the settings of a given subscription. */
export async function POST(request: Request) {
  const parsed = EndpointSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  const rows = (await sql()`
    SELECT min_relevance, topics FROM push_subscriptions
    WHERE endpoint = ${parsed.data.endpoint}
  `) as { min_relevance: number; topics: string[] | null }[];

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  return NextResponse.json({ minRelevance: row.min_relevance, topics: row.topics });
}

/** Writing the settings. The agent reads them on every send, so they apply at once. */
export async function PATCH(request: Request) {
  const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  const { endpoint, minRelevance, topics } = parsed.data;
  // An empty list would mean "nothing interests me" — we treat it as no filter,
  // because it is almost certainly a mistake rather than a deliberate choice.
  const normalized = topics && topics.length > 0 ? topics : null;

  const rows = (await sql()`
    UPDATE push_subscriptions
    SET min_relevance = ${minRelevance}, topics = ${normalized}
    WHERE endpoint = ${endpoint}
    RETURNING min_relevance, topics
  `) as { min_relevance: number; topics: string[] | null }[];

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  return NextResponse.json({ minRelevance: row.min_relevance, topics: row.topics });
}
