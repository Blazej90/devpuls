# ADR-0003: Przebudowa UX skrzynki — segregacja, usuwanie, motyw

**Status:** Accepted
**Data:** 2026-08-21

## Kontekst

Po Fazie 9 appka działa, ale interfejs jest surowy: jedna płaska lista kart,
która rośnie z każdym przebiegiem agenta. Przy cronie co 2 dni i kilkunastu
wpisach na przebieg po miesiącu jest to kilkaset kart do przewinięcia, bez
sposobu na zawężenie widoku i bez sposobu na pozbycie się tego, co nieciekawe.

Przy okazji przeglądu wyszły cztery rzeczy, które są **usterkami**, a nie
kwestią estetyki — i to one wyznaczają kolejność prac.

### 1. Sortowanie „od najnowszych" nie sortuje po dacie artykułu

`listUnread()` sortuje po `items.created_at`, czyli po momencie zapisu przez
agenta. W obrębie jednego przebiegu wszystkie wpisy dostają praktycznie ten sam
znacznik czasu, więc faktyczną kolejnością jest kolejność odpytywania źródeł.
Tygodniowy wpis z Reddita potrafi wylądować nad dzisiejszym z bloga Verceli.

Poprawka to `ORDER BY COALESCE(published_at, created_at) DESC`. `COALESCE`,
bo część źródeł nie podaje daty publikacji (`NormalizedItem.publishedAt` jest
nullowalne) — dla nich moment zapisu jest najlepszym przybliżeniem.

### 2. Dark mode istnieje w CSS, ale jest nieosiągalny

`app/globals.css` ma kompletny blok `.dark` z pełną paletą tokenów, ale **nic
w kodzie nigdy nie dodaje klasy `.dark`** do dokumentu. Cały ten blok to martwy
kod, a `dark:` w klasach Tailwinda (np. w `run-status.tsx`) nigdy się nie
uruchamia. Appka jest wyłącznie jasna.

Osobno: `manifest.json` deklaruje `theme_color` i `background_color` jako
`#0a0a0a`. Splash przy starcie zainstalowanej PWA jest więc czarny, po czym
appka renderuje się na biało — przy każdym otwarciu widać mrugnięcie.

### 3. Usuwanie wpisów zderza się z deduplikacją

`items.url` ma UNIQUE i to **jedyny** mechanizm chroniący przed ponownym
pobraniem tego samego artykułu (`ON CONFLICT (url) DO NOTHING` w `insertItem`).
Twarde `DELETE` sprawiłby, że usunięty wpis wróci przy najbliższym przebiegu —
i to razem z powiadomieniem, bo `notified_at` też by zniknęło. Usunięcie
czegokolwiek z aktywnego feedu byłoby więc odwracane co dwa dni.

### 4. Chipy tematów w hero wyglądają na filtry, a nic nie robią

`TypeScript / React / JavaScript / Fullstack / AI` pod nagłówkiem to `Badge`
bez żadnej obsługi kliknięcia. Wyglądają dokładnie jak kontrolka filtrowania,
którą appce brakuje.

## Rozważane opcje

### Oś segregacji skrzynki

1. **Data jako kręgosłup + tematy jako filtr** — sekcje „Dziś / Wczoraj /
   W tym tygodniu / Starsze", nad nimi chipy zawężające widok.
2. **Zakładki po temacie** — pięć osobnych list, data w drugim planie.
3. **Po trafności** — „Must-read / Warte uwagi / Reszta".
4. **Zwijane grupy po źródle** — Hacker News, Reddit, Anthropic News…

### Usuwanie

1. **Twarde `DELETE`** — wiersz znika z bazy.
2. **Miękkie `deleted_at`** — wiersz zostaje, znika z widoku i z zapytań.

### Pasek z automatycznie przewijanymi newsami

1. Pełny ticker z animacją.
2. Statyczna sekcja „Najświeższe", przewijana ręcznie.
3. Rezygnacja.

## Decyzja

**Segregacja: data jako kręgosłup, tematy jako filtr** (opcja 1). Skrzynka
odbiorcza ma model mentalny poczty, a nie katalogu — pierwsze pytanie brzmi „co
nowego", nie „co z Reacta". Podział po temacie rozbiłby dwanaście wpisów na
pięć list po dwa-trzy, gubiąc wrażenie świeżości. Tematy zostają jako zawężenie
widoku, przy okazji nadając sens chipom, które i tak już są w hero. Nad
wszystkim trzy zakładki: **Nowe / Przeczytane / Wszystkie**.

