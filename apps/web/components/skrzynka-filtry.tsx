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

export function WidokTabs({
  widok,
  temat,
  liczniki,
}: {
  widok: Widok;
  temat: Temat | null;
  liczniki: Record<Widok, number>;
}) {
  return (
    <nav aria-label="Widok skrzynki" className="border-border -mb-px flex gap-1 border-b">
      {WIDOKI.map((pozycja) => {
        const aktywna = pozycja === widok;
        return (
          <Link
            key={pozycja}
            href={adres(pozycja, temat)}
            aria-current={aktywna ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring -mb-px rounded-t-md border-b-2 px-3 py-2 text-sm",
              "transition-colors focus-visible:ring-1 focus-visible:outline-none",
              aktywna
                ? "border-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {ETYKIETY_WIDOKOW[pozycja]}
            <span className="text-muted-foreground ml-1.5 tabular-nums">
              {liczniki[pozycja]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Chipy kategorii. Do Etapu 3 stały w nagłówku jako zwykłe `Badge` bez obsługi
 * kliknięcia — wyglądały dokładnie jak filtr, którego appce brakowało.
 */
export function TematyFiltr({
  widok,
  temat,
}: {
  widok: Widok;
  temat: Temat | null;
}) {
  const pozycje: (Temat | null)[] = [null, ...TEMATY];

  return (
    <nav aria-label="Filtr kategorii" className="flex flex-wrap gap-2">
      {pozycje.map((pozycja) => {
        const aktywna = pozycja === temat;
        return (
          <Link
            key={pozycja ?? "wszystkie"}
            href={adres(widok, pozycja)}
            aria-current={aktywna ? "true" : undefined}
            className={cn(
              "focus-visible:ring-ring rounded-md border px-2.5 py-0.5 text-xs font-semibold",
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
  );
}
