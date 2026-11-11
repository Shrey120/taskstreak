-- Per-task pauses. A pause_ranges row with a task_id pauses only that task
-- (eggs during a 9-day festival, gym for a month) while every other task
-- carries on. Rows without a task_id are the existing whole-app vacations.
--
-- end_date NULL means "until I resume": the task stays paused with no end
-- until it is resumed, which closes the range.
ALTER TABLE public.pause_ranges
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.pause_ranges
  ALTER COLUMN end_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS pause_ranges_task_id_idx ON public.pause_ranges(task_id);

COMMENT ON COLUMN public.pause_ranges.task_id IS
  'NULL = whole-app vacation; set = pauses only this task.';
COMMENT ON COLUMN public.pause_ranges.end_date IS
  'Inclusive last paused day. NULL = paused until resumed (task pauses only).';
