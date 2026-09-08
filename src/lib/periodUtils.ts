import { format } from 'date-fns';
import { Task } from '@/types/task';

/**
 * Period math for "at-least N per week/month" tasks.
 *
 * Everything in here works on `yyyy-MM-dd` STRINGS rather than Date objects.
 * That is deliberate: `new Date('2026-09-09')` is parsed as UTC midnight while
 * `new Date(2026, 8, 9)` is local midnight, so mixing the two shifts every
 * comparison by the UTC offset and silently drops the last day of a period for
 * anyone east of Greenwich. Lexicographic comparison of `yyyy-MM-dd` is exact.
 *
 * Weeks run Monday -> Sunday, matching the streak logic in streakUtils.
 */

export const toKey = (d: Date): string => format(d, 'yyyy-MM-dd');

/** Parse a `yyyy-MM-dd` key at local noon, which is DST-safe for day math. */
export const fromKey = (key: string): Date => new Date(`${key}T12:00:00`);

/** Monday of the week containing `key`. */
export function weekStartKey(key: string): string {
  const d = fromKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Sun -> 6, Mon -> 0
  return toKey(d);
}

/** Sunday of the week containing `key`. */
export function weekEndKey(key: string): string {
  const d = fromKey(weekStartKey(key));
  d.setDate(d.getDate() + 6);
  return toKey(d);
}

/** First day of the month containing `key`. */
export const monthStartKey = (key: string): string => `${key.slice(0, 7)}-01`;

/** Last day of the month containing `key`. */
export function monthEndKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return toKey(new Date(y, m, 0)); // day 0 of next month = last day of this one
}

/** Inclusive [start, end] of the period `key` falls in. */
export function periodRange(key: string, unit: 'week' | 'month'): [string, string] {
  return unit === 'week'
    ? [weekStartKey(key), weekEndKey(key)]
    : [monthStartKey(key), monthEndKey(key)];
}

export function periodUnitFor(task: Task): 'week' | 'month' | null {
  if (task.frequencyType === 'at-least-weekly') return 'week';
  if (task.frequencyType === 'at-least-monthly') return 'month';
  return null;
}

/** Successful (money-earning) completions inside the period containing `key`. */
export function successesInPeriod(task: Task, key: string, unit: 'week' | 'month'): number {
  const [start, end] = periodRange(key, unit);
  return task.completions.filter(
    (c) => c.earnedAmount > 0 && c.date >= start && c.date <= end,
  ).length;
}

/** How many days are left in the period, counting `key` itself. */
export function daysLeftInPeriod(key: string, unit: 'week' | 'month'): number {
  const [, end] = periodRange(key, unit);
  const ms = fromKey(end).getTime() - fromKey(key).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Whether a flexible task can still afford a no-penalty day off on `date`:
 * true only when the remaining days *after* today are enough to hit the quota.
 *
 * This is the single source of truth — TaskCard and TimelineView previously
 * carried two near-copies of it that disagreed on where the week starts.
 */
export function canAffordDayOff(task: Task, date: Date): boolean {
  const unit = periodUnitFor(task);
  if (!unit) return false;
  const key = toKey(date);
  const quota = Math.max(1, task.frequencyValue as number);
  const remainingRequired = Math.max(0, quota - successesInPeriod(task, key, unit));
  return daysLeftInPeriod(key, unit) - 1 >= remainingRequired;
}

/** Whether the flexible task has already met its quota for `date`'s period. */
export function quotaMet(task: Task, date: Date): boolean {
  const unit = periodUnitFor(task);
  if (!unit) return false;
  const key = toKey(date);
  return successesInPeriod(task, key, unit) >= Math.max(1, task.frequencyValue as number);
}
