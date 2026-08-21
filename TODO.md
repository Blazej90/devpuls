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
      `listItems` / `liczniki` pod zakładki i filtr tematu, zapisy (`markRead`,
      `markAllRead`, `softDelete`, `restore`) w tym samym module
- [x] `POST /api/items/delete` — miękkie usuwanie `{ids}` + cofnięcie `{przywroc:true}`
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
- [ ] Do rewizji w Etapie 4: kolor splash-a jako barwa marki, wtedy przestanie
      zależeć od tego, który motyw akurat wybrał użytkownik

### Etap 3 — skrzynka
- [x] Zakładki Nowe / Przeczytane / Wszystkie z licznikami, stan w URL (`?widok=`).
      Zwykłe linki, nie shadcn `tabs` — każda zakładka to inne zapytanie do bazy,
      a Radix przełącza panele po stronie klienta
- [x] Chipy tematów jako działający filtr, stan w URL (`?temat=`); zakładka i filtr
      wzajemnie się zachowują
- [x] Grupowanie po dacie: Dziś / Wczoraj / W tym tygodniu / Starsze —
      `lib/grupowanie.ts`, strefa przypięta do Europe/Warsaw
- [x] Karta: `outline` zamiast `ghost` przy „Przeczytane”; **otwarcie linku już nie
      oznacza wpisu**
- [x] „Oznacz grupę” przy nagłówku sekcji, widoczne tylko gdy grupa ma nieodhaczone
- [x] Checkboxy na kartach + pasek akcji zbiorczych (`fixed`, w zasięgu kciuka)
- [x] Usuwanie pojedyncze i zbiorcze + toast „Cofnij” (shadcn `sonner`)

### Etap 4 — treść i tożsamość
- [ ] Hero — nowa treść, bardziej produkcyjna
- [ ] Sekcja „O aplikacji” + autor (GitHub, portfolio, LinkedIn)
- [ ] Logo DevPuls jako SVG
- [ ] Ikony PWA wygenerowane z SVG (PNG zostaje dla `apple-touch-icon` i maskable)

### Odrzucone
- [x] ~~Pasek z automatycznie przewijanymi newsami~~ — powielałby pierwsze karty
      skrzynki, wymaga kontrolki pauzy (WCAG 2.2.2) i zjada przestrzeń na telefonie
      (ADR-0003)

### Dług
- [ ] Paginacja skrzynki — `listItems` ma twardy limit 100 na każdą zakładkę.
      Po Etapie 3 „Przeczytane” potrafi wyrenderować 100 kart naraz; grupowanie
      po dacie porządkuje je, ale nie zmniejsza
