-- Migration 006 — favourite items (Phase 10, Stage 5).
--
-- A timestamp rather than a BOOLEAN flag: it makes it possible to sort by
-- "recently starred" one day and it is consistent with `read_at` and
-- `deleted_at`, which work the same way. The column is nullable, so existing
-- rows need no backfill.
--
-- Starring is **orthogonal** to read state: an item can be read and starred at
-- the same time, and marking it read never touches the star.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ;

-- The "Starred" tab asks only for starred items, in the same order as the rest
-- of the inbox (see migration 005).
CREATE INDEX IF NOT EXISTS items_starred_idx
  ON items ((COALESCE(published_at, created_at)) DESC)
  WHERE starred_at IS NOT NULL AND deleted_at IS NULL;
