# ADR-0005: Selekcja u źródła zamiast selekcji po ocenie

**Status:** Accepted
**Data:** 2026-09-03

## Kontekst

Rozbudowa listy źródeł z 11 do 24 (nowoczesny fullstack: Node, Bun, Next.js,
React Router, Vite, Prisma, Drizzle, Neon, Vercel, Cloudflare) zderzyła się
z dwoma problemami, których poprzedni zestaw nie ujawniał.

**Po pierwsze, `releases.atom` to kanał tagów, nie wydań.** Projekty tagują
znacznie więcej, niż ogłaszają. Zmierzone na dziesięciu wpisach z każdego feeda,
w dniu decyzji:

| Źródło | Co jest w feedzie | Realnych wydań |
|---|---|---:|
| Next.js | 8 × `v16.4.0-canary.N`, 2 stabilne | 2 |
| Prisma | same `8.1.0-dev.6`, `v8.0.0-rc.8-dev.13` | 0 |
| React Router | tagi paczek monorepa, `v0.0.0-experimental-7aea711dd` | 2 |
| Vite | `v8.2.2` wymieszane z `create-vite@9.2.0`, `plugin-legacy@8.2.3` | 4 |
| Bun | tagi z własnego CI (`consolidation-step-7-green`) | 5 |

Bez interwencji te pięć źródeł dokładałoby ok. 35 wpisów na przebieg, z czego
ok. 13 miałoby dla kogokolwiek znaczenie.

**Po drugie, subreddit to jedyne źródło, w którym nikt niczego nie ogłasza.**
Trzy feedy Reddita szły dotąd po strumieniu nowych postów (do 15 wpisów każdy,
45 na przebieg). ADR-0004 zmierzył, że sam r/typescript odpowiadał wtedy za 22%
skrzynki. Jakościowo to w większości pytania początkujących, autopromocja
własnych projektów i treści żartobliwe — rzeczy trafione tematycznie i bez
wartości dla odbiorcy.

Ograniczenie kosztowe jest to samo, co w ADR-0004: najdroższym krokiem przebiegu
jest jedno wywołanie Claude na wpis. Każdy mechanizm, który działa **po** ocenie,
płaci za wszystko, co odrzuca.

## Rozważane opcje

1. **Nic nie robić** — polegać na progu trafności. Agent ocenia wszystko, a próg
   4+ i tak nie wpuści szumu do powiadomień.
2. **Dwustopniowe przetwarzanie w agencie** — tani klasyfikator (sam tytuł)
   decyduje, co dostaje pełny, drogi prompt ze streszczeniem.
3. **Selekcja u źródła** — konfiguracja mówi, co z danego feeda w ogóle jest
   wpisem (`titlePattern`) i ile go bierzemy (`maxItems`); Reddit czytany z listy
   `top` zamiast ze strumienia nowych; typ źródła podany modelowi w promptcie.
4. **Różna częstotliwość per typ źródła** — osobny, częstszy harmonogram dla
   community, rzadszy dla kanałów oficjalnych.
5. **Reddit przez JSON API** (`top.json?t=day`) — daje liczby głosów i komentarzy,
   więc próg można postawić na konkretnej wartości, a nie na pozycji w rankingu.

## Decyzja

Wybieramy **opcję 3**.

Opcja 1 odpada, bo próg trafności chroni tylko powiadomienia — skrzynka
zbierałaby canary i pytania o `tsconfig.json` mimo wszystko, a zapłacilibyśmy za
ocenę każdego z nich. Opcja 2 rozwiązuje problem, którego nie ma: `claude.ts`
dostaje wyłącznie tytuł, URL i lead z feeda — nigdy treści posta ani komentarzy —
i chodzi na Haiku 4.5, więc tani stopień już tam jest; drugi dokładałby warstwę,
żeby oszczędzić grosze. Realną dźwignią jest liczba wpisów docierających do
modelu, a nie cena jednego wywołania.

Opcja 4 odpada na bilansie: lista top tygodnia zmienia się wolno, więc częstsze
sprawdzanie niewiele wnosi, a każdy dodatkowy przebieg to kolejne ~2 minuty
czekania na limit Reddita (zmierzone) i drugi workflow do utrzymania. Opcja 5
odpada na ryzyku: `top.json` bez OAuth z adresów GitHub Actions to proszenie się
o 403, a wariant `top/.rss` daje tę samą selekcję społeczności bez nowego
fetchera i bez zmiany ekspozycji na limity.

W ramach opcji 3 trzy mechanizmy:

- **`titlePattern` jako lista dopuszczeń, nie wykluczeń.** Taki kształt ma sam
  problem: „jak wygląda wydanie" (`^v?[0-9]+[.][0-9]+[.][0-9]+$`, `^Bun v[0-9]`)
  to zbiór skończony, „jak wygląda wszystko, co wydaniem nie jest" — nie jest,
  i każda nowa konwencja nazewnicza upstreamu przeciekałaby przez blacklistę.
- **`maxItems` per źródło** i Reddit czytany z `/top/.rss?t=week`. Głosowanie
  społeczności jest gotową selekcją wstępną i nic nie kosztuje; bierzemy 5 wpisów
  zamiast płacić za odsiewanie długiego ogona. `t=week`, nie `t=day`, bo cron
  chodzi co dwa dni — przy dobowym oknie połowa czasu wypadałaby poza zasięg.
