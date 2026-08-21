import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  ETYKIETY_TEMATOW,
  ETYKIETY_WIDOKOW,
  TEMATY,
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
function adres(widok: Widok, temat: Temat | null): string {
  const params = new URLSearchParams();
  // Wartości domyślne pomijamy, żeby „czysty" adres to było po prostu `/`.
  if (widok !== "nowe") params.set("widok", widok);
  if (temat) params.set("temat", temat);

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

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
