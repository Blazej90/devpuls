import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type { SourceConfig } from "@/types.js";

/** ESM nie ma __dirname — wyliczamy katalog pakietu z import.meta.url. */
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const SOURCES_PATH = path.join(packageRoot, "config", "sources.json");

/** Próg trafności, od którego wysyłamy powiadomienie (1-5). */
export const RELEVANCE_THRESHOLD = Number(
  process.env.RELEVANCE_THRESHOLD ?? "4",
);

/** Ile wpisów maksymalnie bierzemy z jednego źródła na przebieg. */
export const MAX_ITEMS_PER_SOURCE = Number(
  process.env.MAX_ITEMS_PER_SOURCE ?? "15",
);

export async function loadSources(): Promise<SourceConfig[]> {
  const raw = await readFile(SOURCES_PATH, "utf8");
  const parsed = JSON.parse(raw) as { sources: SourceConfig[] };

  if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error(`Pusty lub niepoprawny config źródeł: ${SOURCES_PATH}`);
  }

  return parsed.sources;
}

/** Rzuca czytelnym błędem zamiast pozwolić na `undefined` w połowie pipeline'u. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Brak zmiennej środowiskowej ${name} — patrz .env.example`);
  }
  return value;
}
