# Architektura — DevPuls (PWA)

## 1. Przegląd

Aplikacja typu PWA, która:
1. Cyklicznie pobiera nowinki z ustalonej listy źródeł (RSS/Atom/scraping),
2. Filtruje trafność i tworzy streszczenie po polsku przez Claude API,
3. Wysyła nowe, trafne pozycje jako powiadomienie Web Push z linkiem do oryginału.

## 2. Stack technologiczny

| Warstwa | Technologia | Uwagi |
|---|---|---|
| Frontend / PWA | Next.js (App Router) + TypeScript | manifest + service worker, hosting: Vercel (darmowy tier) |
| Stylowanie | Tailwind CSS v4 | konfiguracja CSS-first (`@theme` w `globals.css`), bez `tailwind.config.ts` |
| Komponenty UI | shadcn/ui (styl `new-york`) + Aceternity UI | gotowe komponenty zamiast pisania od zera |
| Aliasy importów | `@/*` → `apps/web/*` | ustawione w `tsconfig.json`, zgodne z `components.json` |
| Baza danych | Neon (Postgres, serverless) | |
| LLM | Claude API — `claude-haiku-4-5` | ocena trafności + streszczenie PL w jednym wywołaniu; model nadpisywalny przez `CLAUDE_MODEL` |
| Powiadomienia | Web Push API (VAPID) + biblioteka `web-push` | bez Firebase; Android — Chrome, iOS — Safari 16.4+ jako PWA dodana do ekranu głównego |
| Harmonogram | GitHub Actions (`schedule` + `workflow_dispatch`) | Vercel Cron na planie Hobby pozwala tylko na 1 uruchomienie/dzień, więc harmonogram idzie przez GitHub Actions |
| Pakiety | pnpm workspaces | monorepo: `apps/web` + `packages/agent` |

## 3. Struktura katalogów

```
devpuls/
├── CLAUDE.md
├── TODO.md
├── .gitignore
├── .env.example                  # agent: ANTHROPIC_API_KEY, DATABASE_URL, VAPID
├── pnpm-workspace.yaml           # workspaces + allowBuilds (zgody na postinstall)
├── package.json                  # root: packageManager pnpm, skrypty proxujące
├── pnpm-lock.yaml
├── docs/
│   ├── ARCHITECTURE.md
│   └── adr/
│       ├── template.md
│       ├── 0001-poc-architecture.md
│       ├── 0002-digest-i-skrzynka-odbiorcza.md
│       └── 0003-przebudowa-ux-skrzynki.md
├── apps/
│   └── web/                      # Next.js PWA
│       ├── package.json
│       ├── tsconfig.json         # alias @/* -> apps/web/*
│       ├── next.config.ts
│       ├── postcss.config.mjs    # @tailwindcss/postcss (Tailwind v4)
│       ├── eslint.config.mjs     # flat config, eslint-config-next
│       ├── components.json       # config shadcn CLI (style new-york, aliasy)
│       ├── .env.example          # web: NEXT_PUBLIC_VAPID_PUBLIC_KEY, DATABASE_URL
│       ├── app/
│       │   ├── layout.tsx        # <html lang="pl">, metadata, viewport, bootstrap PWA
│       │   ├── page.tsx
│       │   ├── globals.css       # @theme + tokeny kolorów (light/dark)
│       │   └── api/
│       │       ├── health/route.ts           # GET stan pipeline'u (200/503)
│       │       ├── items/read/route.ts       # POST oznaczenie jako przeczytane
│       │       ├── items/delete/route.ts     # POST miękkie usunięcie + cofnięcie
│       │       └── push/
│       │           ├── subscribe/route.ts    # POST + DELETE subskrypcji
│       │           └── settings/route.ts     # POST odczyt, PATCH zapis ustawień
│       ├── components/
│       │   ├── ui/               # button, card, badge, toggle(-group), background-beams
│       │   ├── pwa/              # sw, prompt instalacji, zgoda i ustawienia pushy
│       │   ├── inbox.tsx         # skrzynka: „Nowe" + archiwum przeczytanych
│       │   ├── run-status.tsx    # pasek zdrowia ostatniego przebiegu
│       │   ├── theme-provider.tsx # next-themes, klasa `.dark` na <html>
│       │   └── theme-toggle.tsx  # segment system / jasny / ciemny
│       ├── lib/
│       │   ├── utils.ts          # cn() — wymagane przez shadcn/Aceternity
│       │   ├── db.ts             # klient Neona dla route handlerów
│       │   ├── items.ts          # cała selekcja i zapisy wpisów (ADR-0003)
│       │   └── runs.ts           # ostatni przebieg agenta + próg „ciszy"
│       └── public/
│           ├── manifest.json
│           ├── sw.js             # push + notificationclick + cache powłoki
│           ├── icon-192.png
│           ├── icon-512.png
│           └── apple-touch-icon.png
├── packages/
│   └── agent/                    # pipeline ingestion + Claude + push
│       ├── package.json          # skrypty `ingest` / `migrate` (tsx)
│       ├── tsconfig.json         # alias @/* -> packages/agent/src/*
│       ├── sql/
│       │   ├── 001_init.sql     # schemat startowy (idempotentny DDL)
│       │   ├── 002_topics_and_settings.sql
│       │   ├── 003_read_state.sql
│       │   ├── 004_run_log.sql  # tabela `runs` — dziennik zdrowia
│       │   └── 005_soft_delete_and_recency.sql
│       ├── config/
│       │   └── sources.json
│       └── src/
│           ├── sources/
│           │   ├── index.ts      # dispatch po `type`
│           │   ├── http.ts       # fetch + retry na 429/5xx
│           │   ├── rss.ts
│           │   ├── atom.ts
│           │   └── scrape.ts     # HTML -> JSON przez Claude
│           ├── types.ts
│           ├── config.ts
│           ├── anthropic.ts
│           ├── pipeline.ts
│           ├── monitor.ts     # zdrowie przebiegu + adnotacje GitHub Actions
│           ├── migrate.ts
│           ├── claude.ts
│           ├── push.ts
│           └── db.ts
└── .github/
    └── workflows/
        └── ingest.yml
```

