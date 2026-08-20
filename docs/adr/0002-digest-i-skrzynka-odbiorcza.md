# ADR-0002: Powiadomienia zbiorcze i skrzynka odbiorcza zamiast strumienia pushy

**Status:** Accepted
**Data:** 2026-08-20

## Kontekst

Pierwszy pełny przebieg agenta na produkcji (workflow #3, 4m12s) ujawnił dwa problemy,
których nie było widać przy testach na kilku wpisach:

1. **Lawina powiadomień.** `pipeline.ts` wołał `sendPush` osobno dla każdego ocenionego
   wpisu, zaraz po jego ocenie. 44 powiadomienia przyszły jedno po drugim w odstępach
   kilku sekund. Przy cronie co 3h to się powtarzało.
2. **Brak pojęcia "nowe do przeczytania".** Lista w appce była posortowana po trafności
   i ograniczona do 50 pozycji. Wpis, o którym użytkownik właśnie dostał powiadomienie,
   lądował gdzieś w środku rankingu, nieodróżnialny od tygodniowego. Diagnoza na żywych
   danych: ze 44 powiadomionych wpisów 40 było na liście — problemem nie była
   widoczność, tylko brak stanu przeczytania.

Dodatkowo koszt okazał się wyższy niż zakładał ARCHITECTURE §8. Realnie ~$0,0015 za wpis
przy Haiku, co przy 10-30 nowych wpisach na przebieg i 8 przebiegach dziennie daje
**$5-12 miesięcznie**, a nie "pojedyncze dolary". Agent mielił co 3h niezależnie od tego,
czy cokolwiek się pojawiło.

## Rozważane opcje

**Częstotliwość agenta**

1. Zostawić co 3h i ratować się limitem pushy — koszt bez zmian.
2. Co 6h albo 2x dziennie — kompromis.
3. **Co 2 dni** — kilkukrotnie niższy koszt, ale jeden przebieg zbiera dużo więcej wpisów,
   więc lawina bez zmiany sposobu powiadamiania byłaby **gorsza**, nie lepsza.

**Sposób powiadamiania**

1. Limit N pushy na przebieg, od najtrafniejszych — proste, ale przy rzadszym cronie
   ucina większość treści bez śladu.
2. Push wyłącznie dla trafności 5 — traci wpisy z czwórką, których jest najwięcej.
3. **Jedno powiadomienie zbiorcze na przebieg** ("12 nowych wpisów" + kilka tytułów),
   klik otwiera appkę. Tak działają czytniki newsów. Traci tytuł artykułu jako treść
   powiadomienia, ale ta informacja i tak jest w appce.

**Stan przeczytania**

1. Tylko zmiana sortowania na "od najnowszych" — nie odróżnia przeczytanych.
2. **Kolumna `read_at` w `items`** + sekcja "Nowe" i licznik nieprzeczytanych.
3. Stan per subskrypcja — poprawne przy wielu użytkownikach, ale tu jest jeden użytkownik
   z dwoma urządzeniami, który chce wspólnej skrzynki; osobny stan na telefon i desktop
   byłby uciążliwy.

## Decyzja

Idziemy w **cron co 2 dni + jedno powiadomienie zbiorcze na przebieg + skrzynka
odbiorcza ze stanem przeczytania w `items.read_at`**.

Te trzy elementy są sprzężone i nie mają sensu osobno: rzadszy cron bez digestu pogarsza
lawinę, a digest bez skrzynki odbiorczej prowadzi donikąd — powiadomienie mówi "12 nowych
wpisów", więc appka musi umieć pokazać, które to.

Stan przeczytania jest **wspólny dla wszystkich urządzeń**, bo użytkownik jest jeden.
Ustawienia powiadomień zostają per subskrypcja (ADR wcześniejszy, migracja 002) — to
różne rzeczy: filtr jest właściwością urządzenia, przeczytanie właściwością treści.

## Konsekwencje

- Powiadomienie przestaje nieść tytuł artykułu. Jego rolą jest teraz "zajrzyj do appki",
  a nie "przeczytaj to". Dlatego treść digestu wymienia kilka najtrafniejszych tytułów,
  żeby dało się ocenić, czy warto wchodzić.
- Lista w appce sortuje się **od najnowszych**, nie po trafności. Trafność zostaje jako
  badge i kryterium filtrowania, przestaje być kryterium porządkującym.
- Świeżość spada: wpis opublikowany tuż po przebiegu poczeka do dwóch dni. Dla nowinek
  technicznych to akceptowalne — nie jest to kanał newsów giełdowych.
- Koszt spada kilkukrotnie. Zapis w ARCHITECTURE §8 trzeba poprawić na realne liczby,
  bo "pojedyncze dolary miesięcznie" było nieprawdą przy cronie co 3h.
- Cron `0 7 */2 * *` nie jest dokładnie "co 48h" — `*/2` na dniu miesiąca resetuje się
  na przełomie miesiąca, więc raz na jakiś czas wypadną dwa przebiegi pod rząd. Świadomie
  akceptujemy tę nieregularność zamiast budować własny scheduler.
- Workflow został wyłączony ręcznie w GitHub Actions do czasu wdrożenia tych zmian.
  Po wdrożeniu trzeba go włączyć z powrotem ("Enable workflow").
