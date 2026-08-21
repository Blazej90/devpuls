"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, ExternalLink, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatujDate, pogrupuj } from "@/lib/grupowanie";
import { ETYKIETY_TEMATOW, type NewsItem, type Temat, type Widok } from "@/lib/items";

/** Obie trasy zapisu zwracają aktualny licznik nieprzeczytanych. */
async function wyslij(
  sciezka: "/api/items/read" | "/api/items/delete",
  body: unknown,
): Promise<number> {
  const response = await fetch(sciezka, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  // Rzucamy zamiast zwracać null: optymistyczny UI już ukrył kartę, więc cicha
  // porażka wygląda jak sukces. Tak właśnie przez chwilę wyglądał błąd
  // z bigintami — zapis nie przechodził, a interfejs nic nie mówił.
  if (!response.ok) throw new Error(`Zapis nieudany (HTTP ${response.status})`);

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
  przeczytany,
  zaznaczony,
  onZaznacz,
  onPrzeczytaj,
  onUsun,
}: {
  item: NewsItem;
  przeczytany: boolean;
  zaznaczony: boolean;
  onZaznacz: (id: number, zaznaczony: boolean) => void;
  onPrzeczytaj: (id: number) => void;
  onUsun: (id: number) => void;
}) {
  const data = formatujDate(item.publishedAt);

  return (
    <Card className={cn("transition-opacity", przeczytany && "opacity-60")}>
      <CardHeader className="gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={zaznaczony}
            onCheckedChange={(stan) => onZaznacz(item.id, stan === true)}
            aria-label={`Zaznacz: ${item.title}`}
            className="mt-1 shrink-0"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {item.relevance !== null && (
                <Badge variant={item.relevance >= 5 ? "default" : "secondary"}>
                  Trafność {item.relevance}
                </Badge>
              )}
              {item.topics?.map((topic) => (
                <Badge key={topic} variant="outline">
                  {ETYKIETY_TEMATOW[topic as Temat] ?? topic}
                </Badge>
              ))}
            </div>

            <CardTitle className="text-base leading-snug">
              {/*
                Otwarcie linku NIE oznacza już wpisu jako przeczytanego
                (ADR-0003). Wcześniej robiło to za użytkownika, więc otwarcie
                artykułu w nowej karcie "na później" wyrzucało go ze skrzynki.
              */}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 hover:underline"
              >
                {item.title}
                <ExternalLink className="mt-1 size-3.5 shrink-0 opacity-60" aria-hidden />
              </a>
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {item.summaryPl && (
          <p className="text-muted-foreground text-sm leading-relaxed">{item.summaryPl}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            {item.sourceName}
            {data && ` · ${data}`}
          </p>

          <div className="flex items-center gap-2">
            {przeczytany ? (
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Check className="size-3.5" aria-hidden />
                Przeczytane
              </span>
            ) : (
              /* `outline`, nie `ghost`: dotąd przycisk ginął w stopce i jedyną
                 widoczną akcją było "Oznacz wszystkie". */
              <Button variant="outline" size="sm" onClick={() => onPrzeczytaj(item.id)}>
                <Check className="size-4" aria-hidden />
                Przeczytane
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUsun(item.id)}
              aria-label={`Usuń: ${item.title}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PUSTE: Record<Widok, string> = {
  nowe: "Skrzynka pusta. Agent sprawdza źródła co dwa dni — nowe wpisy pojawią się tutaj.",
  przeczytane: "Nic jeszcze nie zostało odhaczone.",
  wszystkie: "Brak wpisów. Po pierwszym przebiegu agenta pojawią się tutaj.",
};

export function Inbox({
  wpisy,
  widok,
  dzisiaj,
}: {
  wpisy: NewsItem[];
  widok: Widok;
  /** Dzień kalendarzowy ustalony przez serwer — patrz `lib/grupowanie.ts`. */
  dzisiaj: string;
}) {
  const router = useRouter();
  const [usuniete, setUsuniete] = useState<Set<number>>(new Set());
  const [przeczytane, setPrzeczytane] = useState<Set<number>>(new Set());
  const [zaznaczone, setZaznaczone] = useState<Set<number>>(new Set());
  const [blad, setBlad] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const odswiez = () => startTransition(() => router.refresh());

  const czyPrzeczytany = (item: NewsItem) =>
    item.readAt !== null || przeczytane.has(item.id);

  const widoczne = useMemo(
    () =>
      wpisy.filter((item) => {
        if (usuniete.has(item.id)) return false;
        // W zakładce "Nowe" odhaczony wpis znika od razu; w pozostałych zostaje
        // i tylko zmienia wygląd — inaczej karta uciekałaby spod kursora.
        if (widok === "nowe" && przeczytane.has(item.id)) return false;
        return true;
      }),
    [wpisy, usuniete, przeczytane, widok],
  );

  const grupy = useMemo(() => pogrupuj(widoczne, dzisiaj), [widoczne, dzisiaj]);
  const zaznaczoneWidoczne = widoczne.filter((item) => zaznaczone.has(item.id));

  const przelaczZaznaczenie = (id: number, wybrany: boolean) => {
    setZaznaczone((biezace) => {
      const nowe = new Set(biezace);
      if (wybrany) nowe.add(id);
      else nowe.delete(id);
      return nowe;
    });
  };

  const odznaczWszystko = () => setZaznaczone(new Set());

  function oznaczJako(ids: number[]) {
    if (ids.length === 0) return;
    const poprzednie = przeczytane;

    setPrzeczytane((biezace) => new Set([...biezace, ...ids]));
    setBlad(null);
    odznaczWszystko();

    void wyslij("/api/items/read", { ids })
      .then((liczba) => {
        ustawBadge(liczba);
        odswiez();
      })
      .catch((error: unknown) => {
        console.error("[skrzynka] oznaczenie nieudane", error);
        setBlad("Nie udało się zapisać. Wpisy wróciły na miejsce.");
        setPrzeczytane(poprzednie);
      });
  }

  function cofnijUsuniecie(ids: number[]) {
    void wyslij("/api/items/delete", { ids, przywroc: true })
      .then((liczba) => {
        ustawBadge(liczba);
        setUsuniete((biezace) => {
          const nowe = new Set(biezace);
          for (const id of ids) nowe.delete(id);
          return nowe;
        });
        odswiez();
      })
      .catch((error: unknown) => {
        console.error("[skrzynka] cofnięcie nieudane", error);
        toast.error("Nie udało się cofnąć usunięcia.");
      });
  }

  function usun(ids: number[]) {
    if (ids.length === 0) return;
    const poprzednie = usuniete;

    setUsuniete((biezace) => new Set([...biezace, ...ids]));
    setBlad(null);
    odznaczWszystko();

    void wyslij("/api/items/delete", { ids })
      .then((liczba) => {
        ustawBadge(liczba);
        odswiez();

        // Usuwanie jest miękkie (ADR-0003), więc cofnięcie to zwykły zapis,
        // a nie odtwarzanie czegoś, czego już nie ma.
        toast(ids.length === 1 ? "Wpis usunięty" : `Usunięto wpisy: ${ids.length}`, {
          action: { label: "Cofnij", onClick: () => cofnijUsuniecie(ids) },
        });
      })
      .catch((error: unknown) => {
        console.error("[skrzynka] usunięcie nieudane", error);
        setBlad("Nie udało się usunąć. Wpisy wróciły na miejsce.");
        setUsuniete(poprzednie);
      });
  }

  return (
    <div className="space-y-8">
      {blad && (
        <p className="text-destructive text-sm" role="alert">
          {blad}
        </p>
      )}

      {widoczne.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            {PUSTE[widok]}
          </CardContent>
        </Card>
      ) : (
        grupy.map((grupa) => {
          const nieodhaczone = grupa.wpisy.filter((item) => !czyPrzeczytany(item));

          return (
            <section key={grupa.kubelek} className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {grupa.etykieta}
                  <span className="ml-2 tabular-nums opacity-70">{grupa.wpisy.length}</span>
                </h2>

                {nieodhaczone.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground text-xs"
                    onClick={() => oznaczJako(nieodhaczone.map((item) => item.id))}
                  >
                    <CheckCheck className="size-3.5" aria-hidden />
                    Oznacz grupę
                  </Button>
                )}
              </div>

              <ol className="space-y-4">
                {grupa.wpisy.map((item) => (
                  <li key={item.id}>
                    <ItemCard
                      item={item}
                      przeczytany={czyPrzeczytany(item)}
                      zaznaczony={zaznaczone.has(item.id)}
                      onZaznacz={przelaczZaznaczenie}
                      onPrzeczytaj={(id) => oznaczJako([id])}
                      onUsun={(id) => usun([id])}
                    />
                  </li>
                ))}
              </ol>
            </section>
          );
        })
      )}

      {/* Pasek akcji zbiorczych — pojawia się dopiero, gdy coś jest zaznaczone.
          `fixed`, nie `sticky`: na telefonie ma być w zasięgu kciuka niezależnie
          od tego, jak daleko użytkownik przewinął. */}
      {zaznaczoneWidoczne.length > 0 && (
        <div
          role="region"
          aria-label="Akcje dla zaznaczonych"
          className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
        >
          <div className="bg-popover text-popover-foreground border-border flex items-center gap-2 rounded-lg border p-2 shadow-lg">
            <span className="px-2 text-sm tabular-nums">
              Zaznaczone: {zaznaczoneWidoczne.length}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                oznaczJako(
                  zaznaczoneWidoczne
                    .filter((item) => !czyPrzeczytany(item))
                    .map((item) => item.id),
                )
              }
            >
              <Check className="size-4" aria-hidden />
              Przeczytane
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => usun(zaznaczoneWidoczne.map((item) => item.id))}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              Usuń
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={odznaczWszystko}
              aria-label="Odznacz wszystkie"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
