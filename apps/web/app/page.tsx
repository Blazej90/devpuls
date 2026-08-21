import { Hero } from "@/components/hero";
import { InstallHint } from "@/components/pwa/install-hint";
import { PushSettings } from "@/components/pwa/push-settings";
import { PushToggle } from "@/components/pwa/push-toggle";
import { DoGory } from "@/components/do-gory";
import { Inbox } from "@/components/inbox";
import { RunStatus } from "@/components/run-status";
import { Paginacja, SkrzynkaNawigacja } from "@/components/skrzynka-filtry";
import { dzienKalendarzowy } from "@/lib/grupowanie";
import {
  countSources,
  countUnread,
  liczniki,
  listItems,
  parseStrona,
  parseTemat,
  parseWidok,
} from "@/lib/items";
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
  const strona = parseStrona(params.strona);

  const [{ wpisy, jestWiecej }, liczby, nieprzeczytane, zrodel, ostatniPrzebieg] =
    await Promise.all([
      listItems({ widok, temat }, strona),
      liczniki(temat),
      countUnread(),
      countSources(),
      getLastRunSafe(),
    ]);

  // Dzień ustalamy raz, po stronie serwera, i przekazujemy w dół — inaczej
  // podział na "Dziś"/"Wczoraj" mógłby wypaść inaczej na serwerze niż
  // w przeglądarce (szczegóły w `lib/grupowanie.ts`).
  const dzisiaj = dzienKalendarzowy(new Date());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <Hero nieprzeczytane={nieprzeczytane} zrodel={zrodel} />

      <RunStatus run={ostatniPrzebieg} />

      <InstallHint />
      <PushToggle />
      <PushSettings />

      <SkrzynkaNawigacja widok={widok} temat={temat} liczniki={liczby} />

      <Inbox wpisy={wpisy} widok={widok} dzisiaj={dzisiaj} />

      <Paginacja
        widok={widok}
        temat={temat}
        strona={strona}
        jestWiecej={jestWiecej}
        pokazano={wpisy.length}
        wszystkich={liczby[widok]}
      />

      <DoGory />
    </main>
  );
}
