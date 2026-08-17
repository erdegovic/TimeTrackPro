-- Retain the newest running timer per account before enforcing one active timer.
WITH ranked_running_timers AS (
  SELECT id,
    row_number() OVER (PARTITION BY user_id ORDER BY start_time DESC, id DESC) AS position
  FROM time_entries
  WHERE user_id IS NOT NULL AND end_time IS NULL AND duration IS NULL
)
UPDATE time_entries AS entry
SET end_time = entry.start_time, duration = 0
FROM ranked_running_timers AS ranked
WHERE entry.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_running_per_user
ON time_entries(user_id)
WHERE user_id IS NOT NULL AND end_time IS NULL AND duration IS NULL;
