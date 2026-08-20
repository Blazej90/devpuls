import { BackgroundBeams } from "@/components/ui/background-beams";
import { Badge } from "@/components/ui/badge";
import { InstallHint } from "@/components/pwa/install-hint";
import { PushSettings } from "@/components/pwa/push-settings";
import { PushToggle } from "@/components/pwa/push-toggle";
import { Inbox } from "@/components/inbox";
import { countUnread, listRead, listUnread } from "@/lib/items";

const TOPICS = ["TypeScript", "React", "JavaScript", "Fullstack", "AI"] as const;

/** Skrzynka czyta bazę przy każdym wejściu — po powiadomieniu ma być aktualna. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [nieprzeczytane, przeczytane, liczba] = await Promise.all([
    listUnread(),
    listRead(),
    countUnread(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      {/* Beams zostają, ale zamknięte w banerze — jako tło całej strony biłyby
          się z przewijaną listą. */}
      <header className="relative -mx-6 -mt-12 overflow-hidden px-6 pt-12 pb-8">
        <BackgroundBeams className="pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight">DevPuls</h1>
            {liczba > 0 && <Badge>{liczba} nowych</Badge>}
          </div>
          <p className="text-muted-foreground text-balance">
            Nowinki techniczne przefiltrowane pod kątem trafności i streszczone po
            polsku, z linkiem do oryginalnego źródła.
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <Badge key={topic} variant="secondary">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <InstallHint />
      <PushToggle />
      <PushSettings />

      <Inbox nieprzeczytane={nieprzeczytane} przeczytane={przeczytane} />
    </main>
  );
}
