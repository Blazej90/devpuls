import { BackgroundBeams } from "@/components/ui/background-beams";
import { Badge } from "@/components/ui/badge";
import { InstallHint } from "@/components/pwa/install-hint";
import { PushSettings } from "@/components/pwa/push-settings";
import { PushToggle } from "@/components/pwa/push-toggle";
import { NewsList } from "@/components/news-list";
import { listRecentItems } from "@/lib/items";

const TOPICS = ["TypeScript", "React", "JavaScript", "Fullstack", "AI"] as const;

/** Lista czyta bazę przy każdym wejściu — nowe wpisy mają być od razu widoczne. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const items = await listRecentItems();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      {/* Beams zostają, ale zamknięte w banerze — jako tło całej strony biłyby
          się z przewijaną listą. */}
      <header className="relative -mx-6 -mt-12 overflow-hidden px-6 pt-12 pb-8">
        <BackgroundBeams className="pointer-events-none" />
        <div className="relative z-10 space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">DevPuls</h1>
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

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Ostatnie wpisy</h2>
        <NewsList items={items} />
      </section>
    </main>
  );
}