## 4. Jak zbudowany jest agent (`packages/agent`)

- `src/sources/*.ts` — po jednym module fetchującym na typ źródła (`rss.ts`, `atom.ts`,
  `scrape.ts`). Każdy zwraca ten sam znormalizowany kształt `{ sourceId, url, title,
  publishedAt }`, niezależnie od formatu wejściowego.
- `src/pipeline.ts` — orkiestracja: wczytaj `config/sources.json` → pobierz każde źródło →
  odrzuć już widziane (po URL) → dla nowych wywołaj `claude.ts` → zapisz do bazy → wyślij
  **jeden digest** na przebieg (ADR-0002) → zapisz wiersz w `runs`. Wyjątek nie kończy
  procesu natychmiast: najpierw trzeba jeszcze zapisać, że przebieg padł.
- `src/claude.ts` — jedno wywołanie Claude API na artykuł: ocena trafności (1-5) względem
  profilu zainteresowań (TypeScript/React/JS/Fullstack/AI) + streszczenie PL (2-3 zdania) +
  zachowany oryginalny link.
- `src/push.ts` — wysyłka Web Push do zapisanych subskrypcji (biblioteka `web-push`,
  klucze VAPID). Jedno zbiorcze powiadomienie na przebieg, złożone osobno dla każdej
  subskrypcji z wpisów przechodzących **jej** próg i kategorie.
- `src/db.ts` — klient Postgres (Neon). Tabele: `sources`, `items`, `push_subscriptions`,
  `runs`.
- `src/types.ts` — znormalizowany kształt wpisu (`NormalizedItem`) i wynik oceny
  (`Assessment`), współdzielone przez wszystkie moduły.
- `src/config.ts` — wczytanie `config/sources.json` + progi z ENV
  (`RELEVANCE_THRESHOLD`, `MAX_ITEMS_PER_SOURCE`) i `requireEnv()`.
- `src/anthropic.ts` — leniwie tworzony klient Claude i stała `MODEL` (domyślnie
  `claude-haiku-4-5`, nadpisywalna przez `CLAUDE_MODEL`), wspólne dla `claude.ts`
  i `sources/scrape.ts`. Haiku 4.5 wybrany świadomie: klasyfikacja 1-5 plus dwa-trzy
  zdania streszczenia nie potrzebują mocniejszego modelu, a input/output jest ok. 5x
  tańszy niż w klasie Opus. **Haiku nie przyjmuje `output_config.effort`** — ten
  parametr zwraca 400, więc oba wywołania przekazują wyłącznie `format`.
