import { useEffect } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { initReminders, rescheduleReminders } from '@/lib/notificationScheduler';

/**
 * Mounted inside TaskProvider. Schedules a local notification 5 minutes
 * before every upcoming task's scheduledTime.
 */
export function ReminderScheduler() {
  const { tasks } = useTasks();

  useEffect(() => {
    initReminders().catch((e) => console.warn('[reminders] init failed', e));
  }, []);

  useEffect(() => {
    rescheduleReminders(tasks).catch((e) => console.warn('[reminders] schedule failed', e));
    // Re-run periodically so "tomorrow" fires get scheduled after midnight.
    const iv = window.setInterval(() => {
      rescheduleReminders(tasks).catch(() => undefined);
    }, 15 * 60_000);
    return () => window.clearInterval(iv);
  }, [tasks]);

  return null;
}
