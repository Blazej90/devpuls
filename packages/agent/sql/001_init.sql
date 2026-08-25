-- Migration 001 — the initial DevPuls schema (see docs/ARCHITECTURE.md §7).
-- Run it through `pnpm agent:migrate`. Everything is idempotent, so running it
-- again on an existing database breaks nothing.

-- Sources from packages/agent/config/sources.json. The id is text ("hn",
-- "reddit-reactjs") because it comes from the config, not from a sequence.
CREATE TABLE IF NOT EXISTS sources (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('rss', 'atom', 'scrape')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items after Claude has assessed them. The UNIQUE on url doubles as the
-- deduplication mechanism (the pipeline does ON CONFLICT (url) DO NOTHING).
CREATE TABLE IF NOT EXISTS items (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       TEXT NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  url             TEXT NOT NULL UNIQUE,
  title_original  TEXT NOT NULL,
  summary_pl      TEXT,
  relevance_score SMALLINT CHECK (relevance_score BETWEEN 1 AND 5),
  published_at    TIMESTAMPTZ,
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The list in the UI: the newest relevant items.
CREATE INDEX IF NOT EXISTS items_relevance_published_idx
  ON items (relevance_score DESC, published_at DESC NULLS LAST);

-- "What has not been pushed yet" — a frequent pipeline query.
CREATE INDEX IF NOT EXISTS items_pending_notification_idx
  ON items (created_at DESC)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS items_source_id_idx ON items (source_id);

-- Web Push subscriptions. keys_json holds { p256dh, auth } straight from
-- PushSubscription.toJSON() in the browser.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint   TEXT NOT NULL UNIQUE,
  keys_json  JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
