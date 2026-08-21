-- Migracja 004 — dziennik przebiegów agenta (Faza 8: monitoring).
--
-- Do tej pory nieudany przebieg był widoczny wyłącznie w logu GitHub Actions.
-- Przy cronie co 2 dni (ADR-0002) cicha awaria — padnięte źródło, wyczerpany
-- limit API, feed zwracający 200 z pustą listą — mogła zostać niezauważona
-- przez tydzień. Zapis idzie do bazy, bo tylko ona jest wspólna dla agenta
-- i appki: appka pokazuje ostatni stan bez dostępu do GitHuba.
--
-- Świadomie NIE trzymamy tu logów per wpis — to dziennik zdrowia, nie audyt.
-- Jeden wiersz na przebieg, szczegóły błędów w `errors` jako JSONB.

CREATE TABLE IF NOT EXISTS runs (
  id             BIGSERIAL PRIMARY KEY,
  started_at     TIMESTAMPTZ NOT NULL,
  finished_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms    INTEGER     NOT NULL DEFAULT 0,
  -- ok = bez zastrzeżeń, degraded = przeszedł, ale coś padło,
  -- failed = przebieg przerwany (wyjątek albo zero działających źródeł).
  status         TEXT        NOT NULL CHECK (status IN ('ok', 'degraded', 'failed')),
  sources_ok     INTEGER     NOT NULL DEFAULT 0,
  sources_failed INTEGER     NOT NULL DEFAULT 0,
  candidates     INTEGER     NOT NULL DEFAULT 0,
  fresh          INTEGER     NOT NULL DEFAULT 0,
  assessed       INTEGER     NOT NULL DEFAULT 0,
  delivered      INTEGER     NOT NULL DEFAULT 0,
  errors         JSONB       NOT NULL DEFAULT '[]'::jsonb
);

-- Appka i /api/health pytają wyłącznie o ostatni przebieg.
CREATE INDEX IF NOT EXISTS runs_finished_idx ON runs (finished_at DESC);
