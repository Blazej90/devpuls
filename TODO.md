# TODO — DevPuls

Legenda: `[ ]` do zrobienia, `[~]` w trakcie, `[x]` zrobione.
Agent aktualizuje ten plik na bieżąco, ale nigdy go nie commituje bez zgody
(patrz `CLAUDE.md`, zasada 1).

## Faza 0 — Fundament projektu
- [x] Inicjalizacja monorepo (`pnpm-workspace.yaml`, root `package.json`)
- [x] Next.js app w `apps/web` (TypeScript, App Router) — strony/layout + ESLint flat config
- [x] Konfiguracja Tailwind CSS v4 (`postcss.config.mjs`, `app/globals.css`)
- [x] Konfiguracja aliasów `@/*` (`tsconfig.json`) + `components.json` dla shadcn
- [x] Konfiguracja shadcn/ui + Aceternity UI — button, card, badge (shadcn) + background-beams (Aceternity)
- [x] Szkielet `packages/agent` (src/sources, pipeline.ts, claude.ts, push.ts, db.ts)
- [x] Pierwsze ADR zaakceptowane (0001 — PWA + Web Push)

## Faza 1 — PWA shell
- [x] `manifest.json` + ikony (192/512 + apple-touch-icon, generowane zastępczo)
- [x] Service worker (obsługa push + podstawowy cache) — `public/sw.js`
- [x] Prompt instalacji appki / instrukcja "Dodaj do ekranu głównego" na iOS — `components/pwa/install-hint.tsx`

## Faza 2 — Baza danych
- [ ] Projekt Neon + connection string w `.env` — do zrobienia po stronie użytkownika
      (console.neon.tech), agent nie ma jak założyć konta
- [x] Migracja: tabele `sources`, `items`, `push_subscriptions` — `packages/agent/sql/001_init.sql`
      + runner `pnpm agent:migrate` (idempotentny, rejestr w `schema_migrations`).
      Zastosowanie na żywej bazie czeka na `DATABASE_URL`.

## Faza 3 — Ingestion (RSS/Atom)
- [x] Fetcher RSS/Atom (`packages/agent/src/sources/rss.ts`, `atom.ts`) — wspólny `http.ts` z retry na 429/5xx
- [x] Wczytywanie `sources.json`
- [x] Deduplikacja po URL wpisu — UNIQUE + jedno zapytanie na przebieg

## Faza 4 — Claude: filtr trafności + streszczenie PL
- [x] Prompt oceniający trafność (1-5) względem profilu zainteresowań
- [x] Prompt generujący streszczenie PL + zachowanie linku źródłowego
- [x] Konfigurowalny próg trafności (`RELEVANCE_THRESHOLD`)

## Faza 5 — Web Push
- [x] Wygenerowanie kluczy VAPID — w `.env` (agent) i `apps/web/.env.local` (przeglądarka)
- [x] Endpoint `POST /api/push/subscribe` + `DELETE` (upsert po `endpoint`, walidacja zod)
- [x] Wysyłka push z `packages/agent` (biblioteka `web-push`)

## Faza 6 — Harmonogram
- [x] `.github/workflows/ingest.yml` (cron co 3h) — przebieg #3 zakończony sukcesem w 4m12s
- [x] Sekrety w GitHub Actions (Claude API key, connection string Neon, klucze VAPID)

## Faza 7 — UI
- [x] Lista dostarczonych newsów w appce — `components/news-list.tsx`, trafność + kategorie + źródło
- [x] Ustawienia (próg trafności, wybór kategorii) — per subskrypcja w bazie, respektowane przez agenta

## Faza 8 — Dopracowanie
- [x] Obsługa źródeł bez RSS (np. Anthropic News) przez scraping + Claude — `src/sources/scrape.ts`
- [x] Monitoring błędów pipeline'u — tabela `runs` (migracja 004), `src/monitor.ts`,
      pasek stanu w appce, `GET /api/health` i adnotacje w GitHub Actions

## Faza 9 — Digest i skrzynka odbiorcza (ADR-0002)
- [x] Cron co 2 dni zamiast co 3h
- [x] Jedno powiadomienie zbiorcze na przebieg zamiast jednego na wpis
- [x] `items.read_at` + skrzynka odbiorcza z sekcją „Nowe" i archiwum
- [x] Badge z liczbą nieprzeczytanych na ikonie PWA
- [x] Włączyć workflow z powrotem w GitHub Actions

## Faza 10 — Przebudowa UX/UI (ADR-0003)

### Etap 1 — fundament danych
- [x] Migracja 005: `items.deleted_at`, indeksy `items_unread_idx` i `items_recency_idx`
      pod `COALESCE(published_at, created_at) DESC` z warunkiem `deleted_at IS NULL`
- [x] `lib/items.ts`: sortowanie po dacie publikacji, filtr `deleted_at IS NULL`,
      `listItems` / `counts` pod zakładki i filtr tematu, zapisy (`markRead`,
      `markAllRead`, `softDelete`, `restore`) w tym samym module
- [x] `POST /api/items/delete` — miękkie usuwanie `{ids}` + cofnięcie `{restore:true}`
- [x] `POST /api/items/read` — `{ids}` obsługuje grupę i zaznaczenie wielu;
      `{all:true}` zawężone opcjonalnym `temat`
- [x] Normalizacja TIMESTAMPTZ do ISO — sterownik Neona zwraca `Date`, nie string
      (dotyczyło też `lib/runs.ts`)

### Etap 2 — motyw jasny/ciemny
- [x] `next-themes` + `components/theme-provider.tsx`, klasa na `<html>`,
      skrypt ustawiający ją przed pierwszym malowaniem
- [x] Przełącznik trójstanowy system / jasny / ciemny — `components/theme-toggle.tsx`
      na shadcn `toggle-group`; aktywny segment na `primary`, bo domyślne `accent`
      daje w trybie jasnym kontrast 1,08:1 (nie widać, co jest wybrane)
- [x] `manifest.json`: `theme_color`/`background_color` z `#0a0a0a` na `#ffffff` —
      splash był czarny, a appka renderowała się na biało
- [x] Kolor splash-a przeniesiony na barwę marki w Etapie 4 — patrz niżej

### Etap 3 — skrzynka
- [x] Zakładki Nowe / Przeczytane / Wszystkie z licznikami, stan w URL (`?view=`).
      Zwykłe linki, nie shadcn `tabs` — każda zakładka to inne zapytanie do bazy,
      a Radix przełącza panele po stronie klienta
- [x] Chipy tematów jako działający filtr, stan w URL (`?topic=`); zakładka i filtr
      wzajemnie się zachowują
- [x] Grupowanie po dacie: Dziś / Wczoraj / W tym tygodniu / Starsze —
      `lib/date-groups.ts`, strefa przypięta do Europe/Warsaw
- [x] Karta: `outline` zamiast `ghost` przy „Przeczytane”; **otwarcie linku już nie
      oznacza wpisu**
- [x] „Oznacz grupę” przy nagłówku sekcji, widoczne tylko gdy grupa ma nieodhaczone
- [x] Checkboxy na kartach + pasek akcji zbiorczych (`fixed`, w zasięgu kciuka)
- [x] Usuwanie pojedyncze i zbiorcze + toast „Cofnij” (shadcn `sonner`)

