# CLAUDE.md

Instrukcje dla agenta Claude pracującego nad tym projektem w VS Code / Claude Code.

## O projekcie

DevPuls — PWA agregująca nowinki techniczne (TypeScript, React, JS, Fullstack, AI developer)
z wybranych źródeł. Agent w tle filtruje trafność i tworzy streszczenia po polsku, appka
dostarcza je jako powiadomienia Web Push wraz z linkiem do oryginalnego źródła.

- Pełna architektura: `docs/ARCHITECTURE.md`
- Aktualny status prac: `TODO.md`
- Decyzje architektoniczne: `docs/adr/`

## Stack

- **pnpm** — jedyny menedżer pakietów w tym projekcie. Nigdy npm/yarn, nigdy nie generuj
  `package-lock.json` ani `yarn.lock`.
- **Next.js (App Router) + TypeScript** — frontend PWA, `apps/web`
- **shadcn/ui + Aceternity UI** — komponenty UI
- **Neon (Postgres)** — baza stanu
- **Claude API** — filtr trafności + streszczenia PL
- **Web Push API (VAPID)**, biblioteka `web-push` — powiadomienia, bez Firebase
- **GitHub Actions** — harmonogram pobierania (`packages/agent`)

## Twarde zasady pracy

1. **Nigdy nie rób `git commit` ani `git push` bez wyraźnej, jednoznacznej zgody** — zawsze
   pytaj i czekaj na potwierdzenie, nawet po w pełni ukończonym zadaniu.
2. **Zawsze pnpm.** Sprawdzaj, że `packageManager` w `package.json` się zgadza.
3. **UI: najpierw sprawdź, czy komponent istnieje w shadcn/ui (styl `new-york`) lub
   Aceternity**, zanim napiszesz go od zera.
4. **Zawsze importuj przez alias `@/...`**, nigdy przez wielopoziomowe ścieżki względne.
   Nowy alias dodajesz jednocześnie w `tsconfig.json` i `components.json`.
5. **Tailwind CSS v4 jest CSS-first** — nowe tokeny/kolory dodawaj w `app/globals.css`
   (blok `@theme inline` + `:root`/`.dark`), nie twórz `tailwind.config.ts`.
6. **RTK (proxy kompresji tokenów) jest wymaganą zależnością narzędziową tego projektu.**
   Szczegóły w sekcji „RTK — wymagana zależność narzędziowa" na końcu pliku.
7. Przed rozpoczęciem pracy odczytaj `TODO.md` i zaznacz `[~]` przy etapie, nad którym
   pracujesz.
8. Po zakończeniu etapu zaktualizuj `TODO.md` na `[x]` — bez commitowania (patrz zasada 1).

## Workflow: sesje brainstormingowe → ADR

Gdy użytkownik poprosi o "sesję brainstormingową" albo sygnalizuje decyzję architektoniczną
do podjęcia:

1. Najpierw dyskutuj opcje w czacie (pytania, kompromisy, alternatywy) — nie pisz kodu.
2. Gdy decyzja dojrzeje, utwórz nowy plik `docs/adr/NNNN-krotki-tytul.md` (kolejny numer,
   4 cyfry, np. `0002-...`) na podstawie `docs/adr/template.md`.
3. Nowy ADR ma status `Proposed`, dopóki użytkownik go nie zaakceptuje — wtedy zmień na
   `Accepted`.
4. Nowy/zmieniony ADR nigdy nie jest commitowany automatycznie (zasada 1).

## Źródła danych agenta

Pełna, potwierdzona lista: `packages/agent/config/sources.json`.

- Preferuj RSS/Atom nad scrapingiem.
- Źródło bez RSS (np. Anthropic News) ma `"type": "scrape"` w configu — zamiast pisać
  dedykowany parser HTML, wykorzystaj Claude do wyciągnięcia listy nowych wpisów ze
  strony jako ustrukturyzowany JSON.

## RTK — wymagana zależność narzędziowa

RTK (Rust Token Killer) to zależność **środowiska pracy agenta**, nie pakiet npm — nie
dopisujemy go do `package.json` ani do workspace'u pnpm. Jest wymagany do pracy nad tym
repo, bo obcina 60-90% tokenów na operacjach deweloperskich.

**Wymagana wersja:** `rtk >= 0.43.0`

### Weryfikacja na starcie sesji

```bash
rtk --version     # oczekiwane: rtk 0.43.0 lub nowsze
rtk gain          # musi działać; jeśli "command not found" → RTK nieaktywny
```

⚠️ Kolizja nazw: jeśli `rtk gain` zwraca błąd, prawdopodobnie zainstalowany jest
`reachingforthejack/rtk` (Rust Type Kit), a nie Rust Token Killer.

### Zasady użycia w tym repo

- Wszystkie komendy powłoki idą przez RTK. Hook Claude Code przepisuje je automatycznie
  (`git status` → `rtk git status`) — nie obchodź tego ręcznie.
- `rtk proxy <cmd>` tylko do debugowania, gdy filtrowanie zniekształca wynik.
- Meta-komendy uruchamiaj bezpośrednio: `rtk gain`, `rtk gain --history`, `rtk discover`.
- Dotyczy to też komend projektowych: `pnpm install`, `pnpm build`, `pnpm lint`, testów
  i skryptów agenta z `packages/agent`.

### Pokrycie — co faktycznie przechodzi przez proxy

Zweryfikowane przez `rtk gain --history` (loguje każde przechwycone wywołanie):

| Przechodzi przez RTK | Omija RTK |
|---|---|
| `git add`, `git status`, `git push`, `git log`, `git diff` | `git commit`, `git init` |
| `grep`, `read`, `ls`, `find`, `lint`, testy | wszystko poza **pierwszym** członem łańcucha |

**Najważniejsza zasada: jedna komenda na wywołanie.** Hook przepisuje wyłącznie pierwszy
człon łańcucha `&&` / `;` — reszta leci na surowo, poza proxy:

```bash
# ŹLE — tylko `ls` idzie przez RTK, `cat` i `pnpm` omijają proxy
ls -la && cat package.json && pnpm build

# DOBRZE — trzy osobne wywołania, każde przechwycone
ls -la
cat package.json
pnpm build
```

Skutek uboczny łańcuchów: filtr pierwszej komendy potrafi **zjeść output kolejnych** —
wynik po prostu nie dociera. Jeśli komenda zwraca pusto wbrew oczekiwaniom, sprawdź
najpierw, czy nie jest sklejona `&&` z inną.

Wyjątki, gdzie łańcuch jest w porządku: `cd X && cmd` (samo `cd` nic nie zwraca) oraz
komendy, które muszą działać atomowo (np. `set -e` w skrypcie migracyjnym).

`git commit` i `git init` zostawiamy jak są — ich output jest krótki i istotny w całości,
nie ma czego kompresować.

### Znany problem na Windows

RTK bywa pomijane, gdy Claude Code startuje przez Git Bash / MINGW64. W takiej sytuacji
uruchamiaj sesję przez WSL, żeby proxy faktycznie przechwytywało ruch. Jeśli w trakcie
sesji `rtk --version` przestaje odpowiadać — zgłoś to użytkownikowi zamiast pracować
bez proxy.
