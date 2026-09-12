import { Task } from '@/types/task';
import { TraitId, TRAITS } from '@/lib/xpUtils';
import { isTaskDueOn, PauseRange, isPausedOn } from '@/lib/schedule';
import { toKey, fromKey } from '@/lib/periodUtils';

/**
 * "Who am I becoming?" — the numbers the app already has, compared against
 * the period before.
 *
 * A single period's totals say almost nothing on their own; the whole value
 * is in the delta, so every figure here is paired with its predecessor.
 */

export type ReportUnit = 'week' | 'month';

export interface TraitDelta {
  trait: TraitId;
  xp: number;
  prevXp: number;
}

export interface PeriodReport {
  unit: ReportUnit;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;

  earned: number;
  prevEarned: number;
  lost: number;
  prevLost: number;

  /** Days the task was due and completed for money. */
  completed: number;
  /** Days the task was due at all (pauses and skips excluded). */
  due: number;
  prevCompleted: number;
  prevDue: number;

  traits: TraitDelta[];
  /** Mon..Sun completion counts, index 0 = Monday. */
  byWeekday: number[];
  bestWeekday: number | null;
  worstWeekday: number | null;
  /** Tasks ranked by missed due days, worst first. */
  mostMissed: { taskId: string; name: string; missed: number }[];
  pausedDays: number;
}

const DAY_MS = 86_400_000;

export function periodBounds(ref: Date, unit: ReportUnit): { start: string; end: string } {
  if (unit === 'week') {
    const d = new Date(ref);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    return { start: toKey(d), end: toKey(end) };
  }
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { start: toKey(start), end: toKey(end) };
}

function previousBounds(start: string, unit: ReportUnit): { start: string; end: string } {
  const d = fromKey(start);
  if (unit === 'week') d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return periodBounds(d, unit);
}

function eachDay(start: string, end: string): Date[] {
  const out: Date[] = [];
  const cursor = fromKey(start);
  const last = fromKey(end).getTime();
  while (cursor.getTime() <= last && out.length < 400) {
    out.push(new Date(cursor));
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return out;
}

interface Window {
  earned: number;
  lost: number;
  completed: number;
  due: number;
  byWeekday: number[];
  missed: Map<string, number>;
  pausedDays: number;
}

function measure(
  tasks: Task[],
  start: string,
  end: string,
  pauses: PauseRange[],
  skipSet: Set<string>,
  today: string,
): Window {
  const w: Window = {
    earned: 0, lost: 0, completed: 0, due: 0,
    byWeekday: [0, 0, 0, 0, 0, 0, 0], missed: new Map(), pausedDays: 0,
  };

  for (const date of eachDay(start, end)) {
    const key = toKey(date);
    if (key > today) break; // don't count the future as missed
    if (isPausedOn(pauses, key)) { w.pausedDays++; continue; }
    const mondayIndex = (date.getDay() + 6) % 7;

    for (const task of tasks) {
      const completion = task.completions.find((c) => c.date === key);
      if (completion) {
        if (completion.earnedAmount > 0) {
          w.earned += completion.earnedAmount;
          w.completed++;
          w.byWeekday[mondayIndex]++;
        } else {
          // A zero-earning completion is a recorded failure, which cost the
          // task's amount at the time it was taken.
          w.lost += task.amount;
        }
      }
      // Flexible tasks have no fixed due days, so they can't be "missed".
      if (task.frequencyType === 'at-least-weekly' || task.frequencyType === 'at-least-monthly') continue;
      if (!isTaskDueOn(task, date)) continue;
      if (skipSet.has(`${task.id}|${key}`)) continue;
      w.due++;
      if (!completion || completion.earnedAmount <= 0) {
        w.missed.set(task.id, (w.missed.get(task.id) || 0) + 1);
      }
    }
  }
  return w;
}

export function buildPeriodReport(
  tasks: Task[],
  xpEvents: { trait: TraitId; date: string; amount: number }[],
  pauses: PauseRange[],
  skipSet: Set<string>,
  unit: ReportUnit,
  ref: Date = new Date(),
): PeriodReport {
  const today = toKey(new Date());
  const { start, end } = periodBounds(ref, unit);
  const prev = previousBounds(start, unit);

  const cur = measure(tasks, start, end, pauses, skipSet, today);
  const old = measure(tasks, prev.start, prev.end, pauses, skipSet, today);

  const xpIn = (from: string, to: string) => {
    const totals = {} as Record<TraitId, number>;
    for (const t of TRAITS) totals[t.id] = 0;
    for (const e of xpEvents) {
      if (e.date >= from && e.date <= to && totals[e.trait] !== undefined) totals[e.trait] += e.amount;
    }
    return totals;
  };
  const curXp = xpIn(start, end);
  const prevXp = xpIn(prev.start, prev.end);

  const active = cur.byWeekday.map((n, i) => ({ n, i })).filter((d) => d.n > 0);
  const best = active.length ? active.reduce((a, b) => (b.n > a.n ? b : a)).i : null;
  const worst = active.length > 1 ? active.reduce((a, b) => (b.n < a.n ? b : a)).i : null;

  const mostMissed = [...cur.missed.entries()]
    .map(([taskId, missed]) => ({
      taskId,
      name: tasks.find((t) => t.id === taskId)?.name ?? 'Deleted task',
      missed,
    }))
    .sort((a, b) => b.missed - a.missed)
    .slice(0, 5);

  return {
    unit, start, end, prevStart: prev.start, prevEnd: prev.end,
    earned: cur.earned, prevEarned: old.earned,
    lost: cur.lost, prevLost: old.lost,
    completed: cur.completed, due: cur.due,
    prevCompleted: old.completed, prevDue: old.due,
    traits: TRAITS.map((t) => ({ trait: t.id, xp: curXp[t.id], prevXp: prevXp[t.id] })),
    byWeekday: cur.byWeekday,
    bestWeekday: best,
    worstWeekday: worst,
    mostMissed,
    pausedDays: cur.pausedDays,
  };
}