### Etap 4 — treść i tożsamość
- [x] Hero — claim + pasek faktów; liczba źródeł czytana z bazy, nie wpisana w tekst
- [x] Logo: znak pulsu w wektorze (`components/logo.tsx`) + wordmark jako tekst
- [x] Barwa marki jako tokeny `--brand` (dwa odcienie, bo jeden nie przechodzi
      kontrastu w obu motywach) — domyka otwarty punkt z Etapu 2
- [x] Ikony PWA wygenerowane z wektora: 192/512 „any”, 512 maskable (znak w strefie
      bezpiecznej), 180 `apple-touch-icon` bez własnego zaokrąglenia
- [x] Favicon `app/icon.svg`; `metadata.icons` deklaruje oba jawnie, bo samo
      zadeklarowanie `icons` wyłącza konwencję plikową Next.js
- [x] Splash PWA na `#0A0A0A` — zgodny z tłem ikony, więc znak wtapia się w splash
      zamiast zależeć od wybranego motywu
- [x] Sekcja „O aplikacji” z notą © i linkami: GitHub, portfolio, LinkedIn.
      Adres LinkedIna zapisany procentowo (polskie znaki w ścieżce), rok liczony
      przy renderze, więc nota nie zestarzeje się 1 stycznia

### Etap 5 — dopracowanie skrzynki
- [x] „O aplikacji” jako podstrona `/about` + link w nagłówku. Jako karta na
      dole listy wyglądała identycznie jak wpis i im więcej appka miała treści,
      tym trudniej było do niej dotrzeć
- [x] Przycisk „na górę” przy długim przewijaniu — `components/scroll-to-top.tsx`,
      `useSyncExternalStore` na pozycji przewinięcia, respektuje `prefers-reduced-motion`
- [x] Odznaczanie z powrotem jako nieprzeczytane — do tej pory stan był
      jednokierunkowy i pomyłkę dało się cofnąć tylko przez bazę
- [x] Ulubione: migracja 006 (`items.starred_at`), gwiazdka na karcie, zakładka
      „Ulubione”, `POST /api/items/star`
- [x] Poprawka nawigacji: wskaźnik aktywnej zakładki w barwie marki (wcześniej
      `primary` siadał na kresce rozdzielającej i czytało się to jak jedna linia),
      liczniki jako pigułki, odstęp do chipów, przewijanie w poziomie na telefonie

### Odrzucone
- [x] ~~Pasek z automatycznie przewijanymi newsami~~ — powielałby pierwsze karty
      skrzynki, wymaga kontrolki pauzy (WCAG 2.2.2) i zjada przestrzeń na telefonie
      (ADR-0003)

### Dług
- [x] Paginacja skrzynki — 30 wpisów na stronę, `?page=` w URL-u.
      Klasyczne strony przez OFFSET, nie doładowywanie rosnącym limitem:
      archiwum rośnie bez górnej granicy, a tak rozmiar odpowiedzi zostaje stały
      niezależnie od tego, jak głęboko sięgamy. Zmiana zakładki albo kategorii
      resetuje stronę

## Faza 11 — Usprawnienia z użytkowania

- [x] Wyszukiwarka wpisów — fraza jako trzeci filtr w URL-u (`?q=`), obok `?view=`
      i `?topic=`. Szuka po tytule i streszczeniu PL, słowa łączone przez AND
      („react server” znajdzie też „serwery w React”).
      - Zwykłe `ILIKE`, bez `tsvector` i bez migracji: konfiguracja `polish` w
        Postgresie wymaga słowników ispell po stronie serwera, których Neon nie
        daje, a `simple` nie robi stemmingu, więc „Reacta” nie znalazłoby
        „React” — dopasowanie po podciągu radzi sobie z odmianą lepiej. Przy
        przebiegu co 2 dni tabela to kilkaset wierszy, indeks nic by nie dał.
      - Fraza zawęża aktywną zakładkę, nic nie przełącza się samo. Liczniki przy
        zakładkach liczą się z frazą, więc od razu widać, gdzie są trafienia.
      - Pole na żywo (debounce 300 ms, `router.replace` ze `scroll: false`),
        Enter stosuje od razu, Esc czyści. Trafienia podświetlone w tytule
        i streszczeniu (`components/highlight.tsx`, bez `dangerouslySetInnerHTML`).
      - Znane ograniczenie: polskie znaki bez `unaccent` — „nastepny” nie znajdzie
        „następny”. Do rozważenia, jeśli zacznie przeszkadzać.
      - Znane ograniczenie: krótkie tokeny łapią środek słów (`ai` → „chain”,
        „trained”). Poprawka na granicę słowa dla tokenów < 3 znaków, jeśli zaboli.
- [x] Filtr po źródle — `?source=` jako czwarty wymiar obok `view`, `topic` i `q`.
      Włączany klikiem w nazwę źródła na karcie, wyłączany usuwalnym chipem nad
      listą; przy aktywnym filtrze nazwa na karcie przestaje być linkiem.
      - Nazwa źródła świadomie **nie** wchodzi do frazy `?q=`. Sprawdzone na
        danych: „news” daje dziś 0 trafień w treści, a z nazwami źródeł dałoby 21
        wpisów (Hacker News + OpenAI News + Anthropic News) — ćwierć skrzynki;
        „blog” 29 z 89. Nazwy źródeł to generyczne rzeczowniki, więc fraza
        zaczęłaby znaczyć „skąd”, a nie „o czym”, i to tylko przy części słów.
      - Bez własnego rzędu chipów: 10 źródeł o nazwach długości „TypeScript -
        GitHub Releases” nie mieści się na telefonie i konkurowałoby z kategoriami.
      - `listSources()` pytane tylko wtedy, gdy filtr jest aktywny — służy
        wyłącznie do podpisania chipa nazwą zamiast identyfikatorem.
- [x] Wyciszanie źródła (ADR-0004, migracja 008 — **zastosowana na żywej bazie**)
      - `sources.muted_at`; agent pomija wyciszone źródło w całości (bez fetcha,
        bez Claude, bez zapisu), appka chowa też wpisy zebrane wcześniej.
        Nic nie jest kasowane — przywrócenie oddaje je w całości.
      - Warunek `MUTED_EXCLUDED` w `buildConditions` + w `countUnread`,
        `markAllRead` i `countSources`, żeby lista, liczniki zakładek i badge PWA
        nie mogły się rozjechać.
      - Wejście: przycisk „Wycisz” przy chipie aktywnego źródła w skrzynce.
        Wyjście: podstrona `/sources` (lista z licznikami, link w nagłówku) —
        wyciszone źródło nie zostawia w skrzynce karty do kliknięcia.
      - `POST /api/sources/mute` zwraca `unread`, tak jak trasy wpisów;
        `setBadge` wyjęte z `inbox.tsx` do `lib/badge.ts`, bo używają go teraz dwa
        komponenty.
      - Niesprawdzone na żywo: pominięcie źródła w agencie. Weryfikacja przy
        najbliższym przebiegu — w logu ma się pojawić `[id] muted — skipped`.
