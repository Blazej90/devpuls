-- Migration 004 — the agent's run log (Phase 8: monitoring).
--
-- Until now a failed run was visible only in the GitHub Actions log. With a
-- cron every 2 days (ADR-0002) a silent failure — a dead source, an exhausted
-- API quota, a feed returning 200 with an empty list — could go unnoticed for a
-- week. The record goes into the database because that is the only thing shared
-- between the agent and the app: the app can show the last state without any
-- access to GitHub.
--
-- We deliberately do NOT keep per-item logs here — this is a health log, not an
-- audit trail. One row per run, with the error details in `errors` as JSONB.

CREATE TABLE IF NOT EXISTS runs (
  id             BIGSERIAL PRIMARY KEY,
  started_at     TIMESTAMPTZ NOT NULL,
  finished_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms    INTEGER     NOT NULL DEFAULT 0,
  -- ok = no warnings, degraded = it went through but something failed,
  -- failed = the run was aborted (an exception or zero working sources).
  status         TEXT        NOT NULL CHECK (status IN ('ok', 'degraded', 'failed')),
  sources_ok     INTEGER     NOT NULL DEFAULT 0,
  sources_failed INTEGER     NOT NULL DEFAULT 0,
  candidates     INTEGER     NOT NULL DEFAULT 0,
  fresh          INTEGER     NOT NULL DEFAULT 0,
  assessed       INTEGER     NOT NULL DEFAULT 0,
  delivered      INTEGER     NOT NULL DEFAULT 0,
  errors         JSONB       NOT NULL DEFAULT '[]'::jsonb
);

-- The app and /api/health only ever ask for the last run.
CREATE INDEX IF NOT EXISTS runs_finished_idx ON runs (finished_at DESC);
