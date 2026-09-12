-- The weekly digest is not about one task, but sent_reminders.task_id is
-- NOT NULL and the dedupe key is (task_id, reminder_date, reminder_type).
-- Allow task-less rows and dedupe those on the device instead.
ALTER TABLE public.sent_reminders
  ALTER COLUMN task_id DROP NOT NULL;

-- UNIQUE treats NULLs as distinct, so the existing constraint would let the
-- digest send repeatedly. A partial index covers the task-less rows.
CREATE UNIQUE INDEX IF NOT EXISTS sent_reminders_device_dedupe
  ON public.sent_reminders (device_id, reminder_date, reminder_type)
  WHERE task_id IS NULL;
