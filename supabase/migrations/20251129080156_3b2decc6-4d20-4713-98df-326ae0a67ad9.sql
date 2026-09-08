-- Create subtasks table
CREATE TABLE public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  device_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (matching tasks table pattern)
CREATE POLICY "Public access for subtasks" 
ON public.subtasks 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX idx_subtasks_task_id ON public.subtasks(task_id);