"use client";

import { useSyncExternalStore } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Po ilu pikselach przewinięcia przycisk ma sens — mniej więcej jeden ekran. */
const PROG = 800;

function subskrybuj(przeladuj: () => void): () => void {
  window.addEventListener("scroll", przeladuj, { passive: true });
  return () => window.removeEventListener("scroll", przeladuj);
}

/**
 * Powrót na górę przy długich listach.
 *
 * `useSyncExternalStore`, a nie `useState` + `useEffect`: pozycja przewinięcia
 * to stan spoza Reacta, a ustawianie stanu w ciele efektu łamie regułę
 * `react-hooks`. Migawka serwerowa zwraca `false`, więc przycisk nie pojawia
 * się w HTML-u i nie ma niezgodności hydratacji.
 *
 * Umieszczony wyżej niż pasek akcji zbiorczych ze skrzynki (\`bottom-6\`), żeby
 * nigdy się z nim nie nakładał — na telefonie ten pasek zajmuje niemal całą
 * szerokość, więc rozsunięcie w poziomie by nie wystarczyło.
 */
export function DoGory() {
  const widoczny = useSyncExternalStore(
    subskrybuj,
    () => window.scrollY > PROG,
    () => false,
  );

  if (!widoczny) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Wróć na górę strony"
      title="Wróć na górę"
      onClick={() =>
        window.scrollTo({
          top: 0,
          // Płynne przewijanie tylko dla tych, którzy nie prosili o mniej ruchu.
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        })
      }
      className="bg-background/90 fixed right-4 bottom-24 z-40 shadow-lg backdrop-blur"
    >
      <ArrowUp className="size-4" aria-hidden />
    </Button>
  );
}