Stan filtra i zakładki idzie do **URL** (`?widok=nowe&temat=ai`), nie do stanu
komponentu — dzięki temu działa przycisk wstecz, odświeżenie nie gubi kontekstu
i da się wysłać sobie link na drugie urządzenie.

**Usuwanie: miękkie, kolumna `items.deleted_at`** (opcja 2). Wymusza to punkt 3
kontekstu — URL musi zostać w tabeli, żeby deduplikacja dalej działała.
Z perspektywy użytkownika jest to nieodróżnialne od twardego usunięcia, a daje
za darmo „Cofnij" bezpośrednio po akcji.

**Oznaczanie jako przeczytane przestaje być efektem ubocznym otwarcia linku.**
Dotąd kliknięcie tytułu odhaczało wpis — wygodne, ale odbiera kontrolę: otwarcie
artykułu w nowej karcie, żeby przeczytać go później, wyrzucało go ze skrzynki.
Odhaczenie staje się jawnym gestem: przycisk na karcie (wyeksponowany, nie ghost
w stopce), „Oznacz grupę" przy nagłówku sekcji, albo zaznaczenie wielu wpisów
i akcja zbiorcza.

**Zaznaczanie wielu wpisów** obsługuje jednocześnie oznaczanie i usuwanie — to
ta sama mechanika (checkbox na karcie, pasek akcji na dole), więc powstaje raz.

**Pasek z przewijanymi newsami: rezygnacja** (opcja 3). W skrzynce sortowanej od
najnowszych pasek pokazywałby dokładnie tę samą treść, co pierwsze trzy karty
pod nim. Element poruszający się sam wymaga kontrolki pauzy (WCAG 2.2.2
Pause, Stop, Hide), a na telefonie zjada pionową przestrzeń, której w widoku
listy jest najmniej. Decyzja odwracalna — jeśli okaże się, że skrzynka jest
za statyczna, wracamy do opcji 2.

**Motyw: `next-themes`** z trzema stanami (system / jasny / ciemny), klasa na
`<html>`, skrypt ustawiający ją przed hydratacją. Ręczne rozwiązanie na
`useState` dawałoby mrugnięcie białym tłem przy każdym wejściu w trybie ciemnym.

**Ikony: SVG jako źródło prawdy, PNG eksportowane z niego.** Wyłącznie SVG nie
przejdzie — `apple-touch-icon` na iOS-ie musi być PNG-iem, a to jest platforma,
na której appka jest faktycznie zainstalowana. Maskowalna ikona w manifeście też
zostaje PNG-iem ze względu na wsparcie. SVG trafia do favicony i do interfejsu.

## Konsekwencje

- **Migracja 005** dokłada `items.deleted_at`, indeks pod nową kolejność
  (`COALESCE(published_at, created_at) DESC`) i przebudowuje częściowy indeks
  skrzynki o warunek `deleted_at IS NULL`.
- **Każde zapytanie o wpisy musi od teraz filtrować `deleted_at IS NULL`.**
  To jest ten rodzaj warunku, o którym się zapomina przy dopisywaniu kolejnego
  zapytania — dlatego cała selekcja zostaje w `lib/items.ts`, a nowe widoki
  budujemy z jego funkcji, nie z surowego SQL-a w route handlerach.
- Miękkie usuwanie oznacza, że tabela `items` rośnie w nieskończoność. Przy
  kilkunastu wpisach co dwa dni to kilka tysięcy wierszy rocznie — dla Neona
  nieistotne. Gdyby kiedyś przeszkadzało, czyszczenie musi zostawiać sam URL
  (np. osobna tabela `seen_urls`), inaczej wróci problem z deduplikacją.
- Dochodzą zależności: `next-themes` oraz komponenty shadcn `tabs`, `checkbox`,
  `dropdown-menu`, `sonner`, `separator`, `skeleton`. Wszystkie w stylu
  `new-york`, zgodnie z `components.json`.
- Stan w URL wymusza, żeby strona główna czytała `searchParams`. Zostaje
  `force-dynamic`, więc nic nie tracimy na cache'u.
- Skrzynka nadal nie ma paginacji (`listUnread` ma twardy limit 100,
  `listRead` 30). Segregacja po dacie odsuwa problem, ale go nie usuwa —
  doładowywanie starszych wpisów zostaje jako dług do spłacenia.
- Sekcja „O aplikacji" z linkami do GitHuba, portfolio i LinkedIna wprowadza do
  repo dane osobowe autora. Repo jest publiczne — to świadoma decyzja, nie
  przeoczenie.
