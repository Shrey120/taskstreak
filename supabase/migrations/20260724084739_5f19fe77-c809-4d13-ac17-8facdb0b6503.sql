
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access push_subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX push_subscriptions_device_idx ON public.push_subscriptions(device_id);

CREATE TABLE public.sent_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  task_id UUID NOT NULL,
  reminder_date DATE NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'pre-5min',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, reminder_date, reminder_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sent_reminders TO anon, authenticated;
GRANT ALL ON public.sent_reminders TO service_role;
ALTER TABLE public.sent_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access sent_reminders" ON public.sent_reminders FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX sent_reminders_lookup_idx ON public.sent_reminders(reminder_date, task_id);
