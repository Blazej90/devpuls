import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BellOff } from "lucide-react";

import { Logo } from "@/components/logo";
import { MuteButton } from "@/components/source-mute";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/date-groups";
import { listSourceStats, type SourceStat } from "@/lib/sources";

export const metadata: Metadata = { title: "Źródła" };

/** The counts and the mute state are read live — this page is also the undo. */
export const dynamic = "force-dynamic";

/** "1 wpis", "3 wpisy", "11 wpisów" — Polish plural inflection. */
function formatItems(count: number): string {
  if (count === 1) return "1 wpis";
  const units = count % 10;
  const teens = count % 100;
  const fewForm = units >= 2 && units <= 4 && (teens < 12 || teens > 14);
  return `${count} ${fewForm ? "wpisy" : "wpisów"}`;
}

function SourceRow({ source }: { source: SourceStat }) {
  const muted = source.mutedAt !== null;
  const since = formatDate(source.mutedAt);

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{source.name}</p>
        <p className="text-muted-foreground text-xs">
          {formatItems(source.items)}
          {source.unread > 0 && ` · ${source.unread} nieprzeczytanych`}
          {muted && since && ` · wyciszone od ${since}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* A muted source has nothing to show in the inbox, so the shortcut
            would lead to an empty list. */}
        {!muted && source.items > 0 && (
          <Link
            href={`/?view=all&source=${source.id}`}
            className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          >
            W skrzynce
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}

        <MuteButton
          id={source.id}
          name={source.name}
          muted={muted}
          variant={muted ? "outline" : "ghost"}
        />
      </div>
    </li>
  );
}

/**
 * The source list, and the only way back from a mute (migration 008).
 *
 * A subpage rather than a section above the inbox: eleven rows with counts and
 * a button each would push the news itself below the fold, and this is a screen
 * one visits a few times a year. It is `/sources` for the same reason `/about`
 * exists — settings do not compete with content for the same space.
 */
export default async function SourcesPage() {
  const sources = await listSourceStats();
  const active = sources.filter((source) => source.mutedAt === null);
  const muted = sources.filter((source) => source.mutedAt !== null);

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
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Źródła</h1>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            Wyciszone źródło znika ze skrzynki, z liczników i z powiadomień, a agent
            przestaje je pobierać — nie płacisz za streszczanie czegoś, czego nie
            chcesz czytać. Nic nie jest kasowane: przywrócenie oddaje zebrane
            wcześniej wpisy. Nie wraca tylko sam okres ciszy, bo w tym czasie nic
            nie było pobierane, a kanały RSS trzymają jedynie ostatnie wpisy.
          </p>
        </div>

        <section className="space-y-1">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Aktywne
          </h2>
          {active.length === 0 ? (
            <p className="text-muted-foreground py-3 text-sm">
              Wszystkie źródła są wyciszone — skrzynka nie dostanie nic nowego.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {active.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </ul>
          )}
        </section>

        {muted.length > 0 && (
          <>
            <Separator />
            <section className="space-y-1">
              <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <BellOff className="size-3.5" aria-hidden />
                Wyciszone
              </h2>
              <ul className="divide-border divide-y opacity-70">
                {muted.map((source) => (
                  <SourceRow key={source.id} source={source} />
                ))}
              </ul>
            </section>
          </>
        )}
      </article>
    </main>
  );
}
