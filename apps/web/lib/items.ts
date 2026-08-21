import { sql } from "@/lib/db";

/**
 * Jedyne miejsce, w którym powstają zapytania o wpisy (ADR-0003).
 *
 * Od migracji 005 **każde** zapytanie musi odfiltrować `deleted_at IS NULL` —
 * to dokładnie ten rodzaj warunku, o którym zapomina się przy dopisywaniu
 * kolejnego widoku. Dlatego route handlery i strony nie piszą własnego SQL-a,
 * tylko składają widoki z funkcji poniżej.
 */

/** Poniżej tej trafności wpis w ogóle nie trafia do skrzynki. */
const MIN_RELEVANCE = 3;

// Kolejność zakładek. „Ulubione" tuż po „Nowych", bo to drugi kubełek
// „to mnie obchodzi" — archiwum i komplet są rzadziej potrzebne.
export const WIDOKI = ["nowe", "ulubione", "przeczytane", "wszystkie"] as const;
export type Widok = (typeof WIDOKI)[number];

/** Kategorie zwracane przez `packages/agent/src/claude.ts`. */
export const TEMATY = [
  "typescript",
  "react",
  "javascript",
  "fullstack",
  "ai",
  "inne",
] as const;
export type Temat = (typeof TEMATY)[number];

/** Etykiety kategorii w UI. Klucze muszą pokrywać się z `TEMATY`. */
export const ETYKIETY_TEMATOW: Record<Temat, string> = {
  typescript: "TypeScript",
  react: "React",
  javascript: "JavaScript",
  fullstack: "Fullstack",
  ai: "AI",
  inne: "Inne",
};

export const ETYKIETY_WIDOKOW: Record<Widok, string> = {
  nowe: "Nowe",
  ulubione: "Ulubione",
  przeczytane: "Przeczytane",
  wszystkie: "Wszystkie",
};

export interface Filtr {
  widok: Widok;
  /** `null` = bez zawężenia do kategorii. */
  temat: Temat | null;
}

/** Zakładka i filtr żyją w URL-u (ADR-0003), więc muszą znieść dowolne wejście. */
export function parseWidok(raw: string | string[] | undefined): Widok {
  return WIDOKI.find((widok) => widok === raw) ?? "nowe";
}

export function parseTemat(raw: string | string[] | undefined): Temat | null {
  return TEMATY.find((temat) => temat === raw) ?? null;
}

export interface NewsItem {
  id: number;
  url: string;
  title: string;
  summaryPl: string | null;
  relevance: number | null;
  topics: string[] | null;
  publishedAt: string | null;
  sourceName: string;
  readAt: string | null;
  /** Znacznik dodania do ulubionych; `null` = bez gwiazdki (migracja 006). */
  starredAt: string | null;
  /**
   * Data, po której wpis jest sortowany i po której grupuje go skrzynka:
   * publikacja, a w jej braku moment zapisu. Wyliczana w bazie, żeby widok
   * nie musiał powtarzać tej samej reguły co `ORDER BY`.
   */
  recency: string;
}

/**
 * Kształt wiersza tak, jak faktycznie zwraca go sterownik — nie tak, jak
 * wygląda w SQL-u. Dwie pułapki: BIGINT przychodzi jako string, a TIMESTAMPTZ
 * jako obiekt `Date`. Oba normalizujemy w `toItem`, żeby `NewsItem` był tym,
 * co deklaruje, i żeby nic dalej nie musiało o tym pamiętać.
 */