- [x] Odświeżanie skrzynki — gest „pull to refresh" na telefonie i przycisk
      „Odśwież" w pasku stanu przebiegu.
      - **Odświeżenie = ponowny odczyt bazy, nie uruchomienie agenta.** Wpisy
        pojawiają się wyłącznie po przebiegu (co 2 dni, ADR-0002), a każdy
        przebieg to płatne wywołanie Claude per wpis — gest, który da się
        wywołać przypadkiem, nie może wydawać pieniędzy. Dlatego komunikat
        „Brak nowych wpisów" jest tu równie ważny jak sam spinner: bez niego
        gest wyglądałby na zepsuty za każdym razem, gdy zadziała poprawnie.
      - Punkt odniesienia to `MAX(items.id)` z renderu serwera — `items.id` to
        rosnący BIGINT, więc jedna liczba opisuje „to, co przeglądarka już
        widziała". Bez migracji i bez porównywania zegara bazy z zegarem
        telefonu. `GET /api/items/updates?since=` zwraca `{ added, unread }`.
      - `added` liczy się **bez** aktywnych filtrów (zakładka, kategoria,
        źródło, fraza) — pytanie brzmi „czy agent coś przyniósł", a nie „czy
        przyniósł coś pasującego do mojego widoku". Stąd akcja „Pokaż"
        w toaście: nowe wpisy mogą leżeć poza bieżącym widokiem.
      - Gest tylko od samej góry strony (widok hero). Niżej ruch palcem w dół
        znaczy „przewiń w górę" i przejęcie go sprawiłoby, że strona wydaje się
        zablokowana. Poziomy ruch (pasek zakładek) też nie wchodzi.
      - Napisany ręcznie, bez biblioteki: całość to trzy handlery `touch*`,
        a alternatywa dokłada zależność z własnym spinerem, własnym motywem
        i własnym zdaniem o kontenerze scrolla. Wskaźnik przesuwany zapisem do
        DOM-u, nie stanem Reacta — inaczej byłby rerender na każdy piksel.
      - Nierozłączna para: `overscroll-behavior-y: contain` na `body`
        w `globals.css`. Bez tego Chrome na Androidzie odpala **swoje**
        pull-to-refresh na tym samym geście i przeładowuje stronę pod spodem.
      - Przycisk siedzi przy zdaniu „Sprawdzono 2 dni temu…", bo to ono jest
        powodem, żeby go nacisnąć — i bo na desktopie, gdzie gestu nie ma, jest
        jedyną drogą do tej akcji.
      - Niesprawdzone na żywo: sam gest (brak urządzenia dotykowego w sesji).
        Zweryfikowane: trasa `/api/items/updates` (`since=0` → 89, `since`
        powyżej maksimum → 0, brak/śmieć → 400), render przycisku, reguła
        `overscroll-behavior-y` w zbudowanym CSS-ie.
      - Komunikat „Brak nowych wpisów" podaje datę najbliższego przebiegu
        (`lib/schedule.ts`), bo sam brak nowości czyta się jak usterka.
        Harmonogram jest zdublowany z `.github/workflows/ingest.yml` — appka nie
        ma jak przeczytać workflow w runtime, więc **zmiana crona to zmiana
        w dwóch miejscach**. Krok 2 w polu dnia miesiąca to dni nieparzyste
        (1, 3, 5 … 31), a nie „co 48 godzin": licznik startuje od nowa z każdym
        miesiącem, więc po 31. wypada 1. i dwa przebiegi lądują dzień po dniu.
        Godzina liczona w `Europe/Warsaw` (ta sama przypięta strefa co
        w `date-groups.ts`), więc 07:00 UTC to 9:00 latem i 8:00 zimą.
        Sprawdzone na 7 przypadkach: dzień parzysty, nieparzysty przed i po
        7:00 UTC, przełom miesiąca 31→1, luty 27→1 marca, zima i noc zmiany
        czasu. „Zaplanowany" w treści niesie jedyne zastrzeżenie, jakie ma
        znaczenie — GitHub czasem opóźnia albo pomija slot.
      - Ta sama data w pasku `RunStatus`, pod „Sprawdzono … temu": jedna linijka
        mówi, jak stare jest to, co widać, druga — kiedy przestanie być.
        Nie pokazuje się przy `stale` (brak przebiegu od ponad 3 dni), bo
        nagłówek mówi wtedy, że harmonogram wygląda na zepsuty, i data pod nim
        przeczyłaby temu w tym samym zdaniu. Render po stronie serwera jest
        bezpieczny wyłącznie dzięki przypiętej strefie z `date-groups.ts` —
        czytana ze środowiska pokazałaby godzinę Vercela (UTC).
- [x] Ustawienia powiadomień pod kołem zębatym — podstrona `/settings`, ikona
      w nagłówku obok przełącznika motywu.
      - Powód: próg trafności i kategorie stały nad skrzynką i **zapisywały się
        przy każdym kliknięciu**. Jedno przypadkowe stuknięcie po cichu zmieniało
        to, co agent wyśle, a potwierdzeniem było słowo, które samo znikało.
      - Nowy model: dwa stany. **Zablokowany** — wszystkie przyciski wyboru
        nieaktywne (`<fieldset disabled>`), pod spodem podsumowanie wyboru
        i przycisk „Zmień". **Edycja** — przyciski aktywne, kończy ją „Zapisz"
        (jeden PATCH) albo „Anuluj" (szkic wraca do zapisanego stanu). Po
        zapisie toast z podsumowaniem: „Trafność 4+ · React, AI".
      - Zapis nieudany zostawia formularz otwarty ze szkicem — nieudany zapis
        nie może wyglądać jak udany, a karą nie może być wpisywanie wyboru
        od nowa.
      - Przy okazji zniknęły dwie obejścia, których stary wariant potrzebował:
        stan dublowany w refach (dwa kliknięcia w jednym ticku Reacta czytały ten
        sam nieaktualny domknięcie i drugie nadpisywało pierwsze) oraz kolejka
        obietnic serializująca zapisy (przy zimnym starcie Neona pierwszy PATCH
        potrafił dolecieć po drugim). Szkic edytowany przez funkcyjne `setState`
        zawsze widzi aktualną wartość, a jeden zapis na kliknięcie nie ma się
        z czym ścigać.
      - Na ekranie głównym zostaje jedna linijka „Włącz powiadomienia o nowych
        wpisach" z linkiem do ustawień — i tylko wtedy, gdy powiadomienia są
        wyłączone. Bez tego kto nie kliknie w zębatkę, nigdy nie włączyłby tego,
        po co ta appka powstała. Stany `unsupported` i `blocked` świadomie nie
        dostają linijki: żadnego z nich nie da się rozwiązać stuknięciem w tej
        appce, więc wyjaśnienie zostaje przy samym przełączniku.
      - `usePushStatus()` wyjęte z `push-toggle.tsx` do `pwa/push-status.ts`, bo
        dwa komponenty pytają teraz „czy to urządzenie jest zasubskrybowane"
        i dwie kopie tej samej logiki prędzej czy później by się rozjechały.
      - Niesprawdzone na żywo: cykl „Zmień → Zapisz" (wymaga urządzenia
        z włączoną subskrypcją push). Zweryfikowane: `/settings` renderuje się
        (200), karty ustawień zniknęły z ekranu głównego, zębatka linkuje.
