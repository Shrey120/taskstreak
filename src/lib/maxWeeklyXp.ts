import { format } from 'date-fns';
import { Task, DIFFICULTY_MULTIPLIERS } from '@/types/task';
import { TraitId, TRAITS, baseXpForDifficulty } from '@/lib/xpUtils';
import { getStreakCycleLength } from '@/lib/streakUtils';

/**
 * Estimate the maximum ADDITIONAL XP each trait can still gain between `from`
 * (inclusive) and the Sunday that ends `from`'s week (inclusive), assuming the
 * user completes every remaining due occurrence of every task perfectly.
 *
 * Mirrors TaskContext.completeTask:
 *   - Normal task: baseXp (per difficulty) per completion.
 *   - Count/rate task: perMinuteRate × minutes. For the CEILING we assume the
 *     realistic daily max of 120 minutes → base = round(perMinuteRate * 120).
 *     (In the app, actual minutes are uncapped; 120 is only this estimate's cap.)
 *   - Consistency bonus on normal days: round(base * 0.03 * streakBefore).
 *   - Mastery bonus on cycle completion: round(base * (difficultyMult - 1));
 *     resets streak. Same difficulty multiplier for all task types.
 *
 * Assumptions (documented so the number is honest):
 *   - Starts from each task's CURRENT streak — "perfect from here to Sunday".
 *   - Fixed schedules: counts due days in [from..Sunday] not already done.
 *   - at-least-weekly: remaining weekly quota, one per remaining day.
 *   - Count tasks: 120 min per due day (the ceiling).
 *   - Ignores day-off / missed toggles.
 */

const HOURLY_MAX_MINUTES = 120;

export interface TraitMaxXp {
  trait: TraitId;
  maxXp: number;
  occurrences: number;
}

export interface MaxWeeklyXpResult {
  weekEnd: string;
  perTrait: Record<TraitId, TraitMaxXp>;
  daysCounted: number;
}

const EMPTY = (): Record<TraitId, TraitMaxXp> =>
  TRAITS.reduce((m, t) => {
    m[t.id] = { trait: t.id, maxXp: 0, occurrences: 0 };
    return m;
  }, {} as Record<TraitId, TraitMaxXp>);

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function weekEndSunday(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  r.setDate(r.getDate() + daysUntilSunday);
  return r;
}

function dueOnDate(task: Task, date: Date): boolean {
  const dateStr = ymd(date);
  if (task.startDate > dateStr) return false;
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  const dayName = format(date, 'EEEE').toLowerCase();
  switch (task.frequencyType) {
    case 'weekly':
      return (task.frequencyValue as number[]).includes(dayOfWeek);
    case 'monthly':
      return (task.frequencyValue as number[]).includes(dayOfMonth);
    case 'specific-date':
      return task.frequencyValue === dateStr;
    case 'specific-day':
      return task.frequencyValue === dayName;
    default:
      return false;
  }
}

function countSuccessesThisWeek(task: Task, weekStart: Date, weekEnd: Date): number {
  return task.completions.filter((c) => {
    if (c.earnedAmount <= 0) return false;
    const cd = new Date(c.date);
    return cd >= weekStart && cd <= weekEnd;
  }).length;
}

/** Base XP for one completion at the ceiling (count → 120 min of perMinuteRate). */
function ceilingBaseXp(task: Task): number {
  if (task.isHourly) {
    return Math.round(Math.max(0, task.perMinuteRate) * HOURLY_MAX_MINUTES);
  }
  return baseXpForDifficulty(task.difficulty);
}

function awardForCompletion(task: Task, streakBefore: number, cycleLength: number): { xp: number; streakAfter: number } {
  const base = ceilingBaseXp(task);
  const newStreak = streakBefore + 1;
  const closesCycle = Number.isFinite(cycleLength) && cycleLength > 0 && newStreak === cycleLength;

  let xp = base;
  if (closesCycle) {
    const mult = DIFFICULTY_MULTIPLIERS[task.difficulty] || 1;
    const mastery = Math.round(base * (mult - 1));
    if (mastery > 0) xp += mastery;
    return { xp, streakAfter: 0 };
  }
  if (streakBefore > 0) {
    xp += Math.round(base * 0.03 * streakBefore);
  }
  return { xp, streakAfter: newStreak };
}

export function computeMaxWeeklyXp(tasks: Task[], from: Date = new Date()): MaxWeeklyXpResult {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const sunday = weekEndSunday(start);

  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const perTrait = EMPTY();

  const remainingDates: Date[] = [];
  for (let d = new Date(start); d <= sunday; d.setDate(d.getDate() + 1)) {
    remainingDates.push(new Date(d));
  }

  for (const task of tasks) {
    const cycleLength = getStreakCycleLength(task);
    let streak = task.currentStreak || 0;
    let completionDays = 0;

    if (task.frequencyType === 'at-least-weekly') {
      const quota = task.frequencyValue as number;
      const already = countSuccessesThisWeek(task, weekStart, sunday);
      const remainingQuota = Math.max(0, quota - already);
      completionDays = Math.min(remainingQuota, remainingDates.length);
    } else if (task.frequencyType === 'at-least-monthly') {
      const quota = task.frequencyValue as number;
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const alreadyMonth = task.completions.filter((c) => {
        if (c.earnedAmount <= 0) return false;
        const cd = new Date(c.date);
        return cd >= monthStart && cd <= monthEnd;
      }).length;
      const remainingQuota = Math.max(0, quota - alreadyMonth);
      completionDays = Math.min(remainingQuota, remainingDates.length);
    } else {
      for (const d of remainingDates) {
        if (!dueOnDate(task, d)) continue;
        const dStr = ymd(d);
        const alreadyDone = task.completions.some((c) => c.date === dStr && c.earnedAmount > 0);
        if (!alreadyDone) completionDays += 1;
      }
    }

    if (completionDays <= 0) continue;

    let taskXp = 0;
    for (let i = 0; i < completionDays; i++) {
      const { xp, streakAfter } = awardForCompletion(task, streak, cycleLength);
      taskXp += xp;
      streak = streakAfter;
    }

    for (const tr of task.traits) {
      if (!perTrait[tr]) continue;
      perTrait[tr].maxXp += taskXp;
      perTrait[tr].occurrences += completionDays;
    }
  }

  return {
    weekEnd: ymd(sunday),
    perTrait,
    daysCounted: remainingDates.length,
  };
}