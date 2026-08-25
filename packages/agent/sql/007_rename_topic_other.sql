-- Migration 007 — rename the "inne" topic value to "other".
--
-- Topic values are code, not copy: they travel through the URL (?topic=...),
-- the Claude output schema and the push settings, so they follow the same
-- English naming rule as the rest of the codebase. Only the label shown in the
-- UI stays Polish ("Inne"), because that is what the reader sees.
--
-- Rows written before this migration still carry the old value, so it has to be
-- rewritten in place — the arrays are matched with `&&` against the new value
-- and would silently stop matching otherwise.

UPDATE items
SET topics = array_replace(topics, 'inne', 'other')
WHERE topics @> ARRAY['inne']::text[];

UPDATE push_subscriptions
SET topics = array_replace(topics, 'inne', 'other')
WHERE topics @> ARRAY['inne']::text[];