- [x] Pasek zakładek skrzynki przewija się wyłącznie w poziomie.
      - Objaw: na telefonie pasek „Nowe / Ulubione / Przeczytane / Wszystkie"
        dawał się ciągnąć palcem w górę i w dół, zamiast tylko na boki.
      - Przyczyna: samo `overflow-x: auto` robi z pudełka kontener przewijania
        na **obu** osiach — CSS zamienia drugie `visible` na `auto`. Zakładki
        miały `-mb-px` (wystawały piksel poniżej `ul`, żeby wskaźnik nakrył
        kreskę), więc pionowy zakres przewijania wynosił dokładnie ten 1 px.
        Na iOS wystarczy, żeby gest złapał pasek i rozciągnął go gumką znacznie
        dalej niż o piksel.
      - Poprawka: `overflow-y: hidden` na pasku, a kreska przeniesiona z `ul`
        na `nav` — przy `overflow-y: hidden` wskaźnik wystający poza `ul` nie
        byłby już przewijalny, tylko **przycięty**. Teraz to `ul` wchodzi
        pikselem na kreskę `nav` (`-mb-px`), a obramowanie rodzica maluje się
        przed dziećmi, więc aktywna zakładka nadal je zakrywa. Wygląd bez zmian.
      - `overscroll-x-contain` zatrzymuje rzut w bok wewnątrz paska, zamiast
        oddawać go gestowi „wstecz" przeglądarki.
      - Pionowe przewijanie strony palcem startującym na pasku działa dalej:
        pudełko przestaje być przewijalne w pionie, więc gest trafia do
        najbliższego przewijalnego przodka, czyli do strony.
      - Niesprawdzone na żywo: sam gest (brak urządzenia dotykowego w sesji).
        Zweryfikowane: `tsc`, `eslint`, render `/` (200) z nowymi klasami.
- [x] Ikona w pustej skrzynce — karta „nie ma nic nowego" dostaje symbol.
      - Powód: sam szary tekst na pustej karcie czyta się jak błąd wczytywania.
        Ikona mówi „taki jest stan", zanim ktokolwiek przeczyta zdanie.
      - Ikona zależy od powodu pustki, bo są cztery różne: pusta skrzynka
        (`Inbox`, zakładki „Nowe" i „Wszystkie"), brak gwiazdek (`Star`), nic
        odhaczonego (`CheckCheck`), a przy włączonym filtrze — przekreślona
        lupa (`SearchX`) albo lejek (`FilterX`). Przekreślony filtr mówi „to
        twoje kryteria", a nie „to twoja skrzynka" — dokładnie to samo
        rozróżnienie, które od początku robią tam komunikaty.
      - Ikona i komunikat wybierane w jednym miejscu (`EMPTY_STATES` + jedno
        wyrażenie nad `return`), żeby nie dało się ich rozjechać.
      - `aria-hidden` i cienka kreska (`strokeWidth={1.5}`, `opacity-30`):
        ikona powtarza zdanie pod sobą, a przy pełnej wadze 40 px przekrzyczałaby
        listę, którą zastępuje.
      - Zweryfikowane na żywo: `?q=` bez trafień → `lucide-search-x`,
        `?source=` nieistniejące → `lucide-filter-x`. Warianty zakładek nie
        pokazały się, bo w bazie każda z czterech ma wpisy — to ta sama ścieżka
        kodu, różni się tylko stała z ikoną.
- [x] Ikona robota — widać, że nad artykułami pracuje agent AI.
      - Dwa miejsca, bo mówią dwie różne rzeczy.
      - **Nagłówek**: robot w kolorze marki przy zdaniu „Agent AI czyta źródła,
        odsiewa szum i streszcza po polsku…". Kto otwiera appkę, ma w sekundę
        wiedzieć, że streszczenia poniżej pisze agent, a nie redakcja — to
        zmienia sposób, w jaki się je czyta, i jest najbardziej wyróżniającą
        cechą tej appki. Samo zdanie zyskało „AI" wprost.
      - **Karta wpisu**: ten sam robot, szary, przy streszczeniu. Streszczenie
        to jedyny tekst na karcie, który napisała appka — tytuł i link pochodzą
        ze źródła. Ikona zaznacza tę granicę, żeby maszynowa parafraza nie
        została wzięta za słowa autora.
      - `aria-hidden` na ikonie i `sr-only` „Streszczenie agenta AI:" przed
        tekstem — czytnik ekranu nie zobaczy piktogramu, a to jest informacja,
        nie ozdoba. Dla myszy `title` na opakowaniu ikony.
      - Zweryfikowane na żywo: `/` renderuje 1 robota `text-brand`
        w nagłówku i po jednym szarym na każdą z 8 kart w zakładce „Nowe".
