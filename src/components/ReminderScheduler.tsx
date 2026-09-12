import { useEffect } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { initReminders, rescheduleReminders } from '@/lib/notificationScheduler';

/**
 * Mounted inside TaskProvider. On native this schedules everything on-device:
 * a reminder before each task's scheduledTime, the 8pm streak-risk warning,
 * and the Sunday digest — so the installed app needs no server to alert you.
 *
 * Rebuilt on every task change, which is also what keeps the evening alerts'
 * baked-in wording from going stale after a completion.
 */
export function ReminderScheduler() {
  const { tasks, pauseRanges, dayOffSet } = useTasks();

  useEffect(() => {
    initReminders().catch((e) => console.warn('[reminders] init failed', e));
  }, []);

  useEffect(() => {
    const ctx = { pauseRanges, dayOffSet };
    rescheduleReminders(tasks, ctx).catch((e) => console.warn('[reminders] schedule failed', e));
    // Re-run periodically so "tomorrow" fires get scheduled after midnight.
    const iv = window.setInterval(() => {
      rescheduleReminders(tasks, ctx).catch(() => undefined);
    }, 15 * 60_000);
    return () => window.clearInterval(iv);
  }, [tasks, pauseRanges, dayOffSet]);

  return null;
}
