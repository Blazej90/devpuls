import Link from "next/link";
import { Bot, Info, Rss, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { BackgroundBeams } from "@/components/ui/background-beams";

/** "1 źródło", "2 źródła", "11 źródeł" — Polish plural inflection. */
function formatSourceCount(count: number): string {
  if (count === 1) return "1 źródło";
  const units = count % 10;
  const teens = count % 100;
  const fewForm = units >= 2 && units <= 4 && (teens < 12 || teens > 14);
  return `${count} ${fewForm ? "źródła" : "źródeł"}`;
}

/**
 * Page header (ADR-0003, Stage 4).
 *
 * A facts strip instead of five decorative category chips. The chips pretended
 * to be a filter that did not exist; now the filter is real, a little further
 * down, so repeating them here only confused. The numbers say the same thing
 * the old description did, except they show the scale instead of describing it.
 */
export function Hero({ unread, sources }: { unread: number; sources: number }) {
  const facts = [
    formatSourceCount(sources),
    // Matches the cron in `.github/workflows/ingest.yml` (ADR-0002).
    "sprawdzane co 2 dni",
    "trafność 1–5",
  ];

  return (
    <header className="relative -mx-6 -mt-12 overflow-hidden px-6 pt-12 pb-8">
      {/* The beams stay, but confined to the banner — as a background for the
          whole page they would fight with the scrolling list. */}
      <BackgroundBeams className="pointer-events-none" />

      <div className="relative z-10 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            {unread > 0 && <Badge>{unread} nowych</Badge>}
          </div>
          {/* "O aplikacji" as a header link rather than a card at the bottom of
              the list (Stage 5): as a card it looked identical to an item, and
              the more content the app had, the harder it was to reach. */}
          <div className="flex shrink-0 items-center gap-2">
            {/* The source list is also where a mute is undone (migration 008),
                so it needs a way in that does not depend on the inbox — a muted
                source has no card left to click. */}
            <Link
              href="/sources"
              className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
            >
              <Rss className="size-4" aria-hidden />
              <span className="hidden sm:inline">Źródła</span>
            </Link>
            <Link
              href="/about"
              className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
            >
              <Info className="size-4" aria-hidden />
              <span className="hidden sm:inline">O aplikacji</span>
            </Link>
            {/* Notification settings moved out of the inbox in Phase 11 — the
                gear is the whole of their discoverability, so it sits next to
                the theme toggle, where a settings control is looked for. Icon
                only, even on a wide screen: a fourth label would push the row
                into the logo. */}
            <Link
              href="/settings"
              aria-label="Ustawienia"
              className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
            >
              <Settings className="size-4" aria-hidden />
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xl font-medium text-balance">
            Twój puls ekosystemu JavaScriptu.
          </p>
          {/* The robot marks the one sentence that says who does the work.
              Whoever opens the app should know within a second that the
              summaries below were written by an agent and not by an editor —
              it changes how they are read, and it is the app's single most
              distinctive claim. In the brand colour, because the agent is the
              product; on the cards the same icon stays grey, where it is a
              provenance mark rather than a headline. */}
          <p className="text-muted-foreground flex max-w-prose items-start gap-2">
            <Bot className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="text-balance">
              Agent AI czyta źródła, odsiewa szum i streszcza po polsku to, co
              faktycznie dotyczy Twojego stacku.
            </span>
          </p>
        </div>

        <ul className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {facts.map((fact, index) => (
            <li key={fact} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden>·</span>}
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