- `src/monitor.ts` — zbieranie zdrowia przebiegu: liczniki, lista zastrzeżeń,
  wyliczenie statusu (`ok` / `degraded` / `failed`) oraz adnotacje i podsumowanie
  kroku w GitHub Actions. Stan trzymany na poziomie modułu, bo agent to skrypt
  jednorazowy — jeden proces to jeden przebieg (szczegóły w sekcji 9).
- `src/sources/index.ts` — dispatch po polu `type` ze źródła na właściwy fetcher.
- Uruchamiany przez `tsx` jako pojedynczy skrypt Node.js z
  `.github/workflows/ingest.yml` — nie jako długo działający serwer.

## 5. Źródła danych (potwierdzone)

| Źródło | Typ | URL |
|---|---|---|
| Hacker News | rss | `https://news.ycombinator.com/rss` |
| Reddit r/typescript | atom | `https://www.reddit.com/r/typescript/.rss` |
| Reddit r/reactjs | atom | `https://www.reddit.com/r/reactjs/.rss` |
| Reddit r/LocalLLaMA | atom | `https://www.reddit.com/r/LocalLLaMA/.rss` |
| TypeScript — GitHub Releases | atom | `https://github.com/microsoft/TypeScript/releases.atom` |
| React — GitHub Releases | atom | `https://github.com/facebook/react/releases.atom` |
| TypeScript Blog | rss | `https://devblogs.microsoft.com/typescript/feed/` |
| OpenAI News | rss | `https://openai.com/news/rss.xml` |
| Google DeepMind Blog | rss | `https://deepmind.google/blog/feed/basic/` |
| Hugging Face Blog | rss | `https://huggingface.co/blog/feed.xml` |
| Anthropic News | scrape | `https://www.anthropic.com/news` (brak oficjalnego RSS) |

Pełny, maszynowo czytelny config: `packages/agent/config/sources.json`.

**Uwaga o Reddicie:** endpoint `.rss` Reddita serwuje w rzeczywistości **Atom**
(`<feed xmlns="http://www.w3.org/2005/Atom">`), mimo rozszerzenia w URL-u. Dlatego te
trzy źródła mają `"type": "atom"` — przy `"rss"` parser nie znajduje `rss.channel.item`
i zwraca zero wpisów bez żadnego błędu.

Reddit agresywnie limituje niezalogowany ruch per IP i potrafi zwrócić 429. Łagodzimy to
dwojako: `sources/http.ts` ponawia (3 próby, backoff 1s/2s, honorując `Retry-After`),
a `pipeline.ts` pobiera źródła z tego samego hosta sekwencyjnie zamiast równolegle.
Mimo to pojedynczy feed potrafi się nie dociągnąć — to nie jest błąd pipeline'u, kolejny
przebieg go nadrobi. W GitHub Actions ryzyko jest wyższe niż lokalnie, bo Reddit ostrzej
traktuje adresy z datacenter; gdyby te źródła zaczęły padać stale, rozwiązaniem jest
własna aplikacja OAuth Reddita.

## 5a. Aliasy i Tailwind — konwencja

- Import zawsze przez alias `@/...` (np. `@/components/ui/button`, `@/lib/utils`), nigdy przez
  długie ścieżki względne (`../../../components/...`). Alias jest zdefiniowany raz w
  `tsconfig.json` (`baseUrl: "."`, `paths: { "@/*": ["./*"] }`) i musi zgadzać się z sekcją
  `aliases` w `components.json`, żeby CLI shadcn wrzucał nowe komponenty we właściwe miejsce.
- Tailwind CSS v4 nie używa pliku `tailwind.config.ts` — konfiguracja jest CSS-first, w
  `app/globals.css` (blok `@theme inline` + zmienne w `:root` / `.dark`). Nowe tokeny (np.
  własny kolor marki) dodaje się tam, nie w osobnym pliku JS.
- `components.json` ma `"style": "new-york"` — starszy styl `"default"` w shadcn/ui jest
  przestarzały.
- Wersje zweryfikowane przy pierwszym `pnpm install`: Next.js 16.3.1, React 19, Tailwind 4,
  pnpm 11.18.0 (pole `packageManager` w root `package.json` — CI czyta je przez
  `pnpm/action-setup@v4`, dlatego workflow nie pinuje wersji osobno).
- **`next lint` nie istnieje od Next.js 16** — lintujemy przez ESLint bezpośrednio
  (`eslint.config.mjs`, flat config, `eslint-config-next`). ESLint trzymamy na **v9**:
  `eslint-plugin-react` (tranzytywnie z `eslint-config-next`) wywala się na ESLint 10
  (`context.getFilename is not a function`).

