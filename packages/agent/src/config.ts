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

/** How many items we take from a single source per run, at most. */
export const MAX_ITEMS_PER_SOURCE = Number(
  process.env.MAX_ITEMS_PER_SOURCE ?? "15",
);

export async function loadSources(): Promise<SourceConfig[]> {
  const raw = await readFile(SOURCES_PATH, "utf8");
  const parsed = JSON.parse(raw) as { sources: SourceConfig[] };

  if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error(`Empty or invalid source config: ${SOURCES_PATH}`);
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
