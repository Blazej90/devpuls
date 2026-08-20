# ADR-0001: Architektura MVP — PWA + Web Push zamiast natywnej appki

**Status:** Accepted
**Data:** 2026-08-20

## Kontekst

Chcemy dostawać spersonalizowane powiadomienia o nowinkach technicznych (TypeScript,
React, JS, Fullstack, AI developer), streszczone po polsku, z linkiem do oryginalnego
źródła. Trzeba było wybrać, w jakiej formie dostarczyć powiadomienia użytkownikowi.

## Rozważane opcje

1. **Natywna appka mobilna** (np. React Native/Expo) — publikacja wymaga Apple Developer
   Program (99 USD/rok) i Google Play (25 USD jednorazowo); na iOS nawet appka wyłącznie
   do własnego użytku wymaga płatnego konta, bo darmowe konto Apple nie ma entitlementu
   push notifications.
2. **Bot na Telegramie** — najmniejszy nakład pracy i zero kosztów, ale poza ekosystemem
   "appki" — brak własnego UI/listy newsów.
3. **PWA + Web Push API** — zero kosztów sklepów, działa na Androidzie (Chrome) od dawna,
   na iOS od wersji 16.4+ (Safari, po dodaniu do ekranu głównego), bez Firebase.

## Decyzja

Idziemy w PWA + Web Push. Nie wymaga kont deweloperskich Apple/Google ani żadnej usługi
push innej niż standardowe API przeglądarki. Wykorzystuje istniejące umiejętności
frontendowe (Next.js, TypeScript, shadcn/ui).

## Konsekwencje

- Na iOS subskrypcje push mogą wygasać po dłuższej nieaktywności appki — potrzebne jest
  UI przypominające o ponownym udzieleniu zgody.
- Świadomie rezygnujemy z obecności w App Store/Google Play na tym etapie — appkę
  instaluje się przez "Dodaj do ekranu głównego".
- Harmonogram pobierania źródeł nie może opierać się na Vercel Cron (plan Hobby pozwala
  tylko na 1 uruchomienie dziennie) — pipeline uruchamiamy przez GitHub Actions.
- Jeśli w przyszłości pojawi się potrzeba obecności w sklepach (np. dystrybucja do
  szerszego grona), decyzja do zrewidowania w osobnym ADR.