## 5b. Motyw jasny/ciemny

Do Etapu 2 przebudowy UX (ADR-0003) blok `.dark` w `globals.css` był **martwym kodem**:
pełna paleta tokenów istniała, ale nic nigdy nie dodawało klasy `.dark` do dokumentu,
więc żaden wariant `dark:` w Tailwindzie się nie uruchamiał.

Motywem steruje `next-themes` (`attribute="class"`, `defaultTheme="system"`). Biblioteka,
a nie własny `useState`, bo wstrzykuje skrypt ustawiający klasę **przed** pierwszym
malowaniem — rozwiązanie na efekcie czytałoby preferencję dopiero po hydratacji, więc przy
każdym wejściu w trybie ciemnym mignęłoby białe tło.

Trzy stany, nie dwa: „systemowy" jest osobną opcją, a nie stanem startowym znikającym po
pierwszym kliknięciu. Bez niego nie da się wrócić do podążania za ustawieniem telefonu,
a to jedyny tryb, który sam przełącza się wieczorem. Wybór trafia do `localStorage` pod
kluczem `theme` jako **ustawienie** (`system`), nie jako wynik (`dark`) — dzięki temu
zmiana motywu w systemie nadal działa.

Kolory poza appką:

- `viewport.themeColor` w `layout.tsx` — pasek przeglądarki, dwa warianty po
  `prefers-color-scheme`, przełączane w locie.
- `manifest.json` — `theme_color` i `background_color` malują splash **przed** wczytaniem
  strony. Statyczny JSON nie umie reagować na motyw, więc jedna wartość musi obsłużyć oba.
  Do Etapu 2 stało tam `#0a0a0a`, choć appka renderowała się na biało — splash był czarny,
  po czym strona błyskała bielą. Teraz `#ffffff`, zgodnie z domyślnym `:root`.
  Do rewizji przy logo (Etap 4): barwa marki działałaby w obu motywach.

Uwaga przy testach na `localhost`: `localStorage` jest wspólny dla całego originu, więc
klucz `theme` bywa zapisany przez inny lokalny projekt korzystający z `next-themes`.

## 6. Powiadomienia push (PWA + Web Push)

- Manifest + "Dodaj do ekranu głównego" jest **wymagany na iOS** (Safari), żeby push
  działał — na Androidzie (Chrome) działa też z otwartej karty.
- `POST /api/push/subscribe` w Next.js zapisuje subskrypcję do Neona, `DELETE` ją usuwa.
  Body walidowane zodem (endpoint jest publiczny), zapis robi upsert po `endpoint`,
  więc ponowne udzielenie zgody odświeża klucze zamiast mnożyć wiersze.
