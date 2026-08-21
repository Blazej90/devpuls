"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Motyw jasny/ciemny (ADR-0003).
 *
 * Do Etapu 2 blok `.dark` w `globals.css` był martwym kodem — pełna paleta
 * tokenów istniała, ale nic nigdy nie dodawało klasy `.dark` do dokumentu,
 * więc wszystkie warianty `dark:` w Tailwindzie nigdy się nie uruchamiały.
 *
 * `next-themes`, a nie własny `useState`: biblioteka wstrzykuje skrypt
 * ustawiający klasę **przed** pierwszym malowaniem. Ręczne rozwiązanie
 * czytałoby preferencję dopiero w efekcie, czyli po hydratacji — przy każdym
 * wejściu w trybie ciemnym mignęłoby białe tło.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Bez tego przełączenie animuje każdą deklarację `transition-colors`
      // na stronie naraz — wygląda jak zacięcie, nie jak zmiana motywu.
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
