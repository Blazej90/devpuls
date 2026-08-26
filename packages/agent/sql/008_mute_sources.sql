-- Migration 008 — muting a source (Phase 11).
--
-- A timestamp rather than a BOOLEAN, consistently with `read_at`, `deleted_at`
-- and `starred_at`: it records **when** a source went quiet, which is what makes
-- it possible one day to tell "muted from the start" from "muted last week".
-- Nullable, so existing rows need no backfill.
--
-- Muting works on two levels at once:
--   * the agent skips the source entirely — no fetch, no Claude call, no insert
--     (`packages/agent/src/pipeline.ts`),
--   * the app hides everything from that source, including the tab counters and
--     the PWA badge (`apps/web/lib/items.ts`).
--
-- Nothing is deleted, so unmuting brings back the items collected earlier. What
-- does not come back is the period of silence itself: the agent was not
-- fetching then, and an RSS feed only carries its most recent entries.
--
-- The column deliberately lives on `sources` rather than on
-- `push_subscriptions`, where the relevance threshold and the categories sit.
-- Those are per-device settings for **notifications**, while the inbox is one
-- shared list — a per-device mute would mean the inbox showing something the
-- notification never mentioned.

ALTER TABLE sources
  ADD COLUMN IF NOT EXISTS muted_at TIMESTAMPTZ;

-- No index: `sources` holds a dozen rows and every query touching it reads the
-- whole table anyway.
