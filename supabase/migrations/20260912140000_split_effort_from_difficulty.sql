-- Difficulty was doing two unrelated jobs: it set the money compounding
-- multiplier AND the XP bucket. That forced a trade-off -- throttling a daily
-- keystone habit's money growth also quietly cut the XP it earned.
--
-- effort_weight now owns XP. difficulty keeps owning money growth only.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS effort_weight INTEGER;

-- Backfill from difficulty so every existing task earns exactly the XP it
-- earns today. Nothing changes until a task is deliberately re-tuned.
UPDATE public.tasks
  SET effort_weight = difficulty
  WHERE effort_weight IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN effort_weight SET DEFAULT 3;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_effort_weight_range
  CHECK (effort_weight IS NULL OR (effort_weight >= 1 AND effort_weight <= 5));
