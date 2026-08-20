-- Migracja 002 — tematy wpisów i ustawienia per subskrypcja.
--
-- Do tej pory `claude.ts` zwracał listę tematów, ale nigdzie jej nie zapisywaliśmy.
-- Bez tego nie da się filtrować listy w UI ani wysyłać pushy tylko z wybranych
-- kategorii. Ustawienia trzymamy przy subskrypcji, a nie w ENV agenta, żeby próg
-- dało się zmienić z poziomu appki bez redeployu.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS topics TEXT[];

-- Filtrowanie listy po kategorii.
CREATE INDEX IF NOT EXISTS items_topics_idx ON items USING GIN (topics);

-- Próg trafności per subskrypcja. Domyślne 4 zgodne z dotychczasowym
-- RELEVANCE_THRESHOLD, żeby istniejące subskrypcje nic nie straciły.
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS min_relevance SMALLINT NOT NULL DEFAULT 4;

-- Postgres nie zna ADD CONSTRAINT IF NOT EXISTS, a nie chcemy tu bloku $$ —
-- rozbijarka instrukcji w migrate.ts obsluguje wylacznie plaski DDL.
ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_min_relevance_check;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_min_relevance_check
  CHECK (min_relevance BETWEEN 1 AND 5);

-- NULL = wszystkie kategorie. Pusta tablica byłaby dwuznaczna, więc jej unikamy.
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS topics TEXT[];
