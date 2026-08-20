"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TOPICS = [
  { id: "typescript", label: "TypeScript" },
  { id: "react", label: "React" },
  { id: "javascript", label: "JavaScript" },
  { id: "fullstack", label: "Fullstack" },
  { id: "ai", label: "AI" },
  { id: "inne", label: "Inne" },
] as const;

const PROGI = [2, 3, 4, 5] as const;

/**
 * Ustawienia są zapisane przy subskrypcji, nie w localStorage — to agent
 * podejmuje decyzję o wysyłce i musi je widzieć po swojej stronie.
 * Komponent pokazuje się dopiero, gdy subskrypcja istnieje.
 */
export function PushSettings() {
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [minRelevance, setMinRelevance] = useState(4);
  const [topics, setTopics] = useState<string[]>([]);
  const [zapisywanie, setZapisywanie] = useState(false);
  const [zapisano, setZapisano] = useState(false);

  /**
   * Lustro stanu w refach. Dwa kliknięcia w tym samym ticku Reacta czytałyby
   * ten sam, nieodświeżony stan z domknięcia i drugie nadpisywałoby pierwsze
   * (zaobserwowane: zaznaczenie kategorii gubiło poprzednią). Ref widzi
   * zawsze bieżącą wartość.
   */
  const progRef = useRef(4);
  const topicsRef = useRef<string[]>([]);

  /**
   * Kolejka zapisów. Kolejność dotarcia żądań HTTP nie jest gwarantowana —
   * przy zimnym starcie Neona pierwszy PATCH potrafi dojść po drugim
   * i nadpisać nowszy stan starszym. Łańcuch promise'ów wysyła je po kolei.
   */
  const kolejka = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let anulowane = false;

    const wczytaj = async () => {
      if (!("serviceWorker" in navigator)) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription || anulowane) return;

      const response = await fetch("/api/push/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      if (!response.ok || anulowane) return;

      const dane = (await response.json()) as {
        minRelevance: number;
        topics: string[] | null;
      };

      if (anulowane) return;
      progRef.current = dane.minRelevance;
      topicsRef.current = dane.topics ?? [];
      setEndpoint(subscription.endpoint);
      setMinRelevance(dane.minRelevance);
      setTopics(dane.topics ?? []);
    };

    void wczytaj();
    return () => {
      anulowane = true;
    };
  }, []);

  const zapisz = useCallback(
    (nowyProg: number, noweTopics: string[]) => {
      if (!endpoint) return;

      setZapisywanie(true);
      setZapisano(false);

      kolejka.current = kolejka.current.then(async () => {
        try {
          const response = await fetch("/api/push/settings", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              endpoint,
              minRelevance: nowyProg,
              // Pusta lista = brak filtra, tak samo interpretuje to endpoint.
              topics: noweTopics.length > 0 ? noweTopics : null,
            }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          setZapisano(true);
        } catch (error: unknown) {
          console.error("[ustawienia] zapis nieudany", error);
        } finally {
          setZapisywanie(false);
        }
      });
    },
    [endpoint],
  );

  const ustawProg = (prog: number) => {
    progRef.current = prog;
    setMinRelevance(prog);
    zapisz(prog, topicsRef.current);
  };

  const przelaczTemat = (id: string) => {
    const biezace = topicsRef.current;
    const nowe = biezace.includes(id)
      ? biezace.filter((topic) => topic !== id)
      : [...biezace, id];

    topicsRef.current = nowe;
    setTopics(nowe);
    zapisz(progRef.current, nowe);
  };

  if (!endpoint) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ustawienia powiadomień</CardTitle>
        <CardDescription>
          Zmiany działają od najbliższego przebiegu agenta — nic nie trzeba
          wdrażać na nowo.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Minimalna trafność</p>
          <div className="flex flex-wrap gap-2">
            {PROGI.map((prog) => (
              <Button
                key={prog}
                size="sm"
                variant={minRelevance === prog ? "default" : "outline"}
                onClick={() => ustawProg(prog)}
              >
                {prog}+
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            5 to tylko przełomowe rzeczy, 2 przepuszcza prawie wszystko.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Kategorie</p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => {
              const wybrany = topics.includes(topic.id);
              return (
                <Button
                  key={topic.id}
                  size="sm"
                  variant={wybrany ? "default" : "outline"}
                  onClick={() => przelaczTemat(topic.id)}
                >
                  {wybrany && <Check className="size-3.5" aria-hidden />}
                  {topic.label}
                </Button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            {topics.length === 0
              ? "Nic nie zaznaczone = wszystkie kategorie."
              : `Powiadomienia tylko z ${topics.length} wybranych kategorii.`}
          </p>
        </div>

        <p
          className={cn(
            "text-xs transition-opacity",
            zapisywanie || zapisano ? "opacity-100" : "opacity-0",
          )}
        >
          {zapisywanie ? "Zapisuję…" : "Zapisano."}
        </p>
      </CardContent>
    </Card>
  );
}
