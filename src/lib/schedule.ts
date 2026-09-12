import { Task, FrequencyType } from '@/types/task';
import { fromKey, toKey, weekStartKey, isMonthDayDue } from '@/lib/periodUtils';

/**
 * Scheduling rules that sit underneath both the streak engine and the views.
 *
 * Everything here answers one question — "is this task on the hook for this
 * date?" — and nothing here knows about completions. Whether a due day was
 * *met* is the streak engine's business; whether it was due at all is this
 * module's, and both used to be decided by five near-copies of the same
 * switch statement that had already drifted apart.
 */

/** `frequencyValue` shape for the `every-n-weeks` frequency type. */
export interface EveryNWeeksValue {
  /** 2 = every other week, 3 = every third week. Always >= 1. */
  interval: number;
  /** Days of week, JS `getDay()` convention: 0 = Sunday. */
  days: number[];
  /** Any date inside a week that IS an "on" week, as `yyyy-MM-dd`. */
  anchor: string;
}

export function isEveryNWeeksValue(v: unknown): v is EveryNWeeksValue {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.interval === 'number' && Array.isArray(o.days) && typeof o.anchor === 'string';
}

/** Whole weeks between two week-start keys. Always >= 0 via abs. */
function weeksBetween(aKey: string, bKey: string): number {
  const ms = fromKey(bKey).getTime() - fromKey(aKey).getTime();
  return Math.abs(Math.round(ms / 86_400_000 / 7));
}

/**
 * Fold the legacy `specific-day` type into `weekly`.
 *
 * `specific-day` stored a single day *name* and was in every respect a
 * `weekly` task with one day ticked — two code paths, one behaviour. Stored
 * rows are normalized on read rather than migrated in place, so old data keeps
 * working and nothing new is ever written in the old shape.
 */
const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export function normalizeFrequency(
  frequencyType: FrequencyType,
  frequencyValue: unknown,
): { frequencyType: FrequencyType; frequencyValue: Task['frequencyValue'] } {
  if (frequencyType === 'specific-day') {
    const idx = DAY_NAME_TO_INDEX[String(frequencyValue).toLowerCase()];
    if (idx !== undefined) {
      return { frequencyType: 'weekly', frequencyValue: [idx] };
    }
  }
  return { frequencyType, frequencyValue: frequencyValue as Task['frequencyValue'] };
}

/**
 * Is `task` on the schedule for `date`, ignoring completions and pauses?
 *
 * Flexible ("at least N per period") tasks have no fixed due days, so they
 * report true for every in-range date; the streak engine handles their quota
 * with period-aware helpers instead.
 */
export function isTaskDueOn(task: Task, date: Date): boolean {
  const dateStr = toKey(date);
  if (task.startDate > dateStr) return false;

  switch (task.frequencyType) {
    case 'weekly':
      return (task.frequencyValue as number[]).includes(date.getDay());
    case 'monthly':
      return isMonthDayDue(task.frequencyValue as number[], date);
    case 'every-n-weeks': {
      const v = task.frequencyValue;
      if (!isEveryNWeeksValue(v)) return false;
      if (!v.days.includes(date.getDay())) return false;
      const interval = Math.max(1, Math.floor(v.interval));
      if (interval === 1) return true;
      return weeksBetween(weekStartKey(v.anchor), weekStartKey(dateStr)) % interval === 0;
    }
    case 'specific-date':
      return task.frequencyValue === dateStr;
    case 'specific-day': {
      // Defensive: normalizeFrequency should have folded these away on read.
      const norm = normalizeFrequency('specific-day', task.frequencyValue);
      if (norm.frequencyType !== 'weekly') return false;
      return (norm.frequencyValue as number[]).includes(date.getDay());
    }
    case 'at-least-weekly':
    case 'at-least-monthly':
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Vacation / pause ranges
// ---------------------------------------------------------------------------

/** Inclusive `yyyy-MM-dd` range during which every task is off the hook. */
export interface PauseRange {
  id: string;
  start: string;
  end: string;
  label?: string;
}

export function isPausedOn(ranges: PauseRange[], dateStr: string): boolean {
  return ranges.some((r) => dateStr >= r.start && dateStr <= r.end);
}

/** Every date covered by any range, as `yyyy-MM-dd` keys. */
export function pausedDatesIn(ranges: PauseRange[], fromStr: string, toStr: string): Set<string> {
  const out = new Set<string>();
  for (const r of ranges) {
    const start = r.start > fromStr ? r.start : fromStr;
    const end = r.end < toStr ? r.end : toStr;
    if (start > end) continue;
    const cursor = fromKey(start);
    for (let i = 0; i < 4000; i++) {
      const key = toKey(cursor);
      if (key > end) break;
      out.add(key);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return out;
}

export function normalizeRange(start: string, end: string): { start: string; end: string } {
  return start <= end ? { start, end } : { start: end, end: start };
}
