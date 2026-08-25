-- Migration 003 — read state for items (ADR-0002).
--
-- Until now the app was a ranking: a list sorted by relevance with no notion of
-- "new, to be read". A notification announced an item that landed somewhere in
-- the middle of the list, indistinguishable from a week-old one.
--
-- The state is shared across all devices — there is a single user, and a
-- separate inbox for phone and desktop would be a nuisance. Notification
-- filters stay per subscription (migration 002), because that is a different
-- property: a filter belongs to the device, read state belongs to the content.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- The inbox asks only for unread items, newest first. A partial index, because
-- read items will outnumber the rest over time.
CREATE INDEX IF NOT EXISTS items_unread_idx
  ON items (created_at DESC)
  WHERE read_at IS NULL;
