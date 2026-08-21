-- Migracja 006 — ulubione wpisy (Faza 10, Etap 5).
--
-- Znacznik czasu, a nie flaga BOOLEAN: pozwala kiedyś posortować „ostatnio
-- dodane do ulubionych" i jest spójny z `read_at` oraz `deleted_at`, które
-- działają tak samo. Kolumna nullowalna, więc istniejące wiersze nie wymagają
-- backfillu.
--
-- Ulubione są **prostopadłe** do stanu przeczytania: wpis może być
-- jednocześnie przeczytany i ulubiony, a odhaczenie nie rusza gwiazdki.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;

-- Zakładka „Ulubione" pyta wyłącznie o oznaczone, w tym samym porządku
-- co reszta skrzynki (patrz migracja 005).
CREATE INDEX IF NOT EXISTS items_starred_idx
  ON items ((COALESCE(published_at, created_at)) DESC)
  WHERE starred_at IS NOT NULL AND deleted_at IS NULL;
