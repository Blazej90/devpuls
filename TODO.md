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
- [ ] Wygenerowanie kluczy VAPID
- [ ] Endpoint `POST /api/push/subscribe` (zapis subskrypcji)
- [ ] Wysyłka push z `packages/agent` (biblioteka `web-push`)

## Faza 6 — Harmonogram
- [ ] `.github/workflows/ingest.yml` (cron co kilka godzin)
- [ ] Sekrety w GitHub Actions (Claude API key, connection string Neon, klucze VAPID)

## Faza 7 — UI
- [ ] Lista dostarczonych newsów w appce
- [ ] Ustawienia (próg trafności, wybór kategorii)

## Faza 8 — Dopracowanie
- [ ] Obsługa źródeł bez RSS (np. Anthropic News) przez scraping + Claude
- [ ] Monitoring błędów pipeline'u
