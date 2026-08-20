-- Migracja 001 — schemat startowy DevPuls (patrz docs/ARCHITECTURE.md §7).
-- Uruchamiaj przez `pnpm agent:migrate`. Wszystko jest idempotentne, więc
-- powtórne wykonanie na istniejącej bazie niczego nie zepsuje.

-- Źródła z packages/agent/config/sources.json. Id jest tekstowe ("hn",
-- "reddit-reactjs"), bo pochodzi z configu, a nie z sekwencji.
CREATE TABLE IF NOT EXISTS sources (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('rss', 'atom', 'scrape')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wpisy po ocenie przez Claude. UNIQUE na url to jednocześnie mechanizm
-- deduplikacji (pipeline robi ON CONFLICT (url) DO NOTHING).
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

-- Lista w UI: najnowsze trafne wpisy.
CREATE INDEX IF NOT EXISTS items_relevance_published_idx
  ON items (relevance_score DESC, published_at DESC NULLS LAST);

-- "Co jeszcze nie poszło pushem" — częste zapytanie pipeline'u.
CREATE INDEX IF NOT EXISTS items_pending_notification_idx
  ON items (created_at DESC)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS items_source_id_idx ON items (source_id);

-- Subskrypcje Web Push. keys_json trzyma { p256dh, auth } prosto z
-- PushSubscription.toJSON() w przeglądarce.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint   TEXT NOT NULL UNIQUE,
  keys_json  JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
