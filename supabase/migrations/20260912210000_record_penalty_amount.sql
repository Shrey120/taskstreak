-- A failed task deducts its CURRENT amount from the wallet, but the completion
-- row only ever stored earnedAmount = 0. The figure actually charged was
-- thrown away, which broke two things:
--
--   * Undoing a failure recomputed the refund from the task's amount TODAY.
--     Amounts compound on every streak cycle, so if a raise landed between
--     failing and undoing, the refund exceeded the charge -- free money, up
--     to the difficulty multiplier (as much as 4x).
--   * The weekly/monthly report valued every past failure at today's amount,
--     so an old miss was reported at the compounded rate rather than what it
--     cost at the time.
--
-- Recording the charge makes both exact from here on.
ALTER TABLE public.task_completions
  ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC;

COMMENT ON COLUMN public.task_completions.penalty_amount IS
  'Wallet amount actually deducted when this task was failed. NULL for rows '
  'written before this column existed, and for successful completions.';
