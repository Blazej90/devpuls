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
| LLM | Claude API | ocena trafności + streszczenie PL w jednym wywołaniu |
| Powiadomienia | Web Push API (VAPID) + biblioteka `web-push` | bez Firebase; Android — Chrome, iOS — Safari 16.4+ jako PWA dodana do ekranu głównego |
| Harmonogram | GitHub Actions (`schedule` + `workflow_dispatch`) | Vercel Cron na planie Hobby pozwala tylko na 1 uruchomienie/dzień, więc harmonogram idzie przez GitHub Actions |
| Pakiety | pnpm workspaces | monorepo: `apps/web` + `packages/agent` |

## 3. Struktura katalogów

```
devpuls/
├── CLAUDE.md
├── TODO.md
├── .gitignore
├── .env.example                  # ANTHROPIC_API_KEY, DATABASE_URL, klucze VAPID
├── pnpm-workspace.yaml           # workspaces + allowBuilds (zgody na postinstall)
├── package.json                  # root: packageManager pnpm, skrypty proxujące
├── pnpm-lock.yaml
├── docs/
│   ├── ARCHITECTURE.md
│   └── adr/
│       ├── template.md
│       └── 0001-poc-architecture.md
├── apps/
│   └── web/                      # Next.js PWA
│       ├── package.json
│       ├── tsconfig.json         # alias @/* -> apps/web/*
│       ├── next.config.ts
│       ├── postcss.config.mjs    # @tailwindcss/postcss (Tailwind v4)
│       ├── eslint.config.mjs     # flat config, eslint-config-next
│       ├── components.json       # config shadcn CLI (style new-york, aliasy)
│       ├── app/
│       │   ├── layout.tsx        # <html lang="pl">, metadata, viewport
│       │   ├── page.tsx
│       │   └── globals.css       # @theme + tokeny kolorów (light/dark)
│       ├── components/ui/        # button, card, badge, background-beams
│       ├── lib/
│       │   └── utils.ts          # cn() — wymagane przez shadcn/Aceternity
│       └── public/
│           ├── manifest.json
│           └── sw.js
├── packages/
│   └── agent/                    # pipeline ingestion + Claude + push
│       ├── package.json          # skrypty `ingest` / `migrate` (tsx)
│       ├── tsconfig.json         # alias @/* -> packages/agent/src/*
│       ├── sql/
│       │   └── 001_init.sql    # schemat startowy (idempotentny DDL)
│       ├── config/
│       │   └── sources.json
│       └── src/
│           ├── sources/
│           │   ├── index.ts      # dispatch po `type`
│           │   ├── rss.ts
│           │   ├── atom.ts
│           │   └── scrape.ts     # HTML -> JSON przez Claude
│           ├── types.ts
│           ├── config.ts
│           ├── anthropic.ts
│           ├── pipeline.ts
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
  push dla pozycji powyżej progu trafności.
- `src/claude.ts` — jedno wywołanie Claude API na artykuł: ocena trafności (1-5) względem
  profilu zainteresowań (TypeScript/React/JS/Fullstack/AI) + streszczenie PL (2-3 zdania) +
  zachowany oryginalny link.
- `src/push.ts` — wysyłka Web Push do zapisanych subskrypcji (biblioteka `web-push`,
  klucze VAPID).
- `src/db.ts` — klient Postgres (Neon). Tabele: `sources`, `items`, `push_subscriptions`.
- `src/types.ts` — znormalizowany kształt wpisu (`NormalizedItem`) i wynik oceny
  (`Assessment`), współdzielone przez wszystkie moduły.
- `src/config.ts` — wczytanie `config/sources.json` + progi z ENV
  (`RELEVANCE_THRESHOLD`, `MAX_ITEMS_PER_SOURCE`) i `requireEnv()`.
- `src/anthropic.ts` — leniwie tworzony klient Claude i stała `MODEL`, wspólne dla
  `claude.ts` i `sources/scrape.ts`.
- `src/sources/index.ts` — dispatch po polu `type` ze źródła na właściwy fetcher.
- Uruchamiany przez `tsx` jako pojedynczy skrypt Node.js z
  `.github/workflows/ingest.yml` — nie jako długo działający serwer.

## 5. Źródła danych (potwierdzone)

| Źródło | Typ | URL |
|---|---|---|
| Hacker News | rss | `https://news.ycombinator.com/rss` |
| Reddit r/typescript | rss | `https://www.reddit.com/r/typescript/.rss` |
| Reddit r/reactjs | rss | `https://www.reddit.com/r/reactjs/.rss` |
| Reddit r/LocalLLaMA | rss | `https://www.reddit.com/r/LocalLLaMA/.rss` |
| TypeScript — GitHub Releases | atom | `https://github.com/microsoft/TypeScript/releases.atom` |
| React — GitHub Releases | atom | `https://github.com/facebook/react/releases.atom` |
| TypeScript Blog | rss | `https://devblogs.microsoft.com/typescript/feed/` |
| OpenAI News | rss | `https://openai.com/news/rss.xml` |
| Google DeepMind Blog | rss | `https://deepmind.google/blog/feed/basic/` |
| Hugging Face Blog | rss | `https://huggingface.co/blog/feed.xml` |
| Anthropic News | scrape | `https://www.anthropic.com/news` (brak oficjalnego RSS) |

