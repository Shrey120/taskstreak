-- Move per-device UI state into Postgres so the same login sees the same
-- data on every device. Each of these tables previously lived in
-- localStorage, which meant phone and laptop silently disagreed.

-- Days a task was deliberately skipped (streak-neutral, no penalty).
CREATE TABLE IF NOT EXISTS public.task_skips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  skip_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, skip_date)
);

-- Subtasks marked "couldn't do it today" — streak-neutral, unlike a miss.
CREATE TABLE IF NOT EXISTS public.subtask_missed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  subtask_id UUID NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  missed_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subtask_id, missed_date)
);

-- Vacation / pause windows. Inclusive of both end dates.
CREATE TABLE IF NOT EXISTS public.pause_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- Free-form capture list previously held only in the browser.
CREATE TABLE IF NOT EXISTS public.stack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_skips_device ON public.task_skips(device_id);
CREATE INDEX IF NOT EXISTS idx_subtask_missed_device ON public.subtask_missed(device_id);
CREATE INDEX IF NOT EXISTS idx_pause_ranges_device ON public.pause_ranges(device_id);
CREATE INDEX IF NOT EXISTS idx_stack_items_device ON public.stack_items(device_id);

ALTER TABLE public.task_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtask_missed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pause_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_items ENABLE ROW LEVEL SECURITY;

-- NOTE: these match the permissive policies already on every other table in
-- this schema. They are NOT real access control -- the anon key is public, so
-- anyone can read and write these rows. Tightening this needs Supabase Auth
-- across the whole schema at once; see the note in the handover.
CREATE POLICY "Public access for task_skips" ON public.task_skips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for subtask_missed" ON public.subtask_missed FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for pause_ranges" ON public.pause_ranges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for stack_items" ON public.stack_items FOR ALL USING (true) WITH CHECK (true);
