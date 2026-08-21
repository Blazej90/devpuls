"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const OPCJE = [
  { wartosc: "light", etykieta: "Jasny", Ikona: Sun },
  { wartosc: "dark", etykieta: "Ciemny", Ikona: Moon },
  { wartosc: "system", etykieta: "Systemowy", Ikona: Monitor },
] as const;

/**
 * Czy jesteśmy już po stronie klienta.
 *
 * `useTheme()` na serwerze nie zna wybranego motywu — renderowanie go od razu
 * dałoby niezgodność hydratacji. `useSyncExternalStore` zamiast
 * `useState` + `useEffect`, bo ustawianie stanu w ciele efektu łamie regułę
 * `react-hooks`; ten sam wzorzec obsługuje prompt instalacji PWA.
 */
function useZamontowany(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Przełącznik motywu — trzy stany, nie dwa (ADR-0003).
 *
 * „Systemowy" jest osobną opcją, a nie stanem startowym, który znika po
 * pierwszym kliknięciu: bez niego nie da się wrócić do podążania za ustawieniem
 * telefonu, a to jedyny tryb, który sam przełącza się wieczorem.
 *
 * Segment zamiast rozwijanego menu — trzy opcje mieszczą się w jednym rzędzie,
 * więc zmiana to jedno dotknięcie, a bieżący wybór widać bez otwierania.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const zamontowany = useZamontowany();

  return (
    <ToggleGroup
      type="single"
      // Przed hydratacją nic nie jest zaznaczone — inaczej serwer i klient
      // wyrenderowałyby różne stany. Rozmiar kontrolki się nie zmienia,
      // więc nic nie skacze.
      value={zamontowany ? theme : ""}
      onValueChange={(wartosc) => {
        // Radix pozwala odznaczyć aktywny element; motyw musi zostać wybrany.
        if (wartosc) setTheme(wartosc);
      }}
      variant="outline"
      size="sm"
      aria-label="Motyw"
      className="gap-0"
    >
      {OPCJE.map(({ wartosc, etykieta, Ikona }) => (
        <ToggleGroupItem
          key={wartosc}
          value={wartosc}
          aria-label={etykieta}
          title={etykieta}
          // Domyślne `data-[state=on]:bg-accent` z shadcn to w trybie jasnym
          // #f5f5f5 na białym tle — kontrast 1,08:1, czyli nie widać, który
          // motyw jest wybrany. `primary` odwraca kolory i działa w obu
          // motywach, tak samo jak aktywny próg trafności w ustawieniach.
          // `-ml-px` skleja sąsiadujące ramki w jeden segment.
          className={cn(
            "relative rounded-none border-input first:rounded-l-md last:rounded-r-md",
            "[&:not(:first-child)]:-ml-px",
            "data-[state=on]:z-10 data-[state=on]:border-primary",
            "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
          )}
        >
          <Ikona className="size-4" aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
