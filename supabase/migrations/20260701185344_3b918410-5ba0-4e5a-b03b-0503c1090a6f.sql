CREATE TABLE IF NOT EXISTS public.subtask_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtask_id UUID NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  completed_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(subtask_id, completed_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subtask_completions TO anon, authenticated;
GRANT ALL ON public.subtask_completions TO service_role;

ALTER TABLE public.subtask_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access for subtask_completions"
ON public.subtask_completions
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_subtask_completions_device_date ON public.subtask_completions(device_id, completed_date);
CREATE INDEX IF NOT EXISTS idx_subtask_completions_task ON public.subtask_completions(task_id);