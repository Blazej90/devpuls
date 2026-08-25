-- Migration 002 — item topics and per-subscription settings.
--
-- Until now `claude.ts` returned a list of topics but we stored it nowhere.
-- Without it there is no way to filter the list in the UI or to push only
-- selected categories. The settings live with the subscription rather than in
-- the agent's ENV so the threshold can be changed from the app without a
-- redeploy.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS topics TEXT[];

-- Filtering the list by category.
CREATE INDEX IF NOT EXISTS items_topics_idx ON items USING GIN (topics);

-- Relevance threshold per subscription. The default of 4 matches the previous
-- RELEVANCE_THRESHOLD so existing subscriptions lose nothing.
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS min_relevance SMALLINT NOT NULL DEFAULT 4;

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, and we do not want a $$ block
-- here — the statement splitter in migrate.ts only handles flat DDL.
ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_min_relevance_check;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_min_relevance_check
  CHECK (min_relevance BETWEEN 1 AND 5);

-- NULL = all categories. An empty array would be ambiguous, so we avoid it.
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS topics TEXT[];
