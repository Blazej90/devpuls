import Link from "next/link";
import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { BackgroundBeams } from "@/components/ui/background-beams";

/** „1 źródło", „2 źródła", „11 źródeł" — polska odmiana przez przypadki. */
function odmianaZrodel(liczba: number): string {
  if (liczba === 1) return "1 źródło";
  const reszta = liczba % 10;
  const dziesiatki = liczba % 100;
  const mnoga = reszta >= 2 && reszta <= 4 && (dziesiatki < 12 || dziesiatki > 14);
  return `${liczba} ${mnoga ? "źródła" : "źródeł"}`;
}

/**
 * Nagłówek strony (ADR-0003, Etap 4).
 *
 * Zamiast pięciu ozdobnych chipów z kategoriami — pasek faktów. Chipy udawały
 * filtr, którego nie było; teraz filtr istnieje naprawdę, kawałek niżej, więc
 * ich powtarzanie tutaj tylko myliło. Liczby mówią to samo, co dawny opis,
 * tyle że pokazują skalę, zamiast ją opisywać.
 */
export function Hero({
  nieprzeczytane,
  zrodel,
}: {
  nieprzeczytane: number;
  zrodel: number;
}) {
  const fakty = [
    odmianaZrodel(zrodel),
    // Zgodne z cronem w `.github/workflows/ingest.yml` (ADR-0002).
    "sprawdzane co 2 dni",
    "trafność 1–5",
  ];

  return (
    <header className="relative -mx-6 -mt-12 overflow-hidden px-6 pt-12 pb-8">
      {/* Beams zostają, ale zamknięte w banerze — jako tło całej strony biłyby
          się z przewijaną listą. */}
      <BackgroundBeams className="pointer-events-none" />

      <div className="relative z-10 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            {nieprzeczytane > 0 && <Badge>{nieprzeczytane} nowych</Badge>}
          </div>
          {/* „O aplikacji" jako link w nagłówku, nie karta na dole listy
              (Etap 5): jako karta wyglądała identycznie jak wpis i im więcej
              appka miała treści, tym trudniej było do niej dotrzeć. */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/o-aplikacji"
              className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
            >
              <Info className="size-4" aria-hidden />
              <span className="hidden sm:inline">O aplikacji</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xl font-medium text-balance">
            Twój puls ekosystemu JavaScriptu.
          </p>
          <p className="text-muted-foreground max-w-prose text-balance">
            Agent czyta źródła, odsiewa szum i streszcza po polsku to, co faktycznie
            dotyczy Twojego stacku.
          </p>
        </div>

        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {fakty.map((fakt, index) => (
            <li key={fakt} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden>·</span>}
              <span>{fakt}</span>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
