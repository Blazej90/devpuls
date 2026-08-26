# ADR-0004: Wyciszanie źródła

**Status:** Accepted
**Data:** 2026-08-25

## Kontekst

Po kilku tygodniach używania appki widać, że nie każde skonfigurowane źródło
zarabia na swoje miejsce w skrzynce. Rozkład na dzień decyzji (89 wpisów,
10 źródeł, które cokolwiek dowiozły):

| Wpisów | Źródło |
|---:|---|
| 20 | Reddit r/typescript |
| 10 | TypeScript Blog |
| 10 | React - GitHub Releases |
| 10 | TypeScript - GitHub Releases |
| 10 | Hugging Face Blog |
| 9 | Hacker News |
| 7 | Anthropic News |
| 6 | Google DeepMind Blog |
| 5 | OpenAI News |
| 2 | Reddit r/LocalLLaMA |

Jedno źródło to 22% skrzynki. Filtr `?source=` (Faza 11) pozwala już _zawęzić_
widok do jednego źródła, ale nie pozwala się go pozbyć: chcemy móc powiedzieć
„to źródło mnie na razie nie interesuje" i nie oglądać go ani w skrzynce, ani
w powiadomieniach.

Ograniczenia: usunięcie źródła z `sources.json` nie wchodzi w grę — zniknęłoby
z konfiguracji razem z historią (`items.source_id` ma `ON DELETE CASCADE`),
a decyzja ma być odwracalna jednym kliknięciem. Drugie ograniczenie to koszt:
najdroższym krokiem przebiegu jest wywołanie Claude per wpis (ocena trafności
+ streszczenie).

## Rozważane opcje

1. **Filtr tylko w appce** — agent zbiera wszystko jak dotąd, wyciszenie ukrywa
   wpisy w skrzynce i wyłącza je z powiadomień.
2. **Pominięcie w agencie** — wyciszone źródło nie jest pobierane: bez fetcha,
   bez Claude, bez zapisu. Appka dodatkowo ukrywa to, co zebrano wcześniej.
3. **Usunięcie źródła z konfiguracji** — nieodwracalne, odpada.
4. **Wyciszenie per urządzenie** (kolumna w `push_subscriptions`, tam gdzie próg
   trafności i kategorie) zamiast globalnego.

## Decyzja

Wybieramy **opcję 2**: kolumna `sources.muted_at` (migracja 008), czytana
zarówno przez agenta, jak i przez appkę.

Opcja 1 odpada na koszcie — płacenie Claude za streszczanie treści, której
świadomie nie chcesz czytać, przeczy sensowi wyciszenia. Opcja 4 odpada na
spójności: próg trafności i kategorie są per urządzenie, bo dotyczą
**powiadomień**, ale skrzynka jest jedna i wspólna (patrz ADR-0002) — wyciszenie
per urządzenie oznaczałoby, że skrzynka pokazuje coś, o czym powiadomienie nigdy
nie wspomniało.

Wyciszenie działa wstecz i jest w pełni odwracalne: chowa też wpisy zebrane
wcześniej, ale niczego nie kasuje, więc przywrócenie oddaje je w całości.

## Konsekwencje

**Zyski**

- Zero wywołań Claude dla wyciszonego źródła — oszczędność wprost proporcjonalna
  do jego udziału w przebiegu.
- Jeden warunek (`i.source_id NOT IN (SELECT id FROM sources WHERE muted_at IS
  NOT NULL)`) w `buildConditions`, więc lista, liczniki zakładek i badge PWA nie
  mogą się rozjechać.
- `syncSources` aktualizuje wyłącznie `name`/`url`/`type`, więc wyciszenie
  przeżywa każdy przebieg agenta — konfiguracja go nie nadpisze.

**Kompromisy**

- **Okres ciszy przepada.** Skoro agent nie pobiera, to po przywróceniu wraca
  tylko bieżące okno kanału RSS (≈ 20–30 ostatnich wpisów), a nie cała luka.
  To świadoma cena za brak kosztów w czasie wyciszenia.
- Wyciszenie jest globalne — nie da się mieć źródła cichego na telefonie
  i głośnego na laptopie. Przy jednym odbiorcy to nie jest realny brak.
- Wejście (przycisk przy chipie źródła w skrzynce) i wyjście (podstrona
  `/sources`) są w dwóch różnych miejscach. To wynika z natury rzeczy:
  wyciszone źródło nie zostawia w skrzynce żadnej karty do kliknięcia.

**Do zrewidowania**

- Jeśli okaże się, że wyciszamy i przywracamy często, warto rozważyć wariant
  „zbieraj, ale nie powiadamiaj" jako drugi tryb obok pełnej ciszy.
- `runs` nie rejestruje pominiętych źródeł — w logu przebiegu jest tylko linia
  `[id] muted — skipped`. Gdyby liczba wyciszonych źródeł zaczęła mieć znaczenie
  dla diagnostyki, trzeba dołożyć licznik do raportu (`monitor.ts` + migracja
  kolumny w `runs`).
