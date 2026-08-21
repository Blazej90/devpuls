import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ETYKIETY_TEMATOW,
  ETYKIETY_WIDOKOW,
  TEMATY,
  ROZMIAR_STRONY,
  WIDOKI,
  type Temat,
  type Widok,
} from "@/lib/items";

/**
 * Zakładka i filtr żyją w URL-u (ADR-0003), więc nawigacja to zwykłe linki,
 * a nie komponent kliencki ze stanem. Zysk: działa przycisk wstecz, odświeżenie
 * nie gubi kontekstu, a widok da się wysłać sobie na drugie urządzenie.
 *
 * Świadomie **nie** używamy tu shadcn `tabs`: Radix przełącza panele po stronie
 * klienta, a każda zakładka to u nas inne zapytanie do bazy. Kontrolowanie go
 * URL-em oznaczałoby walkę dwóch źródeł prawdy o to samo.
 */
function adres(widok: Widok, temat: Temat | null, strona = 1): string {
  const params = new URLSearchParams();
  // Wartości domyślne pomijamy, żeby „czysty" adres to było po prostu `/`.
  if (widok !== "nowe") params.set("widok", widok);
  if (temat) params.set("temat", temat);
  if (strona > 1) params.set("strona", String(strona));

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/**
 * Zmiana zakładki albo kategorii **resetuje stronę** — `adres` wywołane bez
 * trzeciego argumentu pomija `strona`. Inaczej przejście na kategorię z trzema
 * wpisami przy otwartej stronie czwartej pokazałoby pustą listę.
 */

/**
 * Nawigacja skrzynki: zakładki (poziom widoku) nad chipami (poziom filtra).
 * Dwa różne kształty — podkreślenie kontra pigułka — bo to dwa różne poziomy
 * hierarchii; gdyby oba były pigułkami, nie dałoby się ich odróżnić.
 */
export function SkrzynkaNawigacja({
  widok,
  temat,
  liczniki,
}: {
  widok: Widok;
  temat: Temat | null;
  liczniki: Record<Widok, number>;
}) {
  return (
    <div className="space-y-4">
      <nav aria-label="Widok skrzynki">
        {/*
          Kreska rozdzielająca jest hairline'em w kolorze `border`, a wskaźnik
          aktywnej zakładki — grubszą kreską w barwie marki. Wcześniej wskaźnik
          miał kolor `primary` (prawie czarny / prawie biały) i siadał dokładnie
          na linii, więc czytało się to jak jedna ciągła kreska zamiast jak
          zaznaczenie.

          Przewijanie w poziomie, bo cztery zakładki z licznikami nie mieszczą
          się w szerokości telefonu.
        */}
        <ul className="border-border flex gap-1 overflow-x-auto border-b [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {WIDOKI.map((pozycja) => {
            const aktywna = pozycja === widok;
            return (
              <li key={pozycja} className="shrink-0">
                <Link
                  href={adres(pozycja, temat)}
                  aria-current={aktywna ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5",
                    "text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none",
                    aktywna
                      ? "border-brand text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  {ETYKIETY_WIDOKOW[pozycja]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums",
                      aktywna
                        ? "bg-brand/15 text-brand"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {liczniki[pozycja]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/*
        Chipy kategorii. Do Etapu 3 stały w nagłówku jako zwykłe `Badge` bez
        obsługi kliknięcia — wyglądały dokładnie jak filtr, którego appce brakowało.
      */}
      <nav aria-label="Filtr kategorii" className="flex flex-wrap gap-2">
        {([null, ...TEMATY] as (Temat | null)[]).map((pozycja) => {
          const aktywna = pozycja === temat;
          return (
            <Link
              key={pozycja ?? "wszystkie"}
              href={adres(widok, pozycja)}
              aria-current={aktywna ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring rounded-full border px-3 py-1 text-xs font-medium",
                "transition-colors focus-visible:ring-1 focus-visible:outline-none",
                aktywna
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}
            >
              {pozycja === null ? "Wszystkie" : ETYKIETY_TEMATOW[pozycja]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * Przejście między stronami skrzynki.
 *
 * Osobny komponent pod listą, a nie kontrolka w `inbox.tsx`: to nawigacja po
 * URL-u, tak samo jak zakładki, więc nie ma powodu wciągać jej w stan kliencki.
 * `<Link>` przewija na górę po zmianie strony — przy paginacji to jest to,
 * czego się oczekuje.
 */
export function Paginacja({
  widok,
  temat,
  strona,
  jestWiecej,
  pokazano,
  wszystkich,
}: {
  widok: Widok;
  temat: Temat | null;
  strona: number;
  jestWiecej: boolean;
  pokazano: number;
  wszystkich: number;
}) {
  // Jedna strona mieści komplet — nie ma po czym nawigować.
  if (strona === 1 && !jestWiecej) return null;

  const pierwszy = (strona - 1) * ROZMIAR_STRONY + 1;
  const ostatni = pierwszy + pokazano - 1;

  return (
    <nav
      aria-label="Strony skrzynki"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
    >
      <PrzyciskStrony
        href={adres(widok, temat, strona - 1)}
        aktywny={strona > 1}
        etykieta="Poprzednia"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Poprzednia
      </PrzyciskStrony>

      <p className="text-muted-foreground text-xs tabular-nums">
        {pokazano > 0 ? `${pierwszy}–${ostatni}` : "0"} z {wszystkich}
      </p>

      <PrzyciskStrony
        href={adres(widok, temat, strona + 1)}
        aktywny={jestWiecej}
        etykieta="Następna"
      >
        Następna
        <ChevronRight className="size-4" aria-hidden />
      </PrzyciskStrony>
    </nav>
  );
}

/** Nieaktywny kierunek renderujemy jako `<span>`, nie wyszarzony link —
 *  martwy odnośnik myli czytnik ekranu i kusi do kliknięcia. */
function PrzyciskStrony({
  href,
  aktywny,
  etykieta,
  children,
}: {
  href: string;
  aktywny: boolean;
  etykieta: string;
  children: React.ReactNode;
}) {
  const klasy = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors";

  if (!aktywny) {
    return (
      <span aria-hidden className={cn(klasy, "text-muted-foreground/40")}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={etykieta}
      className={cn(
        klasy,
        "text-foreground hover:bg-accent focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
      )}
    >
      {children}
    </Link>
  );
}