Pełny, maszynowo czytelny config: `packages/agent/config/sources.json`.

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

## 6. Powiadomienia push (PWA + Web Push)

- Manifest + "Dodaj do ekranu głównego" jest **wymagany na iOS** (Safari), żeby push
  działał — na Androidzie (Chrome) działa też z otwartej karty.
- `POST /api/push/subscribe` w Next.js zapisuje subskrypcję przeglądarki do Neon.
- Klucze VAPID generowane raz, trzymane jako sekrety (Vercel env + GitHub Actions secret),
  nigdy w repo.
- Wysyłkę robi `packages/agent` (z poziomu GitHub Actions), nie Next.js API — unika
  zbędnego round-tripu przez frontend.
- Na iOS subskrypcje bywają zawodne po dłuższej nieaktywności appki — warto dodać w UI
  przypomnienie o ponownym udzieleniu zgody.

## 7. Schemat bazy

Źródło prawdy: `packages/agent/sql/001_init.sql`. Poniżej skrót.

- `sources(id, name, url, type, created_at)` — `id` tekstowe, prosto z `sources.json`;
  `type` pilnowany CHECK-iem (`rss`/`atom`/`scrape`).
- `items(id, source_id, url, title_original, summary_pl, relevance_score, published_at,
  notified_at, created_at)` — `url` ma UNIQUE i to on realizuje deduplikację
  (`ON CONFLICT (url) DO NOTHING`); `relevance_score` ograniczony CHECK-iem do 1-5.
- `push_subscriptions(id, endpoint, keys_json, created_at)` — `endpoint` UNIQUE,
  `keys_json` to `{ p256dh, auth }` prosto z `PushSubscription.toJSON()`.
- `schema_migrations(version, applied_at)` — rejestr zastosowanych migracji, zakładany
  automatycznie przez `migrate.ts`.

Indeksy: `(relevance_score DESC, published_at DESC)` pod listę w UI oraz częściowy
`(created_at DESC) WHERE notified_at IS NULL` pod "co jeszcze nie poszło pushem".

Migracje uruchamia `pnpm agent:migrate` — każdy plik z `sql/` leci w jednej transakcji
i jest zapisywany w `schema_migrations`, więc powtórne uruchomienie nic nie robi.
Ten sam krok wykonuje workflow `ingest.yml` przed pobraniem źródeł.

## 8. Koszty — podsumowanie

- Vercel (hosting PWA): darmowy tier (Hobby)
- Neon (Postgres): darmowy tier
- GitHub Actions: repo jest **publiczne** (`github.com/Blazej90/devpuls`), więc minuty są
  darmowe i bez limitu — ograniczenie 2000 min/mies. dotyczy wyłącznie repozytoriów
  prywatnych. Harmonogram co 3h można w razie potrzeby zagęścić bez kosztów.
- Web Push / FCM: darmowe, bez limitu wiadomości
- Claude API: płatne per token, ale przy skali "kilka-kilkanaście artykułów dziennie"
  realnie pojedyncze dolary miesięcznie
- Brak opłat Apple/Google — świadomie pomijamy sklepy na tym etapie (patrz ADR-0001)
