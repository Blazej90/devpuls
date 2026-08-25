-- Migration 005 — soft-deleting items and correct ordering (ADR-0003).
--
-- Two changes, because they touch the same indexes.
--
-- 1. `deleted_at` instead of a hard DELETE. `items.url` has a UNIQUE constraint
--    and that is the only mechanism protecting against fetching an article
--    again (`ON CONFLICT (url) DO NOTHING` in `insertItem`). Dropping the row
--    would bring the item back on the next run — with a notification, because
--    `notified_at` would disappear along with it. The URL has to stay.
--
-- 2. Ordering computed from `COALESCE(published_at, created_at)` rather than
--    `created_at` alone. `created_at` is the moment the agent stored the item —
--    practically identical for every item within one run, so the real ordering
--    was the order in which sources were polled. `COALESCE`, because some
--    sources give no publication date.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- The inbox: unread, newest first. Replaces the index from migration 003, which
-- sorted by `created_at` and knew nothing about `deleted_at`.
DROP INDEX IF EXISTS items_unread_idx;

CREATE INDEX IF NOT EXISTS items_unread_idx
  ON items ((COALESCE(published_at, created_at)) DESC)
  WHERE read_at IS NULL AND deleted_at IS NULL;

-- The "Read" and "All" tabs — the same ordering, without the read_at condition.
CREATE INDEX IF NOT EXISTS items_recency_idx
  ON items ((COALESCE(published_at, created_at)) DESC)
  WHERE deleted_at IS NULL;
