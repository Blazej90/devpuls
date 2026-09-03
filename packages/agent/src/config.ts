import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type { SourceConfig } from "@/types.js";

/** ESM has no __dirname — we derive the package directory from import.meta.url. */
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const SOURCES_PATH = path.join(packageRoot, "config", "sources.json");

/**
 * The default relevance threshold for newly created subscriptions (1-5).
 *
 * Since migration 002 the actual threshold lives in the
 * `push_subscriptions.min_relevance` column and is changed from inside the app
 * — this constant only serves as the starting value and duplicates the DEFAULT
 * from the SQL.
 */
export const DEFAULT_RELEVANCE_THRESHOLD = Number(
  process.env.RELEVANCE_THRESHOLD ?? "4",
);

/**
 * How many items we take from a single source per run, at most.
 * A source may lower it for itself with `maxItems` in `sources.json`.
 */
export const MAX_ITEMS_PER_SOURCE = Number(
  process.env.MAX_ITEMS_PER_SOURCE ?? "15",
);

export async function loadSources(): Promise<SourceConfig[]> {
  const raw = await readFile(SOURCES_PATH, "utf8");
  const parsed = JSON.parse(raw) as { sources: SourceConfig[] };

  if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error(`Empty or invalid source config: ${SOURCES_PATH}`);
  }

  for (const source of parsed.sources) {
    /*
      `tier` is checked rather than defaulted, deliberately. Any default would
      have to be `official` — it fits twenty of twenty-four sources — and that
      is exactly what makes it a trap: a community source added without the
      field would be read by the model as an announcement from a vendor, which
      is the one mistake this field exists to prevent. A missing field is a
      typo; a silently generous default is a wrong assessment nobody notices.
    */
    if (source.tier !== "official" && source.tier !== "community") {
      throw new Error(
        `${source.id}: tier must be "official" or "community", got ` +
          JSON.stringify(source.tier),
      );
    }

    // A malformed pattern would keep nothing from its source, and a source that
    // silently keeps nothing is the failure mode this project has already paid
    // for once. Better to refuse to start than to run a quiet no-op for days.
    if (source.titlePattern === undefined) continue;
    try {
      new RegExp(source.titlePattern);
    } catch (error: unknown) {
      throw new Error(
        `${source.id}: invalid titlePattern ${JSON.stringify(source.titlePattern)} — ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  return parsed.sources;
}

/** Fails with a readable error instead of letting `undefined` reach mid-pipeline. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name} — see .env.example`);
  }
  return value;
}