interface ItemRow {
  id: string;
  url: string;
  title_original: string;
  summary_pl: string | null;
  relevance_score: number | null;
  topics: string[] | null;
  published_at: Date | string | null;
  source_name: string;
  read_at: Date | string | null;
  starred_at: Date | string | null;
  recency: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoOrNull(value: Date | string | null): string | null {
  return value === null ? null : toIso(value);
}

function toItem(row: ItemRow): NewsItem {
  return {
    id: Number(row.id),
    url: row.url,
    title: row.title_original,
    summaryPl: row.summary_pl,
    relevance: row.relevance_score,
    topics: row.topics,
    publishedAt: toIsoOrNull(row.published_at),
    sourceName: row.source_name,
    readAt: toIsoOrNull(row.read_at),
    starredAt: toIsoOrNull(row.starred_at),
    recency: toIso(row.recency),
  };
}

/**
 * Kolejność skrzynki. Do migracji 005 było tu samo `created_at`, czyli moment
 * zapisu przez agenta — w obrębie jednego przebiegu identyczny dla wszystkich
 * wpisów, więc realną kolejnością była kolejność odpytywania źródeł i tygodniowy
 * wpis potrafił wylądować nad dzisiejszym. Indeksy z 005 są zbudowane dokładnie
 * na tym wyrażeniu.
 */
const RECENCY = "COALESCE(i.published_at, i.created_at)";

/**
 * Warunki wspólne dla wszystkich widoków, jako sparametryzowany SQL.
 * Zwracany `where` trafia do zapytania przez interpolację — ale składają się
 * na niego wyłącznie nasze własne literały, a wszystkie wartości od użytkownika
 * idą przez `params`.
 */
function budujWarunki(filtr: Filtr): { where: string; params: unknown[] } {
  const params: unknown[] = [MIN_RELEVANCE];
  const czesci = ["i.deleted_at IS NULL", "i.relevance_score >= $1"];

  if (filtr.widok === "nowe") czesci.push("i.read_at IS NULL");
  if (filtr.widok === "przeczytane") czesci.push("i.read_at IS NOT NULL");
  // Ulubione są prostopadłe do stanu przeczytania — zakładka pokazuje je
  // niezależnie od tego, czy wpis został odhaczony.
  if (filtr.widok === "ulubione") czesci.push("i.starred_at IS NOT NULL");

  if (filtr.temat) {
    params.push([filtr.temat]);
    // `&&` = przecięcie tablic; korzysta z indeksu GIN z migracji 002.
    czesci.push(`i.topics && $${params.length}::text[]`);
  }

  return { where: czesci.join(" AND "), params };
}

export async function listItems(filtr: Filtr, limit = 100): Promise<NewsItem[]> {
  const { where, params } = budujWarunki(filtr);
  params.push(limit);

  const rows = (await sql().query(
    `SELECT
       i.id, i.url, i.title_original, i.summary_pl, i.relevance_score,
       i.topics, i.published_at, i.read_at, i.starred_at, s.name AS source_name,
       ${RECENCY} AS recency
     FROM items i
     JOIN sources s ON s.id = i.source_id
     WHERE ${where}
     ORDER BY ${RECENCY} DESC
     LIMIT $${params.length}`,
    params,
  )) as ItemRow[];

  return rows.map(toItem);
}

/**
 * Liczniki przy zakładkach. Respektują aktywny filtr tematu — inaczej zakładka
 * obiecywałaby wpisy, których po zawężeniu i tak nie widać.
 */
export async function liczniki(temat: Temat | null): Promise<Record<Widok, number>> {
  const { where, params } = budujWarunki({ widok: "wszystkie", temat });

  const rows = (await sql().query(
    `SELECT
       COUNT(*) FILTER (WHERE i.read_at IS NULL)::int        AS nowe,
       COUNT(*) FILTER (WHERE i.starred_at IS NOT NULL)::int AS ulubione,
       COUNT(*) FILTER (WHERE i.read_at IS NOT NULL)::int    AS przeczytane,
       COUNT(*)::int                                         AS wszystkie
     FROM items i
     WHERE ${where}`,
    params,
  )) as Record<Widok, number>[];

  return rows[0] ?? { nowe: 0, ulubione: 0, przeczytane: 0, wszystkie: 0 };
}

/**
 * Liczba nieprzeczytanych bez zawężenia do kategorii — to ona ląduje na badge'u
 * ikony PWA, więc musi opisywać całą skrzynkę, nie bieżący widok.
 */
export async function countUnread(): Promise<number> {
  const rows = (await sql()`
    SELECT COUNT(*)::int AS n FROM items
    WHERE read_at IS NULL
      AND deleted_at IS NULL
      AND relevance_score >= ${MIN_RELEVANCE}
  `) as { n: number }[];

  return rows[0]?.n ?? 0;
}

/**
 * Skróty zachowane, dopóki skrzynka nie przejdzie na zakładki (Etap 3).
 *
 * Uwaga na zmianę względem Fazy 9: „Przeczytane" idą teraz od najnowszych
 * **publikacji**, a nie od ostatnio przeczytanych. To świadome — po wprowadzeniu
 * grupowania po dacie obie zakładki muszą dzielić ten sam porządek, inaczej
 * nagłówki sekcji znaczyłyby w każdej co innego.
 */
export function listUnread(limit = 100): Promise<NewsItem[]> {
  return listItems({ widok: "nowe", temat: null }, limit);
}

export function listRead(limit = 30): Promise<NewsItem[]> {
  return listItems({ widok: "przeczytane", temat: null }, limit);
}

/* ---------------------------------------------------------------------------
 * Zapisy. Trzymane tutaj razem z odczytami, bo dzielą z nimi te same warunki
 * (`deleted_at IS NULL`, próg trafności) — rozdzielone rozjechałyby się przy
 * pierwszej zmianie progu.
 * ------------------------------------------------------------------------ */

/**
 * Id przychodzą z JSON-a jako liczby, ale kolumna to BIGINT i sterownik Neona
 * serializuje bigint do stringa — porównanie musi być tekstowe.
 */
function jakoTekst(ids: number[]): string[] {
  return ids.map(String);
}

export async function markRead(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await sql()`
    UPDATE items SET read_at = NOW()
    WHERE read_at IS NULL
      AND deleted_at IS NULL
      AND id = ANY(${jakoTekst(ids)})
  `;
}

/**
 * „Oznacz wszystkie" zawężone do aktywnej kategorii. Bez tego zawężenia
 * przycisk widoczny przy odfiltrowanym widoku czyściłby także wpisy,
 * których użytkownik w tym momencie nie widzi.
 */
export async function markAllRead(temat: Temat | null): Promise<void> {
  if (temat === null) {
    await sql()`
      UPDATE items SET read_at = NOW()
      WHERE read_at IS NULL
        AND deleted_at IS NULL
        AND relevance_score >= ${MIN_RELEVANCE}
    `;
    return;
  }

  await sql()`
    UPDATE items SET read_at = NOW()
    WHERE read_at IS NULL
      AND deleted_at IS NULL
      AND relevance_score >= ${MIN_RELEVANCE}
      AND topics && ${[temat]}::text[]
  `;
}

/**
 * Miękkie usunięcie (ADR-0003). Wiersz zostaje w tabeli, bo `items.url` z UNIQUE
 * to jedyna ochrona przed ponownym pobraniem artykułu przez agenta — twarde
 * DELETE sprawiłoby, że wpis wróci przy najbliższym przebiegu razem
 * z powiadomieniem.
 *
 * Warunek `deleted_at IS NULL` czyni operację idempotentną: powtórzone żądanie
 * nie przesunie znacznika i nie zepsuje cofnięcia.
 */
export async function softDelete(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await sql()`
    UPDATE items SET deleted_at = NOW()
    WHERE deleted_at IS NULL AND id = ANY(${jakoTekst(ids)})
  `;
}

/**
 * Cofnięcie odhaczenia — wpis wraca do „Nowych".
 *
 * Bez tego stan przeczytania był jednokierunkowy: pomyłkowe kliknięcie dało się
 * odwrócić tylko przez bazę. Warunek `read_at IS NOT NULL` czyni operację
 * idempotentną.
 */
export async function markUnread(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await sql()`
    UPDATE items SET read_at = NULL
    WHERE read_at IS NOT NULL
      AND deleted_at IS NULL
      AND id = ANY(${jakoTekst(ids)})
  `;
}

/**
 * Gwiazdka (migracja 006). Ulubione są **prostopadłe** do stanu przeczytania —
 * ta operacja nie rusza `read_at`, a odhaczenie nie rusza gwiazdki.
 */
export async function setStarred(ids: number[], gwiazdka: boolean): Promise<void> {
  if (ids.length === 0) return;

  if (gwiazdka) {
    await sql()`
      UPDATE items SET starred_at = NOW()
      WHERE starred_at IS NULL
        AND deleted_at IS NULL
        AND id = ANY(${jakoTekst(ids)})
    `;
    return;
  }

  await sql()`
    UPDATE items SET starred_at = NULL
    WHERE id = ANY(${jakoTekst(ids)})
  `;
}

/** Cofnięcie usunięcia — obsługuje „Cofnij" w toaście po akcji. */
export async function restore(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  await sql()`
    UPDATE items SET deleted_at = NULL
    WHERE id = ANY(${jakoTekst(ids)})
  `;
}

/**
 * Liczba skonfigurowanych źródeł — do paska faktów w hero.
 *
 * Czytana z bazy, a nie wpisana w tekst: tabelę `sources` synchronizuje agent
 * przy każdym przebiegu z `packages/agent/config/sources.json`, więc dopisanie
 * źródła aktualizuje nagłówek samo. Literał w JSX rozjechałby się po cichu.
 */
export async function countSources(): Promise<number> {
  const rows = (await sql()`SELECT COUNT(*)::int AS n FROM sources`) as { n: number }[];
  return rows[0]?.n ?? 0;
}
