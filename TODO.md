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
