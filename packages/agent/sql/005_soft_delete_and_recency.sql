-- Migracja 005 — miękkie usuwanie wpisów i poprawna kolejność (ADR-0003).
--
-- Dwie zmiany, bo dotykają tych samych indeksów.
--
-- 1. `deleted_at` zamiast twardego DELETE. `items.url` ma UNIQUE i to jedyny
--    mechanizm chroniący przed ponownym pobraniem artykułu (`ON CONFLICT (url)
--    DO NOTHING` w `insertItem`). Skasowanie wiersza sprawiłoby, że wpis wróci
--    przy najbliższym przebiegu — razem z powiadomieniem, bo `notified_at`
--    zniknęłoby wraz z nim. URL musi zostać w tabeli.
--
-- 2. Kolejność liczona z `COALESCE(published_at, created_at)`, nie z samego
--    `created_at`. `created_at` to moment zapisu przez agenta — w obrębie
--    jednego przebiegu praktycznie identyczny dla wszystkich wpisów, więc
--    faktyczną kolejnością była kolejność odpytywania źródeł. `COALESCE`,
--    bo część źródeł nie podaje daty publikacji.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Skrzynka: nieprzeczytane, od najnowszych. Zastępuje indeks z migracji 003,
-- który sortował po `created_at` i nie znał `deleted_at`.
DROP INDEX IF EXISTS items_unread_idx;

CREATE INDEX IF NOT EXISTS items_unread_idx
  ON items ((COALESCE(published_at, created_at)) DESC)
  WHERE read_at IS NULL AND deleted_at IS NULL;

-- Zakładki „Przeczytane" i „Wszystkie" — ten sam porządek, bez warunku na read_at.
CREATE INDEX IF NOT EXISTS items_recency_idx
  ON items ((COALESCE(published_at, created_at)) DESC)
  WHERE deleted_at IS NULL;
