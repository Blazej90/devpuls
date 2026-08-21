import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Github, Globe, Linkedin, type LucideIcon } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { countSources } from "@/lib/items";

export const metadata: Metadata = { title: "O aplikacji" };

/** Skrzynka i ta strona czytają bazę na żywo — liczba źródeł ma być aktualna. */
export const dynamic = "force-dynamic";

interface Odnosnik {
  etykieta: string;
  url: string;
  Ikona: LucideIcon;
}

/**
 * Linki autora. Pusty `url` nie renderuje pozycji, więc sekcja nigdy nie
 * pokaże martwego odnośnika.
 *
 * Adres LinkedIna jest zapisany w formie procentowej, bo zawiera polskie znaki:
 * czytelnie brzmi `/in/błażej-bartoszewski-36b7162b7`. Przeglądarki kodują to
 * same przy nawigacji, ale wersja zakodowana przechodzi też przez wszystko inne
 * — i nie kusi, żeby ją "poprawić" z powrotem na literały.
 */
const LINKI: Odnosnik[] = [
  { etykieta: "GitHub", url: "https://github.com/Blazej90", Ikona: Github },
  {
    etykieta: "Portfolio",
    url: "https://blazej-portfolio-sand.vercel.app",
    Ikona: Globe,
  },
  {
    etykieta: "LinkedIn",
    url: "https://www.linkedin.com/in/b%C5%82a%C5%BCej-bartoszewski-36b7162b7",
    Ikona: Linkedin,
  },
];

/**
 * Osobna podstrona zamiast karty na dole skrzynki (Etap 5).
 *
 * Jako karta wyglądała identycznie jak wpis i wymagała przewinięcia całej
 * listy, żeby do niej dotrzeć — czyli była tym trudniej dostępna, im więcej
 * appka miała treści. Tekst statyczny nie ma po co konkurować z newsami
 * o to samo miejsce.
 */
export default async function OAplikacjiPage() {
  const zrodel = await countSources();
  const widoczne = LINKI.filter((link) => link.url !== "");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <Link href="/" className="rounded-md focus-visible:ring-1 focus-visible:outline-none">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Wróć do skrzynki
      </Link>

      <article className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">O aplikacji</h1>

        <div className="text-muted-foreground space-y-4 leading-relaxed">
          <p>
            DevPuls co dwa dni obchodzi {zrodel} źródeł z ekosystemu TypeScriptu,
            Reacta, JavaScriptu i narzędzi AI — blogi wydawców, kanały wydań na
            GitHubie, Hacker News i wybrane subreddity.
          </p>
          <p>
            Każdy nowy wpis dostaje ocenę trafności od 1 do 5 oraz streszczenie po
            polsku; jedno i drugie robi Claude, oceniając wpis pod kątem konkretnego
            profilu: fullstack pracujący na co dzień w TypeScripcie i Reakcie.
            Streszczenie nigdy nie zastępuje źródła — każdy wpis ma link do oryginału.
          </p>
          <p>
            To, co przejdzie próg trafności, przychodzi jako <strong>jedno zbiorcze
            powiadomienie</strong> na przebieg, nie jedno na wpis, i ląduje w skrzynce.
            Próg i kategorie ustawiasz osobno dla każdego urządzenia — telefon może
            chcieć czegoś innego niż laptop.
          </p>
          <p>
            Appka jest instalowalna (PWA) i działa na telefonie tak samo jak
            w przeglądarce. Stan przeczytania jest wspólny dla wszystkich urządzeń,
            bo odbiorca jest jeden.
          </p>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Rok liczony przy renderze, nie wpisany na sztywno — strona jest
              `force-dynamic`, więc nota nie zestarzeje się 1 stycznia. */}
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()}{" "}
            <span className="text-foreground font-medium">Błażej Bartoszewski</span>
          </p>

          <ul className="flex flex-wrap items-center gap-1">
            {widoczne.map(({ etykieta, url, Ikona }) => (
              <li key={etykieta}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                >
                  <Ikona className="size-4" aria-hidden />
                  {etykieta}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </main>
  );
}
