-- Add start_date column to tasks table
ALTER TABLE public.tasks ADD COLUMN start_date date NOT NULL DEFAULT CURRENT_DATE;