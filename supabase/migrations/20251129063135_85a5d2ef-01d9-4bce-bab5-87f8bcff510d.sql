-- Add base_amount and streaks_completed columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS base_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS streaks_completed integer NOT NULL DEFAULT 0;

-- Update existing tasks to set base_amount to current amount
UPDATE public.tasks SET base_amount = amount WHERE base_amount = 0;