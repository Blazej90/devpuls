import { BackgroundBeams } from "@/components/ui/background-beams";
import { Badge } from "@/components/ui/badge";
import { InstallHint } from "@/components/pwa/install-hint";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TOPICS = ["TypeScript", "React", "JavaScript", "Fullstack", "AI"] as const;

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden">
      <BackgroundBeams className="pointer-events-none" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
        <header className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">DevPuls</h1>
          <p className="text-muted-foreground text-balance">
            Nowinki techniczne przefiltrowane pod kątem trafności i streszczone po
            polsku, prosto na Twój ekran — z linkiem do oryginalnego źródła.
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <Badge key={topic} variant="secondary">
                {topic}
              </Badge>
            ))}
          </div>
        </header>

        <InstallHint />

        <Card>
          <CardHeader>
            <CardTitle>Powiadomienia jeszcze nie działają</CardTitle>
            <CardDescription>
              Agent zbiera już wpisy i streszcza je po polsku. Brakuje zapisu
              subskrypcji Web Push — to Faza 5.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
