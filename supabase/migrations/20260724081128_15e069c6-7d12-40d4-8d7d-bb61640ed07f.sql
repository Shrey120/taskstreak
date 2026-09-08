
-- Add trait column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS trait TEXT NOT NULL DEFAULT 'discipline';

-- Trait XP totals per device+trait
CREATE TABLE IF NOT EXISTS public.trait_xp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  trait TEXT NOT NULL,
  total_xp INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (device_id, trait)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trait_xp TO anon, authenticated;
GRANT ALL ON public.trait_xp TO service_role;
ALTER TABLE public.trait_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access for trait_xp" ON public.trait_xp FOR ALL USING (true) WITH CHECK (true);

-- XP events log
CREATE TABLE IF NOT EXISTS public.xp_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  trait TEXT NOT NULL,
  task_id UUID,
  event_date DATE NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xp_events_device_idx ON public.xp_events(device_id);
CREATE INDEX IF NOT EXISTS xp_events_task_date_idx ON public.xp_events(task_id, event_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_events TO anon, authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access for xp_events" ON public.xp_events FOR ALL USING (true) WITH CHECK (true);