- **Klucze VAPID są w dwóch miejscach i to jest zamierzone.** Klucz prywatny plus
  publiczny w rootowym `.env` (agent, sekrety GitHub Actions); sam publiczny jako
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` w `apps/web/.env.local` (przeglądarka, env Vercela).
  Next czyta env wyłącznie z katalogu swojego projektu, a i tak na produkcji te dwa
  środowiska są rozdzielone.
- Klucze VAPID generowane raz, trzymane jako sekrety (Vercel env + GitHub Actions secret),
  nigdy w repo.
- Wysyłkę robi `packages/agent` (z poziomu GitHub Actions), nie Next.js API — unika
  zbędnego round-tripu przez frontend.
- Na iOS subskrypcje bywają zawodne po dłuższej nieaktywności appki — warto dodać w UI
  przypomnienie o ponownym udzieleniu zgody.
- **Debugowanie na Windowsie:** dostarczone powiadomienie może nie pokazać dymka, jeśli
  włączone jest „Nie przeszkadzać" albo Chrome/DevPuls ma wyłączone banery w Ustawieniach
  → System → Powiadomienia. Trafia wtedy do centrum powiadomień (`Win + N`) i nadal jest
  widoczne w `registration.getNotifications()`. Zanim uznasz, że push nie działa, sprawdź
  właśnie to — `getNotifications()` odróżnia „nie dotarło" od „nie wyświetlono".
- `public/sw.js` obsługuje `push` (pokazuje powiadomienie z payloadu
  `{ title, body, url }` wysyłanego przez `packages/agent/src/push.ts`) oraz
  `notificationclick` (fokusuje otwartą kartę zamiast mnożyć okna). `tag` ustawiony na
  URL wpisu, więc powtórny push o tym samym artykule podmienia powiadomienie zamiast
  dokładać kolejne.
- Cache powłoki jest **network-first** — newsy mają być świeże, cache służy tylko za
  awaryjne wyjście offline.
- `beforeinstallprompt` leci raz, tuż po załadowaniu strony, **zanim React się
  zhydratuje**. Listener w `useEffect` przegapiał to zdarzenie i przycisk instalacji
  nigdy się nie pokazywał (zweryfikowane w Chrome). Dlatego zdarzenie łapie skrypt
  wstrzykiwany przez `next/script` ze `strategy="beforeInteractive"`, odkłada je na
  `window`, a `InstallHint` czyta stąd przez `useSyncExternalStore`.

## 7. Schemat bazy

Źródło prawdy: pliki w `packages/agent/sql/`. Poniżej skrót.

- `sources(id, name, url, type, created_at)` — `id` tekstowe, prosto z `sources.json`;
  `type` pilnowany CHECK-iem (`rss`/`atom`/`scrape`).
- `items(id, source_id, url, title_original, summary_pl, relevance_score, published_at,
  notified_at, created_at)` — `url` ma UNIQUE i to on realizuje deduplikację
  (`ON CONFLICT (url) DO NOTHING`); `relevance_score` ograniczony CHECK-iem do 1-5.
- `push_subscriptions(id, endpoint, keys_json, created_at)` — `endpoint` UNIQUE,
  `keys_json` to `{ p256dh, auth }` prosto z `PushSubscription.toJSON()`.
- `schema_migrations(version, applied_at)` — rejestr zastosowanych migracji, zakładany
  automatycznie przez `migrate.ts`.

Migracja 002 dołożyła `items.topics` (kategorie od Claude, indeks GIN) oraz
`push_subscriptions.min_relevance` i `push_subscriptions.topics`. **Próg i kategorie są
per subskrypcja, nie w ENV agenta** — dzięki temu zmieniają się z poziomu appki, bez
redeployu, a dwa urządzenia mogą mieć różne ustawienia. Decyzję o wysyłce podejmuje
`push.ts`, nie `pipeline.ts`. `topics = NULL` oznacza wszystkie kategorie.

Migracja 003 dołożyła `items.read_at` — stan skrzynki odbiorczej (ADR-0002). Jest
**wspólny dla wszystkich urządzeń**, bo użytkownik jest jeden; filtry powiadomień zostają
per subskrypcja, bo to inna właściwość: filtr należy do urządzenia, przeczytanie do treści.

Migracja 004 dołożyła `runs(id, started_at, finished_at, duration_ms, status, sources_ok,
sources_failed, candidates, fresh, assessed, delivered, errors)` — dziennik zdrowia agenta,
jeden wiersz na przebieg, `errors` jako JSONB. Szczegóły w sekcji 9.

Migracja 005 dołożyła `items.deleted_at` (miękkie usuwanie, ADR-0003) i przestawiła
kolejność skrzynki na `COALESCE(published_at, created_at)`. Usuwanie **musi** być
miękkie: `items.url` z UNIQUE to jedyna ochrona przed ponownym pobraniem artykułu, więc
po twardym DELETE wpis wróciłby przy najbliższym przebiegu razem z powiadomieniem.
Konsekwencja: **każde** zapytanie o wpisy filtruje `deleted_at IS NULL` — dlatego cała
selekcja i wszystkie zapisy siedzą w `apps/web/lib/items.ts`, a route handlery nie piszą
własnego SQL-a.

Indeksy: `(relevance_score DESC, published_at DESC)` pod listę w UI, częściowy
`(created_at DESC) WHERE notified_at IS NULL` pod "co jeszcze nie poszło pushem",
dwa częściowe na wyrażeniu `COALESCE(published_at, created_at) DESC` — `items_unread_idx`
(`WHERE read_at IS NULL AND deleted_at IS NULL`) pod zakładkę "Nowe" i `items_recency_idx`
(`WHERE deleted_at IS NULL`) pod pozostałe — oraz `runs(finished_at DESC)` pod odczyt
ostatniego przebiegu.

Pułapka sterownika: Neon zwraca BIGINT jako **string**, a TIMESTAMPTZ jako obiekt
**`Date`**. Oba są normalizowane na granicy modułu (`toItem` w `lib/items.ts`,
`insertItem` w `packages/agent/src/db.ts`), żeby reszta kodu o tym nie pamiętała.

Migracje uruchamia `pnpm agent:migrate` — każdy plik z `sql/` leci w jednej transakcji
i jest zapisywany w `schema_migrations`, więc powtórne uruchomienie nic nie robi.
Ten sam krok wykonuje workflow `ingest.yml` przed pobraniem źródeł.

## 8. Koszty — podsumowanie

- Vercel (hosting PWA): darmowy tier (Hobby)
- Neon (Postgres): darmowy tier
- GitHub Actions: repo jest **publiczne** (`github.com/Blazej90/devpuls`), więc minuty są
  darmowe i bez limitu — ograniczenie 2000 min/mies. dotyczy wyłącznie repozytoriów
  prywatnych. Harmonogram można w razie potrzeby zagęścić bez kosztów po stronie GitHuba;
  ogranicza nas wyłącznie rachunek za Claude API.
- Web Push / FCM: darmowe, bez limitu wiadomości
- Claude API: przy Haiku 4.5 jeden wpis to ~$0,0015 (ok. 500 tokenów wejścia,
  200 wyjścia). Przy cronie co 3h wychodziło $5-12 miesięcznie — wbrew wcześniejszemu
  zapisowi o "pojedynczych dolarach". Po przejściu na przebieg co 2 dni (ADR-0002)
  to rząd wielkości mniej
- Brak opłat Apple/Google — świadomie pomijamy sklepy na tym etapie (patrz ADR-0001)

## 9. Monitoring pipeline'u

Od kiedy cron chodzi co 2 dni (ADR-0002), cicha awaria potrafiłaby zostać niezauważona
przez tydzień. Trzy tryby awarii, które trzeba było rozróżnić:

| Tryb | Jak wygląda | Co go łapie |
|---|---|---|
| Przebieg się wywalił | wyjątek, zero działających źródeł, zero ocen przy nowych wpisach | status `failed`, `::error::`, exit 1 → czerwony workflow i mail od GitHuba |
| Przebieg dowiózł, ale coś padło | jedno źródło z 503, odmowa modelu, błąd wysyłki push | status `degraded`, `::warning::`, exit 0 |
| Przebieg w ogóle nie wystartował | wyłączony workflow, wygasły sekret, pominięty slot crona | brak świeżego wiersza w `runs` — wykrywane po stronie appki |

Trzeci przypadek jest najważniejszy i zarazem jedyny, którego agent nie zgłosi sam:
skoro się nie uruchomił, nie ma kto zapisać błędu. Dlatego progiem jest **cisza**:
brak przebiegu przez ponad 72 h (`STALE_AFTER_HOURS`) to alarm. Trzy doby zamiast dwóch,
bo GitHub potrafi opóźnić slot crona, a przy dużym obciążeniu wręcz go pominąć.

Osobno wyłapujemy feed, który odpowiada **200 z pustą listą** (`kind: "empty"`) — to
najcichszy tryb awarii i dokładnie tak przez tydzień milczały trzy feedy Reddita, zanim
okazało się, że `.rss` serwuje Atoma. Zdrowe źródło zawsze zwraca jakieś wpisy.

Świadomie **nie** czerwienimy workflow przy `degraded`: jeden feed z chwilowym 429
gasiłby run co drugi raz i po miesiącu czerwone przestałoby cokolwiek znaczyć.

Gdzie stan widać:

- **appka, `components/run-status.tsx`** — jedna szara linijka, gdy jest dobrze;
  ramka z rozwijaną listą zastrzeżeń, gdy nie jest. Monitoring, który krzyczy przy
  zdrowym stanie, przestaje być czytany.
- **`GET /api/health`** — dla zewnętrznego monitoringu (UptimeRobot, Better Stack).
  Alarm niesie kod HTTP, nie treść: 503 dostaje `failed` i cisza, `degraded` zostaje
  na 200. Uwaga: przed pierwszym przebiegiem po wdrożeniu endpoint zwraca 503 ze
  `status: "unknown"` — nie ma jeszcze dowodu, że cokolwiek działa.
- **GitHub Actions** — adnotacje przy runie i tabela w podsumowaniu kroku.

Dziennik trzyma tabela `runs` (migracja 004): jeden wiersz na przebieg, liczniki plus
`errors` jako JSONB. To dziennik zdrowia, nie audyt — nie ma tu logów per wpis.
