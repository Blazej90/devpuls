import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Github, Globe, Linkedin, type LucideIcon } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { countSources } from "@/lib/items";

export const metadata: Metadata = { title: "O aplikacji" };

/** The inbox and this page read the database live — the source count stays current. */
export const dynamic = "force-dynamic";

interface AuthorLink {
  label: string;
  url: string;
  Icon: LucideIcon;
}

/**
 * The author's links. An empty `url` renders nothing, so the section can never
 * show a dead link.
 *
 * The LinkedIn address is stored percent-encoded because it contains Polish
 * characters: it reads as `/in/błażej-bartoszewski-36b7162b7`. Browsers encode
 * that themselves when navigating, but the encoded form also survives
 * everything else — and does not tempt anyone to "fix" it back to literals.
 */
const LINKS: AuthorLink[] = [
  { label: "GitHub", url: "https://github.com/Blazej90", Icon: Github },
  {
    label: "Portfolio",
    url: "https://blazej-portfolio-sand.vercel.app",
    Icon: Globe,
  },
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/b%C5%82a%C5%BCej-bartoszewski-36b7162b7",
    Icon: Linkedin,
  },
];

/**
 * A separate subpage instead of a card at the bottom of the inbox (Stage 5).
 *
 * As a card it looked identical to an item and required scrolling the whole
 * list to reach — that is, the harder to get to the more content the app had.
 * Static text has no reason to compete with the news for the same space.
 */
export default async function AboutPage() {
  const sources = await countSources();
  const visible = LINKS.filter((link) => link.url !== "");

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
            DevPuls co dwa dni obchodzi {sources} źródeł z ekosystemu TypeScriptu,
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
          {/* The year is computed at render time, not hard-coded — the page is
              `force-dynamic`, so the notice will not go stale on 1 January. */}
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()}{" "}
            <span className="text-foreground font-medium">Błażej Bartoszewski</span>
          </p>

          <ul className="flex flex-wrap items-center gap-1">
            {visible.map(({ label, url, Icon }) => (
              <li key={label}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </main>
  );
}
