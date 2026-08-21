/**
 * Podział skrzynki na sekcje po dacie (ADR-0003).
 *
 * Strefa jest **przypięta na sztywno**, a nie brana z przeglądarki. Powód jest
 * techniczny: komponent renderuje się najpierw na serwerze (Vercel liczy w UTC),
 * a potem hydratuje w przeglądarce. Gdyby „dziś" zależało od strefy środowiska,
 * wpis opublikowany o 00:30 czasu polskiego trafiłby na serwerze do „wczoraj",
 * a u użytkownika do „dziś" — i React zgłosiłby niezgodność hydratacji.
 *
 * DevPuls ma jednego odbiorcę i jest w całości po polsku, więc przypięcie do
 * Europe/Warsaw nic nie kosztuje. Gdyby kiedyś doszli użytkownicy z innych stref,
 * trzeba to przenieść do ustawień, a nie odczytywać ze środowiska.
 */
const STREFA = "Europe/Warsaw";

/** `en-CA` daje format `YYYY-MM-DD`, który sortuje się leksykograficznie. */
const DZIEN = new Intl.DateTimeFormat("en-CA", {
  timeZone: STREFA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dzienKalendarzowy(iso: string | Date): string {
  return DZIEN.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Numer dnia od epoki — pozwala odjąć dwie daty bez wpadania w zmiany czasu. */
function numerDnia(ymd: string): number {
  const [rok, miesiac, dzien] = ymd.split("-").map(Number);
  return Date.UTC(rok ?? 1970, (miesiac ?? 1) - 1, dzien ?? 1) / 86_400_000;
}

export const KUBELKI = ["dzis", "wczoraj", "tydzien", "starsze"] as const;
export type Kubelek = (typeof KUBELKI)[number];

export const ETYKIETY_KUBELKOW: Record<Kubelek, string> = {
  dzis: "Dziś",
  wczoraj: "Wczoraj",
  tydzien: "W tym tygodniu",
  starsze: "Starsze",
};

/**
 * `dzisiaj` przychodzi z zewnątrz zamiast być liczone tutaj — serwer ustala go
 * raz i przekazuje w dół, więc klient nie może dojść do innego wyniku, nawet
 * gdyby render wypadł po północy.
 */
export function doKubelka(recency: string, dzisiaj: string): Kubelek {
  const roznica = numerDnia(dzisiaj) - numerDnia(dzienKalendarzowy(recency));

  if (roznica <= 0) return "dzis";
  if (roznica === 1) return "wczoraj";
  if (roznica < 7) return "tydzien";
  return "starsze";
}

export interface Grupa<T> {
  kubelek: Kubelek;
  etykieta: string;
  wpisy: T[];
}

/**
 * Grupuje zachowując kolejność wejścia. Lista przychodzi już posortowana malejąco
 * po dacie (indeksy z migracji 005), więc sekcje same układają się od najnowszej
 * i nie ma po co sortować drugi raz.
 */
export function pogrupuj<T extends { recency: string }>(
  wpisy: T[],
  dzisiaj: string,
): Grupa<T>[] {
  const grupy = new Map<Kubelek, T[]>();

  for (const wpis of wpisy) {
    const kubelek = doKubelka(wpis.recency, dzisiaj);
    const istniejaca = grupy.get(kubelek);
    if (istniejaca) istniejaca.push(wpis);
    else grupy.set(kubelek, [wpis]);
  }

  return KUBELKI.filter((kubelek) => grupy.has(kubelek)).map((kubelek) => ({
    kubelek,
    etykieta: ETYKIETY_KUBELKOW[kubelek],
    wpisy: grupy.get(kubelek) ?? [],
  }));
}

/**
 * Data pod tytułem wpisu. Ta sama przypięta strefa co przy kubełkach —
 * `Intl` bez `timeZone` bierze ją ze środowiska, więc serwer (UTC) i przeglądarka
 * (Europe/Warsaw) potrafiłyby wypisać różne dni i wywalić hydratację.
 */
const DATA_KROTKA = new Intl.DateTimeFormat("pl-PL", {
  timeZone: STREFA,
  day: "numeric",
  month: "long",
});

export function formatujDate(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  return Number.isNaN(data.valueOf()) ? null : DATA_KROTKA.format(data);
}
