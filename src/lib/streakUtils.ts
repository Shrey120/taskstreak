import { format } from 'date-fns';
import { Task } from '@/types/task';
import { isTaskDueOn, getAtLeastConfig } from '@/lib/schedule';

/**
 * How many consecutive successful completions make up one full "streak cycle"
 * for a task. Reaching this many in a row triggers the streak bonus (rate
 * increase / difficulty multiplier) and wraps the streak counter back to 0.
 *
 * For fixed-schedule tasks the cycle equals one full round of the schedule
 * (e.g. 3 selected weekdays -> cycle of 3). For flexible "at-least-N-per-period"
 * tasks the cycle is capped at 7 so bonuses still fire on a familiar cadence,
 * regardless of quota size.
 */
export function getStreakCycleLength(task: Task): number {
  // Every recurring habit type uses the same 7-consecutive-completions cycle
  // for bonus/multiplier purposes. Only truly one-off tasks (`specific-date`)
  // have no cycle. What counts as a "consecutive completion" varies by
  // frequency type and is handled by computeCurrentStreak /
  // computeAtLeastRawStreak — not here.
  switch (task.frequencyType) {
    case 'weekly':
    case 'monthly':
    case 'every-n-weeks':
    case 'specific-day':
    case 'at-least-weekly':
    case 'at-least-monthly':
      return 7;
    case 'specific-date':
      return Infinity;
    default:
      return 7;
  }
}


/**
 * Thin alias kept for the streak engine's own call sites. The rules live in
 * `@/lib/schedule` so the views and the streak maths cannot drift apart.
 */
export function isTaskDueOnDateGeneric(task: Task, date: Date): boolean {
  return isTaskDueOn(task, date);
}

// ---------------------------------------------------------------------------
// Period helpers for at-least-weekly / at-least-monthly streaks.
// Weeks run Monday -> Sunday.
// ---------------------------------------------------------------------------

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7; // Sun -> 6, Mon -> 0, ...
  d.setDate(d.getDate() - diffToMon);
  return format(d, 'yyyy-MM-dd'); // Monday-of-week key
}

function prevWeekKey(mondayKey: string): string {
  const d = new Date(mondayKey + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  return format(d, 'yyyy-MM-dd');
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // yyyy-MM
}

function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  // m is 1-based; previous month with wrap
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  return `${String(prevY).padStart(4, '0')}-${String(prevM).padStart(2, '0')}`;
}

/**
 * Compute the RAW (pre-cycle-modulo) streak for an at-least-N-per-period task
 * anchored at `anchorDateStr`. Includes all successes in the anchor's period,
 * then walks backward one period at a time: each fully-elapsed prior period
 * contributes its successes only if it met the quota. The first prior period
 * that failed to meet quota terminates the walk.
 *
 * Pass successDates WITHOUT the anchor completion when computing the pre-
 * increment base for a NEW completion; pass all successDates when recomputing
 * from full history.
 */
export function computeAtLeastRawStreak(
  task: Task,
  successDates: string[],
  anchorDateStr: string,
  unit: 'week' | 'month',
): number {
  const { quota } = getAtLeastConfig(task.frequencyValue);
  const getKey = unit === 'week' ? getWeekKey : getMonthKey;
  const prevKey = unit === 'week' ? prevWeekKey : prevMonthKey;

  const byPeriod = new Map<string, number>();
  for (const d of successDates) {
    const k = getKey(d);
    byPeriod.set(k, (byPeriod.get(k) || 0) + 1);
  }

  const anchorKey = getKey(anchorDateStr);
  let total = byPeriod.get(anchorKey) || 0;

  let cursor = prevKey(anchorKey);
  // Safety cap ~10 years of weekly walks / months.
  for (let i = 0; i < 600; i++) {
    const cnt = byPeriod.get(cursor) || 0;
    if (cnt < quota) break; // fully-elapsed prior period failed to meet quota
    total += cnt;
    cursor = prevKey(cursor);
  }

  return total;
}

function countRunLength(
  task: Task,
  successSet: Set<string>,
  fromDateStr: string,
  excluded: Set<string>,
): number {
  let run = 1;
  let cursor = new Date(fromDateStr + 'T12:00:00');
  for (let i = 0; i < 400; i++) {
    let prevDueStr: string | null = null;
    for (let d = 1; d <= 120; d++) {
      const check = new Date(cursor);
      check.setDate(check.getDate() - d);
      const checkStr = format(check, 'yyyy-MM-dd');
      if (checkStr < task.startDate) break;
      if (!isTaskDueOnDateGeneric(task, check)) continue;
      if (excluded.has(checkStr)) continue; // streak-neutral, skip
      prevDueStr = checkStr;
      break;
    }
    if (prevDueStr && successSet.has(prevDueStr)) {
      run++;
      cursor = new Date(prevDueStr + 'T12:00:00');
    } else {
      break;
    }
  }
  return run;
}

/**
 * Correct current streak for a task from its full completion history,
 * wrapping at the task's own cycle length. Handles at-least-* separately with
 * period-aware quota checks so completing on non-consecutive calendar days
 * does not reset the streak.
 *
 * `excludedDates` are dates that are streak-neutral for fixed-schedule tasks
 * (e.g. day-off / skipped days, or dates where a subtask was marked missed
 * without a full task completion). They are treated as if not due at all.
 */
export function computeCurrentStreak(
  task: Task,
  completions: { date: string; earnedAmount: number }[],
  todayStr: string,
  excludedDates?: Set<string> | Iterable<string>,
): number {
  const successDates = completions.filter((c) => c.earnedAmount > 0).map((c) => c.date);
  if (successDates.length === 0) return 0;

  const excluded: Set<string> = excludedDates instanceof Set
    ? excludedDates
    : new Set(excludedDates || []);

  const cycleLength = getStreakCycleLength(task);

  if (task.frequencyType === 'at-least-weekly' || task.frequencyType === 'at-least-monthly') {
    const unit: 'week' | 'month' =
      task.frequencyType === 'at-least-weekly' ? 'week' : 'month';
    const latest = [...successDates].sort().reverse()[0];
    const raw = computeAtLeastRawStreak(task, successDates, latest, unit);
    if (!Number.isFinite(cycleLength) || cycleLength <= 0) return raw;
    return raw % cycleLength;
  }

  const successSet = new Set(successDates);
  const sorted = [...successDates].sort().reverse();
  const lastSuccessStr = sorted[0];
  const lastSuccessDate = new Date(lastSuccessStr + 'T12:00:00');
  for (let d = 1; d <= 366; d++) {
    const check = new Date(lastSuccessDate);
    check.setDate(check.getDate() + d);
    const checkStr = format(check, 'yyyy-MM-dd');
    if (checkStr >= todayStr) break;
    if (excluded.has(checkStr)) continue;
    if (isTaskDueOnDateGeneric(task, check) && !successSet.has(checkStr)) {
      return 0;
    }
  }

  const runLength = countRunLength(task, successSet, lastSuccessStr, excluded);
  if (!Number.isFinite(cycleLength) || cycleLength <= 0) return runLength;
  return runLength % cycleLength;
}
