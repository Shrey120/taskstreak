-- The website/PWA is being retired in favour of the installed Android app,
-- which schedules everything on-device via @capacitor/local-notifications
-- and reads neither of these tables. Both existed purely to serve Web Push:
-- push_subscriptions held browser subscription endpoints, sent_reminders
-- deduped what the edge function had already sent. With the edge function
-- deleted, nothing writes or reads either one.
DROP TABLE IF EXISTS public.push_subscriptions;
DROP TABLE IF EXISTS public.sent_reminders;
