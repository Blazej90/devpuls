/** Typ źródła — decyduje, który moduł z `src/sources/` je obsłuży. */
export type SourceType = "rss" | "atom" | "scrape";

/** Wpis z `config/sources.json`. */
export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  topics: string[];
  note?: string;
}

/**
 * Znormalizowany wpis — każdy fetcher zwraca dokładnie ten kształt,
 * niezależnie od formatu wejściowego (RSS, Atom, HTML).
 */
export interface NormalizedItem {
  sourceId: string;
  url: string;
  title: string;
  /** ISO 8601. `null`, gdy źródło nie podaje daty. */
  publishedAt: string | null;
  /** Lead/opis z feedu, jeśli jest — trafia do promptu jako kontekst. */
  excerpt?: string;
}

/** Wynik oceny przez Claude — jedno wywołanie na wpis. */
export interface Assessment {
  /** 1 = zupełnie nietrafione, 5 = must-read dla profilu zainteresowań. */
  relevance: number;
  /** Streszczenie po polsku, 2-3 zdania. */
  summaryPl: string;
  /** Tematy rozpoznane przez model (typescript, react, ai, ...). */
  topics: string[];
}

/** Wpis gotowy do zapisu w bazie i wysyłki push. */
export interface AssessedItem extends NormalizedItem {
  assessment: Assessment;
}
