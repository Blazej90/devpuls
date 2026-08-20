-- Migracja 003 — stan przeczytania wpisów (ADR-0002).
--
-- Do tej pory appka była rankingiem: lista sortowana po trafności, bez pojęcia
-- "nowe do przeczytania". Powiadomienie mówiło o wpisie, który lądował gdzieś
-- w środku listy, nieodróżnialny od tygodniowego.
--
-- Stan jest wspólny dla wszystkich urządzeń — użytkownik jest jeden, a osobna
-- skrzynka na telefon i desktop byłaby uciążliwa. Filtry powiadomień zostają
-- per subskrypcja (migracja 002), bo to inna właściwość: filtr należy do
-- urządzenia, przeczytanie do treści.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Skrzynka odbiorcza pyta wyłącznie o nieprzeczytane, posortowane od najnowszych.
-- Indeks częściowy, bo przeczytane z czasem będą przeważać.
CREATE INDEX IF NOT EXISTS items_unread_idx
  ON items (created_at DESC)
  WHERE read_at IS NULL;
