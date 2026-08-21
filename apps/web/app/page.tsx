import { BackgroundBeams } from "@/components/ui/background-beams";
import { Badge } from "@/components/ui/badge";
import { InstallHint } from "@/components/pwa/install-hint";
import { PushSettings } from "@/components/pwa/push-settings";
import { PushToggle } from "@/components/pwa/push-toggle";
import { Inbox } from "@/components/inbox";
import { RunStatus } from "@/components/run-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { TematyFiltr, WidokTabs } from "@/components/skrzynka-filtry";
import { dzienKalendarzowy } from "@/lib/grupowanie";
import { countUnread, liczniki, listItems, parseTemat, parseWidok } from "@/lib/items";
import { getLastRunSafe } from "@/lib/runs";

/** Skrzynka czyta bazę przy każdym wejściu — po powiadomieniu ma być aktualna. */
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const widok = parseWidok(params.widok);
  const temat = parseTemat(params.temat);

  const [wpisy, liczby, nieprzeczytane, ostatniPrzebieg] = await Promise.all([
    listItems({ widok, temat }),
    liczniki(temat),
    countUnread(),
    getLastRunSafe(),
  ]);

  // Dzień ustalamy raz, po stronie serwera, i przekazujemy w dół — inaczej
  // podział na "Dziś"/"Wczoraj" mógłby wypaść inaczej na serwerze niż
  // w przeglądarce (szczegóły w `lib/grupowanie.ts`).
  const dzisiaj = dzienKalendarzowy(new Date());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      {/* Beams zostają, ale zamknięte w banerze — jako tło całej strony biłyby
          się z przewijaną listą. */}
      <header className="relative -mx-6 -mt-12 overflow-hidden px-6 pt-12 pb-8">
        <BackgroundBeams className="pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight">DevPuls</h1>
              {nieprzeczytane > 0 && <Badge>{nieprzeczytane} nowych</Badge>}
            </div>
            <ThemeToggle />
          </div>
          <p className="text-muted-foreground text-balance">
            Nowinki techniczne przefiltrowane pod kątem trafności i streszczone po
            polsku, z linkiem do oryginalnego źródła.
          </p>
        </div>
      </header>

      <RunStatus run={ostatniPrzebieg} />

      <InstallHint />
      <PushToggle />
      <PushSettings />

      <div className="space-y-4">
        <WidokTabs widok={widok} temat={temat} liczniki={liczby} />
        <TematyFiltr widok={widok} temat={temat} />
      </div>

      <Inbox wpisy={wpisy} widok={widok} dzisiaj={dzisiaj} />
    </main>
  );
}
