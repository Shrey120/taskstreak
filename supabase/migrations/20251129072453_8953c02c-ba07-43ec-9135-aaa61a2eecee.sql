-- Add hourly task fields to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_hourly boolean NOT NULL DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS per_minute_rate numeric NOT NULL DEFAULT 0;