-- `streak_bonus` marks the completion that closed a 7-cycle. Whether that
-- cycle actually raised the task's pay is a separate question: the raise only
-- lands once the whole day is cleared (>= 80% of due tasks done). The two were
-- stored as one flag, so undoing a cycle-closing completion that never got a
-- raise still divided the pay by the multiplier -- every tick/undo round trip
-- on day 7 shrank the task (200 -> 133 -> 89 -> 59 at 1.5x).
--
-- `raise_granted` records whether the raise has landed for this completion.
-- The app grants it as soon as the day clears (even if the cycle closed early
-- in the day) and takes it back if the day stops being cleared.
ALTER TABLE public.task_completions
  ADD COLUMN IF NOT EXISTS raise_granted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.task_completions.raise_granted IS
  'True once the pay raise for this cycle-closing completion has been applied '
  'to the task. Only meaningful when streak_bonus is true.';
