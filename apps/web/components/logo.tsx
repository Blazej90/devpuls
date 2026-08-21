import { cn } from "@/lib/utils";

/**
 * Znak DevPulsa — linia pulsu (ADR-0003, Etap 4).
 *
 * Rysowany `stroke`, nie `fill`, i w `currentColor`: dzięki temu ten sam plik
 * obsługuje hero, motyw jasny i ciemny bez drugiej wersji. Wariant z tłem
 * (ikona PWA) siedzi osobno w `public/logo.svg`, bo tam kolory muszą być
 * wpisane na sztywno — system operacyjny nie zna naszych tokenów.
 *
 * Ścieżka: płaska linia bazowa, mniejszy wierzchołek, głębokie zejście,
 * najwyższy wierzchołek, powrót do bazy. Ta sama sylwetka co w ikonie
 * zastępczej, tylko narysowana w wektorze zamiast w powiększonym bitmapie.
 */
export const SCIEZKA_PULSU = "M3 24H13L18 13L24 35L30 9L35 24H45";

export function Znak({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn("size-8", className)}
    >
      <path
        d={SCIEZKA_PULSU}
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Znak plus nazwa. Wordmark jest **tekstem**, nie krzywymi — czyta go
 * czytnik ekranu, skaluje się z ustawieniami systemowymi i nie waży nic.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Znak className="text-brand size-9 shrink-0" />
      <span className="text-4xl font-semibold tracking-tight">DevPuls</span>
    </span>
  );
}