- [x] Licznik nieprzeczytanych jako klikalna pigułka pod nagłówkiem.
      - Problem: `Badge` „8 nowych" stał obok logotypu i na telefonie musiał
        zmieścić się w jednym rzędzie z napisem `text-4xl` i czterema
        kontrolkami. Rząd kończył się szerokość, a badge lądował, gdzie akurat
        było miejsce.
      - Teraz osobny wiersz pod hasłem, na całą szerokość: pigułka w kolorze
        marki, kropka nieprzeczytanych (ten sam sygnał, co w każdym kliencie
        poczty), liczba i strzałka w dół.
      - Klikalna: prowadzi do `/#inbox`, czyli do paska zakładek nad listą.
        Adres z ukośnikiem, a nie samo `#inbox`, bo licznik ignoruje filtry —
        z odfiltrowanego widoku albo ze strony czwartej sama kotwica
        przewinęłaby do listy, w której nie ma tego, co policzono. `/` gubi
        query string i ląduje na czystej zakładce „Nowe".
      - Kotwica celuje w zakładki, nie w pierwszą kartę: to zakładka potwierdza,
        że skok się udał — „Nowe 8" to ta sama liczba, w którą się kliknęło.
      - Przy okazji `lib/plural.ts`: polska odmiana przez liczebnik była
        rozpisana osobno w nagłówku i w odświeżaniu, a nowa pigułka byłaby
        trzecią kopią. Reguła z wyjątkiem (12–14 zachowuje się jak grupa
        „wiele", mimo końcówki 2–4) w dwóch kopiach prędzej czy później by się
        rozjechała.
      - Zweryfikowane na żywo: pigułka renderuje się z `href="/#inbox"`
        i etykietą „8 nowych wpisów", `id="inbox"` jest na miejscu.
- [x] Reddit: HTTP 429 na dwóch z trzech feedów przy każdym przebiegu.
      - Objaw w pasku stanu: „Ostatni przebieg z zastrzeżeniami (2)",
        `reddit-reactjs` i `reddit-localllama` z HTTP 429. Oba zapisane
        przebiegi w tabeli `runs` wyglądały identycznie — to nie był pech,
        tylko stan stały.
      - Przyczyna: Reddit daje na nieuwierzytelnione `.rss` **jedno żądanie
        na okno ~40–60 s per IP**. Trzy feedy szły sekwencyjnie, ale bez pauzy,
        więc pierwszy z `sources.json` (`reddit-typescript`) zjadał cały
        budżet, a dwa kolejne dostawały 429 milisekundy później. Zawsze te same
        dwa, bo decydowała kolejność w configu.
      - Drugi błąd: Reddit **nie wysyła `Retry-After`**, tylko
        `x-ratelimit-reset`. Kod czytał wyłącznie ten pierwszy,
        `Number(null)` dawało 0, więc wpadał w backoff 1 s → 2 s. Trzy
        sekundy czekania przeciwko oknu minutowemu — pętla ponawiania była
        z góry skazana.
      - Odtworzone z domowego łącza (nie chodziło o IP runnera) i zmierzone
        sondą co 15 s: 200 o +15 s, 429 o +31 s i +46 s, 200 o +62 s, 429
        o +78 s i +93 s.
      - Naprawa w `sources/http.ts`: pauza brana **przed** następnym żądaniem
        do tego hosta, a nie odczekiwana po odmowie. Kluczowa obserwacja:
        `x-ratelimit-remaining: 0` i `x-ratelimit-reset` przychodzą także
        na **udanej** odpowiedzi, więc host sam mówi, ile czekać, zanim
        cokolwiek się zepsuje. Ponawianie zostaje dla tego, czego nie da się
        przewidzieć — 5xx i serwerów odmawiających bez wyjaśnienia.
      - Budżet czekania na źródło: 90 s. Przekroczenie kończy się błędem
        z własną treścią, a nie `break` — inaczej źródło raportowałoby się
        jako „HTTP 0", czyli status, którego serwer nigdy nie wysłał.
        Jeden feed nie może zatrzymać całego przebiegu.
      - Mapa `nextSlot` jest na poziomie modułu, żeby to, czego nauczy się
        pierwszy feed Reddita, chroniło dwa następne w tym samym przebiegu.
      - Zweryfikowane na żywo, prawdziwym żądaniem do Reddita: wszystkie trzy
        feedy pobrane, `+2s` typescript, `+20s` reactjs (pauza 17 s),
        `+80s` localllama (pauza 59 s). Koszt: ok. 80 s dłuższy przebieg
        raz na dwa dni — hosty idą równolegle, więc płaci tylko grupa Reddita.
- [x] `/sources` na telefonie: przyciski w jednej linii dla każdego wiersza.
      - Objaw: „TypeScript - GitHub Releases" ma dłuższą nazwę niż reszta, więc
        para „W skrzynce → Wycisz" łamała się pod tekst, podczas gdy przy
        krótszych nazwach zostawała obok. Żadne dwa wiersze nie były wyrównane.
      - Przyczyna: `flex-wrap` na wierszu — o złamaniu decydowała długość
        nazwy, czyli dane, a nie układ.
      - Poprawka: poniżej `sm` przyciski dostają własny wiersz **zawsze**,
        wyrównane do prawej; od `sm` w górę wracają obok tekstu jak dotąd.
        Dzięki temu prawa krawędź jest ta sama we wszystkich jedenastu
        wierszach — także tam, gdzie jest sam „Wycisz" bez „W skrzynce".
      - `-mr-2` ściąga własny padding ostatniego przycisku z krawędzi, żeby
        etykieta wypadała w jednej pionowej linii z tekstem nad nią.
      - Przy okazji czwarta kopia polskiej odmiany przez liczebnik
        (`formatItems`) zastąpiona przez `lib/plural.ts`.
      - Zweryfikowane na żywo: wszystkie 11 wierszy renderuje się z nowymi
        klasami, liczniki („20 wpisów", „10 wpisów") bez zmian.
      - Uwaga na przyszłość: `app/sources/page.tsx` ma końce linii CRLF,
        w odróżnieniu od komponentów w `components/`. Edycje przez skrypt
        muszą to uwzględniać.
- [x] Próg trafności rządzi także skrzynką, nie tylko powiadomieniami.
      - Objaw: przy zapisanym „Trafność 4+" do skrzynki dalej wpadały wpisy
        z trafnością 3.
      - Przyczyna: dwa niezależne progi. `push.ts` filtrował digest po
        `push_subscriptions.min_relevance` (w bazie wszystkie cztery
        subskrypcje miały 4 — ustawienie zapisywało się poprawnie), a lista
        miała własną, zaszytą na sztywno stałą `MIN_RELEVANCE = 3`
        w `lib/items.ts`. Karta ustawień wprost pisała „Nie dotyczą skrzynki".
      - Rozwiązanie: jeden wybór, dwa magazyny, bo czytelnicy są w dwóch
        światach. Ciasteczko `min-relevance` (odczyt na serwerze przez
        `lib/preferences.ts`) filtruje skrzynkę; kolumna w bazie zostaje dla
        agenta, który chodzi w GitHub Actions i przeglądarki nie widzi.
        Jedno „Zapisz" pisze w oba miejsca, więc nie mogą się rozjechać.
      - Ciasteczko, nie `localStorage`: strona renderuje się na serwerze, więc
        próg musi przyjechać **razem z żądaniem** — inaczej lista mrugałaby
        z jednego progu na drugi. Nie kolumna po urządzeniu, bo laptop bez
        powiadomień nie ma żadnego wiersza subskrypcji.
      - `lib/relevance.ts` (stałe, parsowanie, zapis ciasteczka) jest wolne od
        `next/headers`, bo importuje je komponent kliencki; odczyt requestu
        siedzi osobno w `lib/preferences.ts`. To samo dotyczy `lib/items.ts` —
        stąd próg wędruje tam argumentem, a nie odczytem z ciasteczka.
      - Przy okazji karta ustawień działa bez włączonych powiadomień: sekcja
        progu jest zawsze aktywna (zapisuje samo ciasteczko), sekcja kategorii
        pokazuje się tylko przy subskrypcji, bo zawęża wyłącznie digest.
        Wcześniej cała karta była zastąpiona komunikatem „ustawisz po włączeniu
        powiadomień".
      - Przy wczytaniu wygrywa baza i **nadpisuje** ciasteczko — to naprawia
        urządzenie, które wybrało próg, zanim skrzynka zaczęła go respektować.
      - Domyślna wartość bez ciasteczka to 4, tak samo jak DEFAULT kolumny
        z migracji 002 i `RELEVANCE_THRESHOLD` agenta.
      - Poziomy 2-5; 1 celowo nieosiągalne — agent daje 1 wpisom nie na temat,
        a lista bez żadnej podłogi to surowy feed, przed którym appka broni.
      - Świadomy kompromis: próg działa jednakowo we wszystkich zakładkach,
        więc oznaczona gwiazdką „trójka" znika z „Ulubionych" po podniesieniu
        progu do 4 (wraca po obniżeniu — nic nie jest kasowane). Wyjątek dla
        gwiazdki rozjechałby liczniki nad listą, które liczą się jednym
        zapytaniem.
      - `router.refresh()` po zapisie: strony serwerowe siedzą w cache routera
        ze starym progiem wpieczonym w HTML.
      - Zweryfikowane na żywo (dev, `?view=all`, karty na pierwszej stronie
        i liczniki zakładek):
        brak ciasteczka → same czwórki; `=2` → 2/3/4 (Wszystkie 191);
        `=3` → 3 i 4; `=4` → same czwórki (Wszystkie 76); `=5` → same piątki
        (Wszystkie 19); wartość spoza listy → domyślne 4.
        `/api/items/updates` i `/sources` liczą tym samym progiem
        (191 vs 19 wpisów).
      - Niezweryfikowane: sam zapis z karty ustawień w przeglądarce (wymaga
        aktywnej subskrypcji push i gestu na urządzeniu).
- [x] Sortowanie listy: „Najnowsze" / „Najtrafniejsze".
      - Powód: agent stawia 5 rzadko (19 wpisów na 239, ~8%) i prawie zawsze
        za duże wydania TypeScripta. Najnowsza piątka jest z 8 lipca 2026, więc
        przy sortowaniu po dacie i progu 3+ pierwsza z nich siedzi na pozycji
        96 (strona 4). Wyglądało to jak zjedzone piątki, a było zakopanie.
      - `sort=relevance` w URL, obok `view`, `topic`, `q`, `source` (ADR-0003):
        kolejność przeżywa odświeżenie i da się wysłać linkiem. Domyślne
        `recency` nie trafia do adresu, więc czysty adres to dalej `/`.
      - SQL: `relevance_score DESC NULLS LAST, recency DESC`. Drugi klucz jest
        obowiązkowy — przy pięćdziesięciu równych czwórkach kolejność bez niego
        zależy od planera, a granica strony przy OFFSET potrafiłaby się
        przesunąć między żądaniami.
      - Nagłówki sekcji idą za kolejnością: przy dacie „Dziś / Wczoraj /
        W tym tygodniu / Starsze", przy trafności „Trafność 5 / 4 / 3".
        Daty nad rankingiem rozsypałyby dokładnie ten porządek, który ranking
        ma pokazać — lipcowa piątka lądowałaby w „Starsze" pod trzema dniami
        czwórek. `groupByRelevance` siedzi w `lib/relevance.ts` obok progu,
        `Group.bucket` rozszerzone z `Bucket` na `string`.
      - Kontrolka: para pigułek w obramowaniu, wyrównana do prawej, jako
        ostatni wiersz nawigacji — tuż nad listą, na którą działa. Nie `select`:
        odpowiedzi są dwie, a natywny picker na telefonie otwiera pełnoekranowy
        arkusz dla wyboru na jedno tapnięcie.
      - Zweryfikowane na żywo (dev, próg 3+):
        `/?view=all` → karty w kolejności dat (3/4 przemieszane), sekcje
        „Wczoraj 20", „W tym tygodniu 10";
        `/?view=all&sort=relevance` → 19 piątek, potem czwórki, sekcje
        „Trafność 5 19", „Trafność 4 11";
        strona 2 kontynuuje na czwórkach;
        `/?sort=relevance` (zakładka Nowe) → jedyna nieprzeczytana piątka
        na pierwszej pozycji;
        `sort=nonsense` → cicho wraca do dat;
        zakładki, kategorie, paginacja i chip źródła niosą `sort` dalej.
- [x] Chipy kategorii i przełącznik sortowania w kolorach aplikacji.
      - Objaw: aktywny chip był `bg-primary` — prawie czarny w jasnym motywie
        i prawie biały w ciemnym. Najcięższy element na ekranie, a przy tym
        nieodróżnialny od dowolnej innej appki na shadcn.
      - Zamiast tego wypełnienie kolorem marki: `bg-brand text-brand-foreground`.
        Marka już oznacza wybór w tej appce (podkreślenie aktywnej zakładki
        i jej licznik), a token `--brand-foreground` istnieje właśnie po to, żeby
        koloru dało się użyć jako tła. Kontrast 4,9:1 w jasnym i 7,5:1
        w ciemnym — powyżej 4,5:1 wymaganego dla tekstu 12 px.
      - Hover nieaktywnego chipa to `hover:bg-brand/5` + `hover:border-brand/30`,
        czyli zapowiedź stanu aktywnego, a nie ogólne rozjaśnienie na szaro.
      - Sortowanie dostało kształt „tor + suwak" (jak zakładki w shadcn), a nie
        pigułkę chipa: przełącza kolejność tych samych wpisów, niczego nie
        odbiera, a dwie kontrolki o różnym działaniu nie powinny wyglądać
        identycznie. Suwak niesie markę wyłącznie w tekście — drugie pełne
        wypełnienie w tym samym bloku biłoby się o wzrok z aktywną kategorią.
      - Przy okazji `py-1` → `py-1.5` (cel dotykowy z ~24 px na ~28 px)
        i `whitespace-nowrap`, żeby „TypeScript" nie łamał się w połowie.
      - Zweryfikowane: wszystkie użyte klasy `brand` faktycznie trafiają do
        zbudowanego CSS (Tailwind grupuje selektory, więc `.bg-brand` siedzi
        w `.bg-brand,.bg-brand\/5`), render potwierdza klasy na aktywnym
        chipie i na aktywnej pigułce sortowania.
      - Niezweryfikowane wzrokowo: oba motywy na żywo — zmiana jest oparta
        na tokenach z `globals.css`, nie na dobranych ręcznie kolorach.
- [x] Sekcja „Co appka zapamiętuje" na /about zamiast banera o ciasteczkach.
      - Audyt tego, co faktycznie ląduje na urządzeniu: ciasteczko
        `min-relevance` (rok, `samesite=lax`, powstaje dopiero po kliknięciu
        „Zapisz"), motyw w `localStorage` przez `next-themes`, i tyle.
        Subskrypcja push siedzi w bazie, nie na urządzeniu. Zero analityki,
        zero skryptów spoza domeny — w `package.json` nie ma ani Vercel
        Analytics, ani Speed Insights, ani niczego third-party.
      - Dlatego bez banera: zgody wymaga zapis w urządzeniu **poza** tym, co
        niezbędne do usługi wyraźnie zażądanej przez użytkownika (ePrivacy
        art. 5(3), u nas Prawo komunikacji elektronicznej). Preferencja, która
        nie istnieje, dopóki użytkownik sam jej nie zapisze, to podręcznikowy
        przykład wyjątku. Baner postawiłby przed treścią pytanie bez
        odpowiedzi, a jego „Akceptuję" sugerowałoby, że jest co akceptować.
      - Notka mówi też, jak to skasować: wyłączenie powiadomień w ustawieniach
        kasuje wiersz subskrypcji po stronie serwera (`DELETE` w
        `api/push/subscribe`), a wyczyszczenie danych witryny — próg i motyw.
      - Komentarz przy sekcji zapisuje warunek ważności: przestaje obowiązywać
        w chwili, gdy w appce pojawi się cokolwiek third-party (analityka,
        osadzenie, font z cudzej domeny). Wtedy zgoda jest wymagana i to
        **przed** zapisem.
      - Zweryfikowane: sekcja renderuje się na `/about` w całości, `tsc`,
        `eslint` i `next build` czyste.
- [x] `README.md` — repo nie miało żadnego wejścia dla człowieka z zewnątrz.
      - Podział ról: README odpowiada „co to jest, jak odpalić, jak wdrożyć",
        `docs/ARCHITECTURE.md` zostaje przy „jak jest zbudowane i dlaczego".
        Bez powielania — README linkuje, nie streszcza.
      - Diagram przepływu w mermaidzie (GitHub renderuje natywnie): źródła →
        Actions → fetch → dedup po URL → Claude → Neon → push i skrzynka.
      - Sekcja „kilka decyzji, które warto znać przed czytaniem kodu" zamiast
        suchej listy funkcji: digest zamiast pusha na wpis, stan widoku w URL,
        całe SQL wpisów w jednym module, dwa magazyny progu trafności,
        wyciszanie globalne — każda z linkiem do właściwego ADR-a.
      - Zweryfikowane przed wpisaniem, a nie przepisane z pamięci: skrypty
        (`pnpm --filter web exec tsc --noEmit` i
        `pnpm --filter @devpuls/agent typecheck` faktycznie przechodzą),
        zachowanie `/api/health` (503 tylko dla `failed` i ciszy > 72 h),
        `syncSources` wołane w `pipeline.ts` przy każdym przebiegu,
        liczba i typy źródeł (11: 5 rss, 5 atom, 1 scrape), cron z workflow.
      - Fałszywy trop po drodze: rootowe `pnpm lint` zwracało
        `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL: Command "eslint" not found`
        i wylądowało w README jako udokumentowana usterka. Po sprawdzeniu przez
        `rtk proxy` okazało się, że komenda działa poprawnie (`Scope: 2 of 3`,
        `apps/web lint: Done`) — błąd produkowała warstwa RTK, nie repo. Notka
        z README usunięta. Wniosek na przyszłość: zanim opiszesz komendę jako
        zepsutą, sprawdź ją przez `rtk proxy`.
      - Rootowy skrypt mimo to doprecyzowany na `pnpm --recursive --if-present
        run lint`: jawne `run` nie może wpaść w ścieżkę `exec`, a `--if-present`
        pomija pakiet bez tego skryptu, gdyby doszedł kolejny.
- [x] `docs/ARCHITECTURE.md` zsynchronizowane z kodem.
      - Dokument został z Fazy 8-9 i w kilku miejscach opisywał appkę, której
        już nie ma: drzewo katalogów bez `/settings`, `/sources`, tras
        `items/updates` i `sources/mute`, bez siedmiu plików z `lib/`,
        bez migracji 008 i bez ADR-0004.
      - Zaktualizowane drzewo katalogów (razem z README) i lista migracji.
      - Sekcja 4: `pipeline.ts` pomija wyciszone źródła i grupuje po hoście;
        dopisany `sources/http.ts` jako jedyne miejsce wiedzące o limitach hosta.
      - Sekcja 5: akapit o Reddicie opisywał nieistniejące już ponawianie
        (3 próby, backoff 1s/2s, `Retry-After`). Zastąpiony opisem tego, co
        naprawdę robi kod — pauza brana przed żądaniem z nagłówków
        `x-ratelimit-*`, mapa `nextSlot` na poziomie modułu, budżet 90 s —
        razem z pomiarem sondy i kosztem ok. 80 s na przebieg.
      - Sekcja 5c: stan w adresie to teraz sześć parametrów (`view`, `topic`,
        `q`, `source`, `page`, `sort`), a sekcje listy idą za kolejnością —
        daty przy sortowaniu po dacie, „Trafność 5 / 4 / 3" przy trafności.
      - Nowa sekcja 5d: próg trafności, jeden wybór i dwa magazyny, z powodem
        podziału `lib/relevance.ts` / `lib/preferences.ts` (`next/headers`
        nie może trafić do bundla klienta).
      - Nowa sekcja 5e: wyciszanie źródeł, wyszukiwanie (dlaczego `ILIKE`,
        a nie `tsvector` na Neonie) i odświeżanie po `latestItemId`.
      - Sekcja 7: dopisana migracja 008 i zdanie o tym, że `min_relevance`
        nie jest już jedynym magazynem progu.
      - Każde nowe zdanie sprawdzone w kodzie, nie odtworzone z pamięci:
        grupowanie po hoście w `pipeline.ts`, treść migracji 008, komplet
        tras API i plików `lib/`, 11 źródeł w `sources.json` (5 rss, 5 atom,
        1 scrape) wraz z URL-ami zgodnymi z tabelą w sekcji 5.
- [x] Rozbudowa źródeł o nowoczesny fullstack: 11 → 24 źródła. Dołożone kanały
      oficjalne — Node.js (releases + blog), Bun, Next.js (releases + blog),
      React Router, Vite, Prisma, Drizzle ORM, Neon (blog + changelog), Vercel,
      Cloudflare. Wszystkie 13 URL-i sprawdzone na żywo: 200, poprawny element
      główny, niepusta lista wpisów.
      - `releases.atom` okazał się kanałem **tagów**, nie wydań. Zmierzone na
        dziesięciu wpisach: Next.js 8 canary / 2 stabilne, Prisma same
        `8.1.0-dev.N`, Vite miesza `v8.2.2` z `create-vite@9.2.0`, Bun dokłada
        tagi CI (`consolidation-step-7-green`). Bez filtra te cztery źródła
        zalałyby skrzynkę wpisami, których nikt nie ogłasza.
      - Nowe pole `titlePattern` w `sources.json` — **lista dopuszczeń, nie
        wykluczeń**, bo taki kształt ma problem: „jak wygląda wydanie" to zbiór
        skończony, „jak wygląda wszystko inne" nie jest i każda nowa konwencja
        upstreamu przeciekałaby przez blacklistę. Do tego `maxItems` jako limit
        per źródło, nadpisujący `MAX_ITEMS_PER_SOURCE`.
      - Filtr i limit przeniesione z fetcherów do `sources/index.ts`, w tej
        kolejności: najpierw filtr na całej stronie feeda, potem limit na tym,
        co zostało. Odwrotnie (a tak było, bo `rss.ts`/`atom.ts`/`scrape.ts`
        cięły same) można wziąć 15 canary i dopiero potem odkryć, że stabilny
        release stał na 16. miejscu.
      - `fetchSource` zwraca teraz `FetchResult` z licznikiem sprzed filtra.
        Bez tego alarm o pustym feedzie („HTTP OK, zero wpisów") krzyczałby na
        Prismę przy każdym przebiegu, w którym akurat nie ma stabilnego wydania —
        czyli na źródło działające dokładnie tak, jak skonfigurowane.
      - Zły regex w configu zatrzymuje start (`config.ts` kompiluje wzorce przy
        wczytaniu). Cicho nieprzepuszczające niczego źródło to ten sam tryb
        awarii, za który projekt już raz zapłacił tygodniem ciszy z Reddita.
- [x] Reddit: zamiast strumienia nowych postów — `/top/.rss?t=week` i `maxItems: 5`
      na każdy z trzech subredditów.
      - Powód z użytkowania: subreddit to jedyne źródło, w którym nikt niczego
        nie ogłasza — większość wpisów to pytania początkujących i autopromocja.
        Głosowanie społeczności jest gotową selekcją wstępną i nic nie kosztuje;
        bierzemy ją zamiast płacić Claude za odsiewanie długiego ogona.
        Zmierzone: 16-25 wpisów w feedzie, 5 branych.
      - `t=week`, nie `t=day`, bo cron chodzi co dwa dni. Nakładanie się okien
        nic nie kosztuje — powtórki odpada deduplikacja po URL przed modelem.
      - Świadomie **nie** zrobione: osobna, częstsza częstotliwość dla Reddita.
        Lista top tygodnia zmienia się wolno, a każdy dodatkowy przebieg to
        kolejne minuty czekania na limit hosta — koszt realny, zysk pozorny.
- [x] Błąd w `sources/http.ts` znaleziony przy okazji: `exhausted()` czytało
      `x-ratelimit-remaining` przez `Number(...)`, a `Number(null)` to `0`.
      Host, który o limitach nie mówi nic, wyglądał więc jak host z wyczerpanym
      budżetem i każde kolejne źródło na tym samym hoście czekało ślepą minutę.
      - Przy dwóch feedach z github.com niewidoczne. Przy dziewięciu — zmierzone
        w suchym przebiegu — osiem `waiting 61s for github.com` pod rząd.
      - Ta sama klasa błędu, co opisana w komentarzu przy `Retry-After` kilka
        linijek wyżej. Brak nagłówka jest teraz sprawdzany osobno, przed
        konwersją.
      - Po poprawce suchy przebieg wszystkich 23 źródeł sieciowych: zero czekania
        poza Reddittem (2 × ~60 s, zgodnie z jego realnym limitem).
- [x] Wiarygodność źródła jako sygnał dla modelu — pole `tier` (`official` /
      `community`) w `sources.json`, przekazywane do promptu oceniającego.
      - `assessItem` dostaje całe źródło zamiast samego `sourceId`: nazwa, która
        coś znaczy („Reddit r/reactjs" zamiast `reddit-reactjs`), i `tier`.
        `pipeline.ts` odzyskuje źródło z mapy po id, bo wpisy jadą przez przebieg
        płasko.
      - Prompt: wpisom `community` nie wolno stawiać więcej niż 2 bez sprawdzalnej,
        nowej informacji — nawet gdy temat idealnie pasuje. Trafność to nie temat.
      - `tier` jest wymagany, nie domyślny. Każdy domyślny musiałby brzmieć
        `official` (20 z 24 źródeł) i właśnie dlatego byłby pułapką: nowe źródło
        community bez tego pola czytałoby się jak komunikat producenta. Brak
        pola zatrzymuje start (`config.ts`).
      - **Zmierzone, bo warto wiedzieć, ile to naprawdę dało:** sonda A/B na
        ośmiu realnych wpisach (stary prompt kontra nowy, Haiku 4.5) zmieniła
        jedną ocenę — „Ambient CSS v3" z 2 na 1. Siedem pozostałych identycznie.
        Model już wcześniej oceniał community nisko, bo w polu `Źródło:` widział
        id ze słowem „reddit". Zmiana jest więc ubezpieczeniem (reguła zapisana
        wprost, nie wywnioskowana z kształtu identyfikatora), a nie zmierzoną
        poprawą — i tak jest opisana w ADR.
      - Zastrzeżenie do sondy: leciała bez leadów, które w prawdziwym przebiegu
        są obecne. Stąd np. `v16.3.4` z Next.js na 2 — goły numer wersji nic nie
        mówi, a w przebiegu ma przy sobie changelog z `content`.
- [x] Podłoga trafności dla stabilnych wydań: wydanie narzędzia ze stacku ogłoszone
      przez źródło `official` dostaje w promptcie co najmniej 4.
      - Powód wyszedł z weryfikacji ustawień, nie z założenia: przy progu
        powiadomień 4 `Node.js 26.8.1 (Current)` i `v8.2.2` z Vite dostawały 2.
        Nie dlatego, że są nieważne — goły numer wersji nie niesie informacji,
        a model streszcza to, co dostaje. Ubogi tytuł świadczy o kanale, nie
        o wadze wydarzenia.
      - Wyjątek działa **tylko w górę** i jawnie nie obejmuje: wydań wstępnych
        (canary, beta, rc, dev, nightly, alpha), pojedynczych paczek z monorepa,
        narzędzi spoza stacku oraz wpisów `community`.
      - Zmierzone po zmianie — podniosło dokładnie to, co miało:
        `Node.js 26.8.1` 2 → 4, Vite `v8.2.2` 2 → 4, Next.js `v16.3.4` 2 → 4,
        TypeScript 7.0.2 bez zmian (4).
      - Zabezpieczenia trzymają: `v16.4.0-canary.15` = 2, `create-vite@9.2.0` = 2,
        wydanie ogłoszone na Reddicie = 2, wpis Cloudflare niebędący wydaniem = 2,
        newsy OpenAI spoza tematu = 1.
- [x] Zweryfikowane przed zmianą promptu, czy rozbudowa źródeł wymaga nowych
      kategorii — **nie wymaga**.
      - Osiem realnych wpisów z nowych źródeł rozłożyło się na istniejące
        kategorie (`fullstack`, `javascript`, `typescript`, `react`, `ai`).
        Ani razu nie zabrakło kubełka.
      - Trzy subskrypcje w bazie, wszystkie z progiem 4: jedna `topics = NULL`
        (wszystkie), dwie z jawną listą 5 z 6 — bez `other`. `fullstack` jest
        zaznaczony wszędzie, więc rozbudowa dochodzi na każde urządzenie.
      - Luka po `other` policzona, nie oszacowana: 92 z 430 wpisów ma wyłącznie
        tę kategorię, ale **żaden nie dostał oceny ≥ 4**, więc przy progu 4 nigdy
        nie zabrała ani jednego powiadomienia. Bez zmian.
      - Do zapamiętania: `fullstack` staje się workiem (Node, Bun, Vite, Prisma,
        Drizzle, Neon, Vercel, Cloudflare — wszystko tam). Rozbicie kategorii to
        robota w czterech miejscach naraz (enum w `claude.ts`, `lib/items.ts`
        i dwie lokalne kopie: `pwa/push-settings.tsx`, `api/push/settings/route.ts`)
        plus migracja przepisująca wiersze, jak przy 007.
- [x] `docs/adr/0005-source-selection-at-the-source.md` — status `Proposed`.
      Spina trzy powyższe decyzje w jedną: selekcja dzieje się u źródła, przed
      wywołaniem modelu, a nie po ocenie. Odrzucone warianty z uzasadnieniem:
      poleganie na progu trafności, dwustopniowy filtr w agencie, osobny
      harmonogram dla community, Reddit przez `top.json`.
      - README i `docs/ARCHITECTURE.md` zsynchronizowane: 11 → 24 źródła
        (10 rss, 13 atom, 1 scrape), nowy krok w diagramie przepływu, pole
        `tier` w opisie configu, wpis o `titlePattern` wśród pułapek.
