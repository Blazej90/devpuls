"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/items";

/** Etykiety kategorii zwracanych przez `packages/agent/src/claude.ts`. */
const TOPIC_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  react: "React",
  javascript: "JavaScript",
  fullstack: "Fullstack",
  ai: "AI",
  inne: "Inne",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" }).format(date);
}

async function oznacz(body: { ids: number[] } | { all: true }): Promise<number> {
  const response = await fetch("/api/items/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  // Rzucamy zamiast zwracać null: optymistyczny UI już ukrył kartę, więc cicha
  // porażka wygląda jak sukces. Tak właśnie przez chwilę wyglądał błąd
  // z bigintami — zapis nie przechodził, a interfejs nic nie mówił.
  if (!response.ok) {
    throw new Error(`Zapis nieudany (HTTP ${response.status})`);
  }

  const dane = (await response.json()) as { nieprzeczytane: number };
  return dane.nieprzeczytane;
}

/** Badge z liczbą na ikonie PWA — działa w zainstalowanej appce. */
function ustawBadge(liczba: number): void {
  if (!("setAppBadge" in navigator)) return;
  if (liczba > 0) void navigator.setAppBadge(liczba);
  else void navigator.clearAppBadge();
}

function ItemCard({
  item,
  onRead,
}: {
  item: NewsItem;
  onRead: (id: number) => void;
}) {
  const date = formatDate(item.publishedAt);
  const przeczytany = item.readAt !== null;

  return (
    <Card className={cn("transition-colors", przeczytany && "opacity-60")}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {item.relevance !== null && (
            <Badge variant={item.relevance >= 5 ? "default" : "secondary"}>
              Trafność {item.relevance}
            </Badge>
          )}
          {item.topics?.map((topic) => (
            <Badge key={topic} variant="outline">
              {TOPIC_LABELS[topic] ?? topic}
            </Badge>
          ))}
        </div>

        <CardTitle className="text-base leading-snug">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            // Otwarcie artykułu = przeczytanie. Nie zmuszamy do osobnego kliknięcia.
            onClick={() => onRead(item.id)}
            className="inline-flex items-start gap-1.5 hover:underline"
          >
            {item.title}
            <ExternalLink className="mt-1 size-3.5 shrink-0 opacity-60" aria-hidden />
          </a>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {item.summaryPl && (
          <p className="text-muted-foreground text-sm leading-relaxed">{item.summaryPl}</p>
        )}
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-xs">
            {item.sourceName}
            {date && ` · ${date}`}
          </p>
          {!przeczytany && (
            <Button variant="ghost" size="sm" onClick={() => onRead(item.id)}>
              Przeczytane
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function Inbox({
  nieprzeczytane,
  przeczytane,
}: {
  nieprzeczytane: NewsItem[];
  przeczytane: NewsItem[];
}) {
  const router = useRouter();
  const [odczytane, setOdczytane] = useState<Set<number>>(new Set());
  const [blad, setBlad] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const doPokazania = nieprzeczytane.filter((item) => !odczytane.has(item.id));

  const oznaczJeden = (id: number) => {
    // Optymistycznie: karta znika od razu, zapis leci w tle.
    setOdczytane((biezace) => new Set(biezace).add(id));
    setBlad(null);

    void oznacz({ ids: [id] })
      .then(ustawBadge)
      .catch((error: unknown) => {
        console.error("[skrzynka] oznaczenie nieudane", error);
        setBlad("Nie udało się zapisać. Karta wróci po odświeżeniu.");
        // Cofamy optymistyczne ukrycie — stan w bazie się nie zmienił.
        setOdczytane((biezace) => {
          const nowe = new Set(biezace);
          nowe.delete(id);
          return nowe;
        });
      });
  };

  const oznaczWszystkie = () => {
    const poprzednie = odczytane;
    setOdczytane(new Set(nieprzeczytane.map((item) => item.id)));
    setBlad(null);

    void oznacz({ all: true })
      .then((liczba) => {
        ustawBadge(liczba);
        startTransition(() => router.refresh());
      })
      .catch((error: unknown) => {
        console.error("[skrzynka] oznaczenie nieudane", error);
        setBlad("Nie udało się zapisać. Spróbuj ponownie.");
        setOdczytane(poprzednie);
      });
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">
            Nowe{doPokazania.length > 0 && ` (${doPokazania.length})`}
          </h2>
          {doPokazania.length > 0 && (
            <Button variant="outline" size="sm" onClick={oznaczWszystkie} disabled={pending}>
              <CheckCheck className="size-4" aria-hidden />
              Oznacz wszystkie
            </Button>
          )}
        </div>

        {blad && <p className="text-destructive text-sm">{blad}</p>}

        {doPokazania.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Skrzynka pusta. Agent sprawdza źródła co dwa dni — nowe wpisy pojawią się tutaj.
            </CardContent>
          </Card>
        ) : (
          <ol className="space-y-4">
            {doPokazania.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} onRead={oznaczJeden} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {przeczytane.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-muted-foreground text-sm font-medium">Przeczytane</h2>
          <ol className="space-y-4">
            {przeczytane.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} onRead={oznaczJeden} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