- **Typ źródła w promptcie** (`official` / `community`) — model dostaje wprost,
  czy patrzy na ogłoszenie, czy na czyjś post, i ma instrukcję, żeby drugiemu
  nie stawiać więcej niż 2 bez sprawdzalnej, nowej informacji.
- **Podłoga dla stabilnych wydań**: wydanie narzędzia z jego stacku ogłoszone przez
  źródło `official` dostaje co najmniej 4, choćby tytuł był samym numerem wersji.
  Powód wyszedł z pomiaru: przy progu powiadomień 4 `Node.js 26.8.1 (Current)`
  i `v8.2.2` z Vite dostawały 2 — nie dlatego, że są nieważne, tylko dlatego, że
  goły numer wersji nie niesie informacji, a model streszcza to, co dostaje. Ubogi
  tytuł świadczy o kanale, nie o wadze wydarzenia.

## Konsekwencje

**Zyski**

- Odrzucone wpisy nie kosztują nic: filtr i limit działają przed wywołaniem
  Claude. Zmierzone po zmianie — Next.js 10 → 2, Vite 10 → 4, Bun 10 → 5,
  Drizzle 10 → 1, Prisma 10 → 0, każdy feed Reddita 16–25 → 5.
- 24 źródła dają ok. 234 kandydatów na przebieg zamiast ok. 300 przy tej samej
  liczbie feedów bez selekcji, a różnica to niemal wyłącznie wpisy, których nikt
  nie ogłaszał.
- Nakładanie się okien `t=week` nic nie kosztuje — powtórki odpada deduplikacja
  po URL, zanim dojdzie do modelu.

**Kompromisy**

- **`titlePattern` jest sprzężony z konwencją nazewniczą upstreamu.** Jeśli
  projekt zmieni sposób tagowania, źródło zamilknie — po cichu, bo pusty wynik
  po filtrze jest tu stanem normalnym. Częściowa ochrona: `FetchResult` niesie
  licznik sprzed filtra, więc alarm o pustym feedzie nadal odróżnia „nic nie
  przeszło" od „nic nie przyszło". Pełnej ochrony to nie daje.
- **Zły regex w configu zatrzymuje start przebiegu** (`config.ts` kompiluje
  wzorce przy wczytaniu). Świadomie ostrzej niż trzeba: cicho nieprzepuszczające
  niczego źródło to ten sam tryb awarii, za który projekt zapłacił już tygodniem
  ciszy z trzech feedów Reddita.
- **Podpowiedź o typie źródła jest ubezpieczeniem, nie zmierzoną poprawą.**
  Sonda A/B na ośmiu realnych wpisach (stary prompt kontra nowy, Haiku 4.5)
  zmieniła jedną ocenę na osiem — autopromocyjne „Ambient CSS v3" spadło z 2 na 1;
  pozostałe siedem wyszło identycznie. Model już wcześniej oceniał community
  nisko, bo w polu `Źródło:` dostawał id zawierające słowo „reddit". Wartość
  zmiany polega więc na tym, że reguła jest zapisana wprost, a nie wywnioskowana
  z przypadkowego kształtu identyfikatora — nowe źródło community nazwane inaczej
  nie zależy już od tego skojarzenia.
- **Podłoga dla wydań jest jedyną regułą w promptcie, która działa w górę**, więc to
  ona najprędzej zacznie przepuszczać rzeczy niechciane — wystarczy, że model uzna
  za „narzędzie ze stacku" coś, co nim nie jest. Zmierzone zabezpieczenia trzymają:
  `v16.4.0-canary.15` dostaje 2, `create-vite@9.2.0` dostaje 2, wydanie ogłoszone na
  Reddicie dostaje 2. Wzrost dotknął dokładnie tych wpisów, o które chodziło:
  Node.js 26.8.1, Vite `v8.2.2` i Next.js `v16.3.4` — wszystkie 2 → 4.
- **`tier` jest wymagany i niedomyślny.** Każdy domyślny musiałby brzmieć
  `official` (pasuje do 20 z 24 źródeł) i dokładnie to czyni go pułapką: nowe
  źródło community bez tego pola byłoby czytane jako ogłoszenie producenta.
- Reddit dostaje teraz maksymalnie 15 wpisów na przebieg zamiast 45. Wpis, który
  wystrzelił i opadł w ciągu dwóch dni, może nie trafić do top tygodnia i przepaść.

**Do zrewidowania**

- Hacker News został przy `maxItems` domyślnym (15) i `tier: community`, bo jego
  feed to już ranking — front page jest posortowana pozycją. Jeśli okaże się, że
  i tak dowozi głównie szum, jest kandydatem na ten sam limit co subreddity.
- Jeśli `titlePattern` zacznie wymagać poprawek po każdej zmianie u upstreamu,
  tańsze może być czytanie `releases.atom` razem z flagą prerelease z API GitHuba
  (wymaga tokena, więc i zmiany w workflow).
- Sonda A/B była na ośmiu wpisach i bez leadów, które w prawdziwym przebiegu są
  obecne (`content` z Atoma). Gdyby oceny community zaczęły przebijać próg,
  warto powtórzyć pomiar na pełnych wpisach, zanim zaostrzy się prompt.
