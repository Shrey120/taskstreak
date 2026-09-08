-- Drop existing tables to recreate without user auth dependency
DROP TABLE IF EXISTS public.task_completions CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;

-- Create tasks table with device_id instead of user_id
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  frequency_type TEXT NOT NULL,
  frequency_value JSONB NOT NULL,
  amount NUMERIC NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 5),
  current_streak INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create task_completions table
CREATE TABLE public.task_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  completed_date DATE NOT NULL,
  amount_earned NUMERIC NOT NULL,
  streak_bonus BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create wallet table to store balance per device
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  balance NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Create public access policies (no auth required)
CREATE POLICY "Public access for tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for completions" ON public.task_completions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access for wallets" ON public.wallets FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_tasks_device_id ON public.tasks(device_id);
CREATE INDEX idx_completions_task_id ON public.task_completions(task_id);
CREATE INDEX idx_completions_device_id ON public.task_completions(device_id);
CREATE INDEX idx_wallets_device_id ON public.wallets(device_id);