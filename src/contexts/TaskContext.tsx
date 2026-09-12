import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Task, TaskCompletion, Subtask, DIFFICULTY_MULTIPLIERS } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAuth } from './AuthContext';
import { getStreakCycleLength, computeCurrentStreak, computeAtLeastRawStreak } from '@/lib/streakUtils';
import { periodUnitFor, successesInPeriod } from '@/lib/periodUtils';
import { isTaskDueOn, isPausedOn, pausedDatesIn, normalizeFrequency, PauseRange } from '@/lib/schedule';
import {
  TraitId, TRAITS, isTraitId, baseXpForEffort, baseXpForCompletion,
} from '@/lib/xpUtils';

function normalizeTraits(...sources: unknown[]): TraitId[] {
  for (const s of sources) {
    if (Array.isArray(s)) {
      const arr = s.filter((x): x is TraitId => isTraitId(x));
      if (arr.length > 0) return Array.from(new Set(arr));
    } else if (typeof s === 'string' && isTraitId(s)) {
      return [s];
    }
  }
  return ['discipline'];
}

export type XpReason = 'completion' | 'streak_bonus' | 'mastery_bonus' | 'failure_penalty';

export interface XpEvent {
  id: string;
  trait: TraitId;
  taskId: string | null;
  date: string; // yyyy-MM-dd
  amount: number;
  reason: XpReason;
  createdAt: string;
}


interface TraitTotals { trait: TraitId; totalXp: number }

interface TaskContextType {
  tasks: Task[];
  wallet: number;
  loading: boolean;
  dayOffSet: Set<string>;
  pauseRanges: PauseRange[];
  addPause: (start: string, end: string, label?: string) => void;
  removePause: (id: string) => void;
  isPausedDate: (date: Date) => boolean;
  traitXp: Record<TraitId, number>;
  xpEvents: XpEvent[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completions' | 'currentStreak' | 'streaksCompleted' | 'streakBrokenThisWeek'>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Pick<Task, 'name' | 'frequencyType' | 'frequencyValue' | 'baseAmount' | 'difficulty' | 'effortWeight' | 'scheduledTime' | 'traits'>>) => Promise<void>;
  completeTask: (taskId: string, date: Date, minutesWorked?: number) => Promise<void>;
  cancelTask: (taskId: string, date: Date) => Promise<void>;
  undoComplete: (taskId: string, date: Date) => Promise<void>;
  undoSkip: (taskId: string, date: Date) => Promise<void>;
  skipDay: (taskId: string, date: Date) => void;
  undoSkipDay: (taskId: string, date: Date) => void;
  isDayOff: (taskId: string, date: Date) => boolean;
  deleteTask: (taskId: string) => Promise<void>;
  getTasksForDate: (date: Date) => Task[];
  getAllTasksForDate: (date: Date) => Task[];
  isTaskCompletedOnDate: (taskId: string, date: Date) => boolean;
  isTaskSkippedOnDate: (taskId: string, date: Date) => boolean;
  withdrawFromWallet: (amount: number) => Promise<boolean>;
  toggleSubtask: (subtaskId: string) => Promise<void>;
  isSubtaskCompletedOnDate: (subtaskId: string, date: Date) => boolean;
  isSubtaskMissed: (subtaskId: string, date: Date) => boolean;
  markSubtaskMissed: (subtaskId: string, date: Date) => void;
  undoMissSubtask: (subtaskId: string, date: Date) => void;
  toggleSubtaskOnDate: (subtaskId: string, date: Date, onTaskComplete?: (amount: number, element?: HTMLElement) => void, element?: HTMLElement) => Promise<void>;
  getSubtaskProgress: (taskId: string, date: Date) => { done: number; total: number; missed: number };
  toggleParentSubtasks: (taskId: string, date: Date, onTaskComplete?: (amount: number, element?: HTMLElement) => void, element?: HTMLElement) => Promise<void>;
}


const TaskContext = createContext<TaskContextType | undefined>(undefined);

const EMPTY_TRAIT_XP: Record<TraitId, number> = TRAITS.reduce((m, t) => { m[t.id] = 0; return m; }, {} as Record<TraitId, number>);

/**
 * Skip days, missed subtasks and pause windows live in Postgres, not in the
 * browser: the same login is used on phone and laptop, and per-device storage
 * meant the two silently disagreed about which days were streak-neutral.
 *
 * These are plain fetch helpers rather than state so `loadData` can await the
 * current server values in the same pass that repairs streaks.
 */
async function fetchSkipSet(deviceId: string): Promise<Set<string>> {
  if (!deviceId) return new Set();
  const { data, error } = await supabase
    .from('task_skips')
    .select('task_id, skip_date')
    .eq('device_id', deviceId);
  if (error || !data) return new Set();
  return new Set(data.map((r) => `${r.task_id}|${r.skip_date}`));
}

async function fetchMissedSet(deviceId: string): Promise<Set<string>> {
  if (!deviceId) return new Set();
  const { data, error } = await supabase
    .from('subtask_missed')
    .select('subtask_id, missed_date')
    .eq('device_id', deviceId);
  if (error || !data) return new Set();
  return new Set(data.map((r) => `${r.subtask_id}|${r.missed_date}`));
}

async function fetchPauseRanges(deviceId: string): Promise<PauseRange[]> {
  if (!deviceId) return [];
  const { data, error } = await supabase
    .from('pause_ranges')
    .select('id, start_date, end_date, label')
    .eq('device_id', deviceId)
    .order('start_date', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, start: r.start_date, end: r.end_date, label: r.label ?? undefined }));
}

/** Share of a day's due tasks that must be done for that day to grant a raise. */
const CLEAR_THRESHOLD = 0.8;


export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wallet, setWallet] = useState(0);
  const [loading, setLoading] = useState(true);
  // Per-date subtask completion set. Key: `${subtaskId}|${yyyy-MM-dd}`
  const [subtaskDoneSet, setSubtaskDoneSet] = useState<Set<string>>(new Set());
  // Per-date "day off" set for at-least-weekly tasks. Key: `${taskId}|${yyyy-MM-dd}`
  const [dayOffSet, setDayOffSet] = useState<Set<string>>(new Set());
  // Per-date "subtask missed" set. Key: `${subtaskId}|${yyyy-MM-dd}`.
  // Streak-neutral, no penalty — the subtask just can't be completed that day.
  const [subtaskMissedSet, setSubtaskMissedSet] = useState<Set<string>>(new Set());
  // Vacation / pause windows. Every task is off the hook inside these, so a
  // paused day neither breaks a streak nor demands a completion.
  const [pauseRanges, setPauseRanges] = useState<PauseRange[]>([]);
  // XP totals per trait + audit event log
  const [traitXp, setTraitXp] = useState<Record<TraitId, number>>({ ...EMPTY_TRAIT_XP });
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);
  const { user } = useAuth();


  const deviceId = user?.device_id || '';

  const addPause = async (start: string, end: string, label?: string) => {
    if (!deviceId) return;
    const range = start <= end ? { start, end } : { start: end, end: start };
    const { data, error } = await supabase
      .from('pause_ranges')
      .insert({ device_id: deviceId, start_date: range.start, end_date: range.end, label: label || null })
      .select('id, start_date, end_date, label')
      .single();
    if (error || !data) return;
    setPauseRanges((prev) =>
      [...prev, { id: data.id, start: data.start_date, end: data.end_date, label: data.label ?? undefined }]
        .sort((a, b) => a.start.localeCompare(b.start)),
    );
  };

  const removePause = async (id: string) => {
    setPauseRanges((prev) => prev.filter((r) => r.id !== id));
    await supabase.from('pause_ranges').delete().eq('id', id);
  };

  const isPausedDate = (date: Date) => isPausedOn(pauseRanges, format(date, 'yyyy-MM-dd'));

  /**
   * Every date that is streak-neutral for `task`: explicit days off, dates
   * where a subtask was marked missed, and any day inside a vacation window.
   *
   * A date only counts as neutral if the task was NOT completed for money on
   * it — otherwise a skip taken before a later completion would erase the
   * completion from the run. Every recompute path must go through here; three
   * of them previously omitted exclusions entirely, so a streak silently
   * changed value depending on whether it was recomputed on load, on
   * completion, or on undo.
   */
  const excludedDatesFor = (task: Task, completions?: { date: string; earnedAmount: number }[]): Set<string> => {
    const source = completions ?? task.completions;
    const earned = new Set(source.filter((c) => c.earnedAmount > 0).map((c) => c.date));
    const out = new Set<string>();
    const addIfNeutral = (d: string) => { if (!earned.has(d)) out.add(d); };

    for (const key of dayOffSet) {
      const [tid, d] = key.split('|');
      if (tid === task.id) addIfNeutral(d);
    }
    const subtaskIds = new Set(task.subtasks.map((st) => st.id));
    for (const key of subtaskMissedSet) {
      const [sid, d] = key.split('|');
      if (subtaskIds.has(sid)) addIfNeutral(d);
    }
    if (pauseRanges.length > 0) {
      const dates = source.map((c) => c.date).concat(task.startDate);
      const from = dates.reduce((a, b) => (a < b ? a : b), task.startDate);
      for (const d of pausedDatesIn(pauseRanges, from, format(new Date(), 'yyyy-MM-dd'))) addIfNeutral(d);
    }
    return out;
  };


  const dayOffKey = (taskId: string, date: Date) => `${taskId}|${format(date, 'yyyy-MM-dd')}`;

  const isDayOff = (taskId: string, date: Date): boolean =>
    dayOffSet.has(dayOffKey(taskId, date));

  // Optimistic locally, durable on the server, so the other device sees it.
  const skipDay = (taskId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setDayOffSet((prev) => new Set(prev).add(`${taskId}|${dateStr}`));
    if (!deviceId) return;
    supabase
      .from('task_skips')
      .upsert({ device_id: deviceId, task_id: taskId, skip_date: dateStr }, { onConflict: 'task_id,skip_date' })
      .then(({ error }) => { if (error) console.error('skipDay:', error); });
  };

  const undoSkipDay = (taskId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setDayOffSet((prev) => { const n = new Set(prev); n.delete(`${taskId}|${dateStr}`); return n; });
    supabase
      .from('task_skips')
      .delete()
      .eq('task_id', taskId)
      .eq('skip_date', dateStr)
      .then(({ error }) => { if (error) console.error('undoSkipDay:', error); });
  };



  useEffect(() => {
    if (deviceId) {
      loadData();
    } else {
      setTasks([]);
      setWallet(0);
      setLoading(false);
    }
  }, [deviceId]);

  const loadData = async () => {
    if (!deviceId) return;
    
    setLoading(true);
    try {
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (walletData) {
        setWallet(Number(walletData.balance));
      } else {
        await supabase.from('wallets').insert({ device_id: deviceId, balance: 0 });
        setWallet(0);
      }

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('device_id', deviceId);

      // Fetch ALL completions – default Supabase limit is 1000 which
      // silently drops rows and corrupts streak calculations.
      let completionsData: any[] = [];
      let completionsPage = 0;
      const PAGE_SIZE = 1000;
      while (true) {
        const { data: page } = await supabase
          .from('task_completions')
          .select('*')
          .eq('device_id', deviceId)
          .order('completed_date', { ascending: false })
          .range(completionsPage * PAGE_SIZE, (completionsPage + 1) * PAGE_SIZE - 1);
        if (!page || page.length === 0) break;
        completionsData = completionsData.concat(page);
        if (page.length < PAGE_SIZE) break;
        completionsPage++;
      }

      const { data: subtasksData } = await supabase
        .from('subtasks')
        .select('*')
        .eq('device_id', deviceId);

      const { data: subtaskCompletionsData } = await supabase
        .from('subtask_completions')
        .select('*')
        .eq('device_id', deviceId);

      const nextDoneSet = new Set<string>();
      (subtaskCompletionsData || []).forEach((row: any) => {
        nextDoneSet.add(`${row.subtask_id}|${row.completed_date}`);
      });
      setSubtaskDoneSet(nextDoneSet);

      if (tasksData) {
        const tasksWithCompletions: Task[] = tasksData.map((t: any) => ({
          id: t.id,
          name: t.name,
          // Legacy `specific-day` rows are folded into `weekly` on read.
          ...normalizeFrequency(t.frequency_type as Task['frequencyType'], t.frequency_value),
          amount: Number(t.amount),
          baseAmount: Number(t.base_amount) || Number(t.amount),
          difficulty: t.difficulty as Task['difficulty'],
          // Rows written before effort_weight existed fall back to difficulty,
          // which is exactly the XP they earned under the old shared dial.
          effortWeight: (t.effort_weight ?? t.difficulty) as Task['effortWeight'],
          createdAt: t.created_at || new Date().toISOString(),
          startDate: t.start_date || format(new Date(), 'yyyy-MM-dd'),
          scheduledTime: t.scheduled_time || null,
          currentStreak: t.current_streak || 0,
          streaksCompleted: t.streaks_completed || 0,
          streakBrokenThisWeek: false,
          isHourly: t.is_hourly || false,
          perMinuteRate: Number(t.per_minute_rate) || 0,
          traits: normalizeTraits((t as any).traits, (t as any).trait),
          completions: (completionsData || [])
            .filter((c) => c.task_id === t.id)
            .map((c) => ({
              date: c.completed_date,
              earnedAmount: Number(c.amount_earned),
              wasStreakBonus: c.streak_bonus || false,
            })),
          subtasks: (subtasksData || [])
            .filter((s: any) => s.task_id === t.id)
            .map((s: any) => ({
              id: s.id,
              taskId: s.task_id,
              name: s.name,
              isCompleted: s.is_completed,
              scheduledTime: s.scheduled_time || '',
            })),
        }));

        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');

        // Build per-task excluded-date sets (day-off + any-subtask-missed dates
        // where the task wasn't fully completed) so streak recalc treats them
        // as streak-neutral.
        // Fetched rather than read from state: the hydrating effects have not
        // committed by the time this runs, so state would still be empty here
        // and the on-load streak repair would ignore every skip.
        const [storedDayOff, storedMissed, storedPauses] = await Promise.all([
          fetchSkipSet(deviceId),
          fetchMissedSet(deviceId),
          fetchPauseRanges(deviceId),
        ]);
        setDayOffSet(storedDayOff);
        setSubtaskMissedSet(storedMissed);
        setPauseRanges(storedPauses);

        const excludedByTask = new Map<string, Set<string>>();
        const pausedDays = storedPauses.length
          ? pausedDatesIn(storedPauses, '0000-01-01', todayStr)
          : new Set<string>();
        for (const key of storedDayOff) {
          const [tid, d] = key.split('|');
          if (!excludedByTask.has(tid)) excludedByTask.set(tid, new Set());
          excludedByTask.get(tid)!.add(d);
        }
        const subtaskToTask = new Map<string, string>();
        tasksWithCompletions.forEach((t) => t.subtasks.forEach((s) => subtaskToTask.set(s.id, t.id)));
        for (const key of storedMissed) {
          const [sid, d] = key.split('|');
          const tid = subtaskToTask.get(sid);
          if (!tid) continue;
          if (!excludedByTask.has(tid)) excludedByTask.set(tid, new Set());
          excludedByTask.get(tid)!.add(d);
        }

        const recalculated = tasksWithCompletions.map((task) => {
          const excluded = excludedByTask.get(task.id) || new Set<string>();
          // A date is only streak-neutral if there's no full completion on it.
          const successDates = new Set(task.completions.filter((c) => c.earnedAmount > 0).map((c) => c.date));
          const cleanExcluded = new Set<string>();
          for (const d of excluded) if (!successDates.has(d)) cleanExcluded.add(d);
          for (const d of pausedDays) if (!successDates.has(d)) cleanExcluded.add(d);
          const correctStreak = computeCurrentStreak(task, task.completions, todayStr, cleanExcluded);
          if (correctStreak !== task.currentStreak) {
            console.log(`Fixing streak for "${task.name}": ${task.currentStreak} → ${correctStreak}`);
            supabase.from('tasks').update({ current_streak: correctStreak }).eq('id', task.id);
          }
          return { ...task, currentStreak: correctStreak };
        });

        setTasks(recalculated);
      }

      // Load trait XP totals + recent events
      const [{ data: traitXpRows }, { data: xpEventRows }] = await Promise.all([
        supabase.from('trait_xp').select('*').eq('device_id', deviceId),
        supabase.from('xp_events').select('*').eq('device_id', deviceId)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);
      const nextXp: Record<TraitId, number> = { ...EMPTY_TRAIT_XP };
      (traitXpRows || []).forEach((r: any) => {
        if (isTraitId(r.trait)) nextXp[r.trait as TraitId] = Number(r.total_xp) || 0;
      });
      setTraitXp(nextXp);
      setXpEvents(
        (xpEventRows || [])
          .filter((r: any) => isTraitId(r.trait))
          .map((r: any) => ({
            id: r.id,
            trait: r.trait as TraitId,
            taskId: r.task_id,
            date: r.event_date,
            amount: Number(r.amount) || 0,
            reason: r.reason as XpReason,
            createdAt: r.created_at,
          }))
      );
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---------- XP helpers ----------
  const applyXp = (trait: TraitId, taskId: string | null, date: string, amount: number, reason: XpReason) => {
    if (!deviceId || amount === 0) return;
    // Optimistic UI update
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setTraitXp((prev) => ({ ...prev, [trait]: (prev[trait] || 0) + amount }));
    setXpEvents((prev) => [
      { id: localId, trait, taskId, date, amount, reason, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    // Persist upsert of totals + insert event
    (async () => {
      const { data: existing } = await supabase
        .from('trait_xp')
        .select('id, total_xp')
        .eq('device_id', deviceId)
        .eq('trait', trait)
        .maybeSingle();
      const newTotal = (existing?.total_xp ?? 0) + amount;
      if (existing) {
        await supabase.from('trait_xp')
          .update({ total_xp: newTotal, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('trait_xp').insert({ device_id: deviceId, trait, total_xp: newTotal });
      }
      await supabase.from('xp_events').insert({
        device_id: deviceId,
        trait,
        task_id: taskId,
        event_date: date,
        amount,
        reason,
      });
    })().catch((e) => console.error('applyXp sync', e));
  };

  // Reverse all xp events for a task on a specific date (used on undoComplete/etc)
  const reverseXpForTaskDate = async (taskId: string, dateStr: string) => {
    if (!deviceId) return;
    const affected = xpEvents.filter((e) => e.taskId === taskId && e.date === dateStr);
    if (affected.length === 0) return;
    const perTrait: Record<string, number> = {};
    for (const e of affected) perTrait[e.trait] = (perTrait[e.trait] || 0) + e.amount;

    // Optimistic
    setTraitXp((prev) => {
      const next = { ...prev };
      for (const [tr, amt] of Object.entries(perTrait)) {
        next[tr as TraitId] = (next[tr as TraitId] || 0) - amt;
      }
      return next;
    });
    setXpEvents((prev) => prev.filter((e) => !(e.taskId === taskId && e.date === dateStr)));

    // Persist: delete events + adjust totals per trait
    (async () => {
      await supabase.from('xp_events').delete()
        .eq('device_id', deviceId).eq('task_id', taskId).eq('event_date', dateStr);
      for (const [tr, amt] of Object.entries(perTrait)) {
        const { data: existing } = await supabase
          .from('trait_xp').select('id, total_xp')
          .eq('device_id', deviceId).eq('trait', tr).maybeSingle();
        if (existing) {
          await supabase.from('trait_xp')
            .update({ total_xp: (existing.total_xp ?? 0) - amt, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
      }
    })().catch((e) => console.error('reverseXpForTaskDate sync', e));
  };



  const dateKey = (d: Date) => format(d, 'yyyy-MM-dd');

  /**
   * Did this day's schedule actually get cleared? `justCompletedId` counts as
   * done because this runs mid-completion, before state has committed.
   *
   * Flexible at-least-N tasks are ignored: they have no fixed due day, so
   * they can neither block nor grant a raise.
   */
  const scheduleClearedOn = (date: Date, justCompletedId?: string): boolean => {
    const dateStr = dateKey(date);
    if (isPausedOn(pauseRanges, dateStr)) return false;

    let due = 0;
    let done = 0;
    for (const t of tasks) {
      if (t.frequencyType === 'at-least-weekly' || t.frequencyType === 'at-least-monthly') continue;
      if (!isTaskDueOn(t, date)) continue;
      if (dayOffSet.has(`${t.id}|${dateStr}`)) continue;
      due++;
      if (t.id === justCompletedId) { done++; continue; }
      if (t.completions.some((c) => c.date === dateStr && c.earnedAmount > 0)) done++;
    }
    if (due === 0) return true;
    return done / due >= CLEAR_THRESHOLD;
  };

  /** Due by the task's own schedule, and not inside a vacation window. */
  const isTaskDueOnDate = (task: Task, date: Date) => {
    if (isPausedOn(pauseRanges, dateKey(date))) return false;
    return isTaskDueOn(task, date);
  };

  const findPreviousDueDate = (task: Task, date: Date): string | null => {
    // Look back up to a year; weekly/monthly/specific-day will find much sooner.
    for (let i = 1; i <= 366; i++) {
      const d = new Date(date);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      if (key < task.startDate) return null;
      if (isTaskDueOnDate(task, d)) return key;
    }
    return null;
  };

  const addTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'completions' | 'currentStreak' | 'streaksCompleted' | 'streakBrokenThisWeek'>) => {
    if (!deviceId) return;
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        device_id: deviceId,
        name: taskData.name,
        frequency_type: taskData.frequencyType,
        frequency_value: taskData.frequencyValue as any,
        amount: taskData.amount,
        base_amount: taskData.baseAmount,
        difficulty: taskData.difficulty,
        effort_weight: taskData.effortWeight ?? taskData.difficulty,
        start_date: taskData.startDate,
        scheduled_time: taskData.scheduledTime || null,
        current_streak: 0,
        streaks_completed: 0,
        is_hourly: taskData.isHourly,
        per_minute_rate: taskData.perMinuteRate,
        traits: (taskData.traits && taskData.traits.length > 0 ? taskData.traits : ['discipline']) as any,
        trait: (taskData.traits && taskData.traits[0]) || 'discipline',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding task:', error);
      return;
    }

    if (data) {
      // Insert subtasks if any
      let insertedSubtasks: Subtask[] = [];
      if (taskData.subtasks && taskData.subtasks.length > 0) {
        const { data: subtasksResult } = await supabase
          .from('subtasks')
          .insert(
            taskData.subtasks.map((s) => ({
              task_id: data.id,
              device_id: deviceId,
              name: s.name,
              is_completed: false,
              scheduled_time: s.scheduledTime || null,
            })) as any
          )
          .select();
        
        if (subtasksResult) {
          insertedSubtasks = subtasksResult.map((s: any) => ({
            id: s.id,
            taskId: s.task_id,
            name: s.name,
            isCompleted: s.is_completed,
            scheduledTime: s.scheduled_time || '',
          }));
        }
      }

      const newTask: Task = {
        id: data.id,
        name: data.name,
        ...normalizeFrequency(data.frequency_type as Task['frequencyType'], data.frequency_value),
        amount: Number(data.amount),
        baseAmount: Number((data as any).base_amount) || Number(data.amount),
        difficulty: data.difficulty as Task['difficulty'],
        effortWeight: ((data as any).effort_weight ?? data.difficulty) as Task['effortWeight'],
        createdAt: data.created_at || new Date().toISOString(),
        startDate: (data as any).start_date || format(new Date(), 'yyyy-MM-dd'),
        scheduledTime: (data as any).scheduled_time || null,
        currentStreak: 0,
        streaksCompleted: 0,
        streakBrokenThisWeek: false,
        isHourly: (data as any).is_hourly || false,
        perMinuteRate: Number((data as any).per_minute_rate) || 0,
        traits: normalizeTraits((data as any).traits, (data as any).trait, taskData.traits),
        completions: [],
        subtasks: insertedSubtasks,
      };
      setTasks((prev) => [...prev, newTask]);
    }
  };

  const completeTask = async (taskId: string, date: Date, minutesWorked?: number) => {
    if (!deviceId) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.completions.some((c) => c.date === dateStr)) return;

    const cycleLength = getStreakCycleLength(task);
    let baseStreak: number;

    if (task.frequencyType === 'at-least-weekly' || task.frequencyType === 'at-least-monthly') {
      // Period-aware base: this new completion's period accepts any prior
      // successes in the same period, and each fully-elapsed prior period
      // only carries over if it met its quota. Exclude the current dateStr
      // from the history since we're computing the PRE-increment base.
      const unit: 'week' | 'month' =
        task.frequencyType === 'at-least-weekly' ? 'week' : 'month';
      const priorSuccessDates = task.completions
        .filter((c) => c.earnedAmount > 0 && c.date !== dateStr)
        .map((c) => c.date);
      const rawBase = computeAtLeastRawStreak(task, priorSuccessDates, dateStr, unit);
      baseStreak = Number.isFinite(cycleLength) && cycleLength > 0
        ? rawBase % cycleLength
        : rawBase;
    } else {
      // Fixed-schedule tasks: streak breaks if the previous scheduled
      // occurrence was missed.
      baseStreak = task.currentStreak;
      const prevDueDateStr = findPreviousDueDate(task, date);
      if (prevDueDateStr) {
        const prevWasCompleted = task.completions.some(
          (c) => c.date === prevDueDateStr && c.earnedAmount > 0
        );
        if (!prevWasCompleted) baseStreak = 0;
      }
    }

    const newStreak = baseStreak + 1;
    const isWeeklyStreakComplete = newStreak === cycleLength;

    // A raise is earned by the whole day, not by one task. Without this the
    // multiplier compounds on a single habit while everything else rots —
    // `streaksCompleted` is per-task and knows nothing about the rest of the
    // schedule. Clearing the day is what unlocks the raise.
    const dayCleared = scheduleClearedOn(date, taskId);
    // Past the cap a raise would outgrow anything the wallet could honestly
    // gate, so cycles keep counting but stop moving the rate.
    const grantsRaise = isWeeklyStreakComplete && dayCleared;

    let earnedAmount: number;
    let newTaskAmount = task.amount;
    let newPerMinuteRate = task.perMinuteRate;
    let newStreaksCompleted = task.streaksCompleted;

    if (task.isHourly) {
      // Hourly task: earn based on minutes worked
      earnedAmount = (minutesWorked || 0) * task.perMinuteRate;

      if (grantsRaise) {
        newPerMinuteRate = task.perMinuteRate + 0.5;
        newStreaksCompleted = task.streaksCompleted + 1;
      }
    } else {
      // Regular task: fixed amount with difficulty multiplier
      const multiplier = DIFFICULTY_MULTIPLIERS[task.difficulty];
      earnedAmount = task.amount;

      if (grantsRaise) {
        newTaskAmount = task.amount * multiplier;
        newStreaksCompleted = task.streaksCompleted + 1;
      }
    }

    const finalStreak = isWeeklyStreakComplete ? 0 : newStreak;

    // Optimistic UI update first
    const newWalletBalance = wallet + earnedAmount;
    setWallet(newWalletBalance);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          amount: newTaskAmount,
          perMinuteRate: newPerMinuteRate,
          currentStreak: finalStreak,
          streaksCompleted: newStreaksCompleted,
          completions: [
            ...t.completions,
            { date: dateStr, earnedAmount, wasStreakBonus: isWeeklyStreakComplete },
          ],
          subtasks: t.subtasks.map((s) => ({ ...s, isCompleted: false })),
        };
      })
    );

    // Fire all DB writes in parallel (background)
    Promise.all([
      supabase.from('task_completions').insert({
        task_id: taskId,
        device_id: deviceId,
        completed_date: dateStr,
        amount_earned: earnedAmount,
        streak_bonus: isWeeklyStreakComplete,
      }),
      supabase.from('tasks').update({
        current_streak: finalStreak,
        amount: newTaskAmount,
        streaks_completed: newStreaksCompleted,
        per_minute_rate: newPerMinuteRate,
      }).eq('id', taskId),
      supabase.from('wallets').update({
        balance: newWalletBalance,
        updated_at: new Date().toISOString(),
      }).eq('device_id', deviceId),
      ...(task.subtasks && task.subtasks.length > 0
        ? [supabase.from('subtasks').update({ is_completed: false }).eq('task_id', taskId)]
        : []),
    ]).catch((err) => console.error('Error syncing task completion:', err));

    // Award XP: base + consistency bonus (or mastery bonus on cycle completion) — full amount to each tagged trait
    const baseXp = baseXpForCompletion(task.effortWeight, task.isHourly, task.perMinuteRate, minutesWorked || 0);
    for (const tr of task.traits) {
      applyXp(tr, taskId, dateStr, baseXp, 'completion');
      if (isWeeklyStreakComplete) {
        const xpMult = DIFFICULTY_MULTIPLIERS[task.difficulty] || 1;
        const masteryBonus = Math.round(baseXp * (xpMult - 1));
        if (masteryBonus > 0) {
          applyXp(tr, taskId, dateStr, masteryBonus, 'mastery_bonus');
        }
      } else if (baseStreak > 0) {
        const consistency = Math.round(baseXp * 0.03 * baseStreak);
        if (consistency > 0) {
          applyXp(tr, taskId, dateStr, consistency, 'streak_bonus');
        }
      }
    }
  };


  const undoComplete = async (taskId: string, date: Date) => {
    if (!deviceId) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const completion = task.completions.find((c) => c.date === dateStr);
    if (!completion) return;

    // Revert streak-bonus side effects if this completion triggered one
    let revertedAmount = task.amount;
    let revertedPerMinuteRate = task.perMinuteRate;
    let revertedStreaksCompleted = task.streaksCompleted;
    if (completion.wasStreakBonus) {
      revertedStreaksCompleted = Math.max(0, task.streaksCompleted - 1);
      if (task.isHourly) {
        revertedPerMinuteRate = Math.max(0, task.perMinuteRate - 0.5);
      } else {
        const multiplier = DIFFICULTY_MULTIPLIERS[task.difficulty] || 1;
        if (multiplier > 0) revertedAmount = task.amount / multiplier;
      }
    }

    const remainingCompletions = task.completions.filter((c) => c.date !== dateStr);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const newStreak = computeCurrentStreak(
      { ...task, completions: remainingCompletions } as Task,
      remainingCompletions,
      todayStr,
      excludedDatesFor(task, remainingCompletions),
    );

    const newWalletBalance = wallet - completion.earnedAmount;

    // Optimistic update
    setWallet(newWalletBalance);
    setTasks((prev) =>
      prev.map((t) =>
        t.id !== taskId
          ? t
          : {
              ...t,
              amount: revertedAmount,
              perMinuteRate: revertedPerMinuteRate,
              currentStreak: newStreak,
              streaksCompleted: revertedStreaksCompleted,
              completions: remainingCompletions,
            },
      ),
    );

    // Also clear per-date subtask completion/missed state so the parent
    // reverts visibly to "not started" for subtask-based tasks.
    const hasSubs = task.subtasks && task.subtasks.length > 0;
    if (hasSubs) {
      const subIds = new Set(task.subtasks.map((s) => s.id));
      setSubtaskDoneSet((prev) => {
        const next = new Set(prev);
        for (const id of subIds) next.delete(`${id}|${dateStr}`);
        return next;
      });
      setSubtaskMissedSet((prev) => {
        const next = new Set(prev);
        for (const id of subIds) next.delete(`${id}|${dateStr}`);
        return next;
      });
    }

    Promise.all([
      supabase.from('task_completions').delete().eq('task_id', taskId).eq('completed_date', dateStr),
      supabase.from('tasks').update({
        current_streak: newStreak,
        amount: revertedAmount,
        streaks_completed: revertedStreaksCompleted,
        per_minute_rate: revertedPerMinuteRate,
      }).eq('id', taskId),
      supabase.from('wallets').update({
        balance: newWalletBalance,
        updated_at: new Date().toISOString(),
      }).eq('device_id', deviceId),
      ...(hasSubs
        ? [supabase.from('subtask_completions').delete().eq('task_id', taskId).eq('completed_date', dateStr)]
        : []),
    ]).catch((err) => console.error('Error undoing task completion:', err));

    reverseXpForTaskDate(taskId, dateStr);
  };


  const withdrawFromWallet = async (amount: number) => {
    if (!deviceId) return false;
    if (!Number.isFinite(amount) || amount <= 0) return false;
    // Failures can drive the wallet negative on purpose, but a withdrawal is
    // taking real money out — it can never exceed what's actually there.
    if (amount > wallet) return false;

    const newBalance = wallet - amount;
    const { error } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error withdrawing:', error);
      return false;
    }

    setWallet(newBalance);
    return true;
  };

  const deleteTask = async (taskId: string) => {
    if (!deviceId) return;
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error deleting task:', error);
      return;
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const cancelTask = async (taskId: string, date: Date) => {
    if (!deviceId) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.completions.some((c) => c.date === dateStr)) return;

    // Calculate penalty amount
    let penaltyAmount: number;
    if (task.isHourly) {
      // For hourly tasks: 200 * perMinuteRate
      penaltyAmount = 200 * task.perMinuteRate;
    } else {
      // For normal tasks: current pay amount
      penaltyAmount = task.amount;
    }

    // Deduct from wallet (can go negative - borrowed money)
    const newWalletBalance = wallet - penaltyAmount;

    // Skipping always breaks the streak
    const shouldResetStreak = task.currentStreak !== 0;

    // Optimistic UI update first
    setWallet(newWalletBalance);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          currentStreak: shouldResetStreak ? 0 : t.currentStreak,
          completions: [
            ...t.completions,
            { date: dateStr, earnedAmount: 0, wasStreakBonus: false },
          ],
        };
      })
    );

    // Fire all DB writes in parallel (background)
    Promise.all([
      supabase.from('task_completions').insert({
        task_id: taskId,
        device_id: deviceId,
        completed_date: dateStr,
        amount_earned: 0,
        streak_bonus: false,
      }),
      supabase.from('wallets').update({
        balance: newWalletBalance,
        updated_at: new Date().toISOString(),
      }).eq('device_id', deviceId),
      ...(shouldResetStreak
        ? [supabase.from('tasks').update({ current_streak: 0 }).eq('id', taskId)]
        : []),
    ]).catch((err) => console.error('Error syncing task cancel:', err));

    // XP penalty: -60% base XP for the difficulty
    const baseXp = baseXpForEffort(task.effortWeight);
    const penalty = Math.round(baseXp * 0.6);
    for (const tr of task.traits) applyXp(tr, taskId, dateStr, -penalty, 'failure_penalty');
  };


  const undoSkip = async (taskId: string, date: Date) => {
    if (!deviceId) return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Check if this task was actually skipped on this date
    const skippedCompletion = task.completions.find((c) => c.date === dateStr && c.earnedAmount === 0);
    if (!skippedCompletion) return;

    // Refund the penalty
    let penaltyAmount: number;
    if (task.isHourly) {
      penaltyAmount = 200 * task.perMinuteRate;
    } else {
      penaltyAmount = task.amount;
    }

    const newWalletBalance = wallet + penaltyAmount;

    // Recompute the streak from full history (minus the undone skip), using
    // the same cycle-aware logic as the on-load repair pass.
    const completionsWithoutSkip = task.completions.filter(
      (c) => !(c.date === dateStr && c.earnedAmount === 0)
    );
    const restoredStreak = computeCurrentStreak(
      task,
      completionsWithoutSkip,
      format(new Date(), 'yyyy-MM-dd'),
      excludedDatesFor(task, completionsWithoutSkip),
    );

    // Optimistic UI update
    setWallet(newWalletBalance);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          currentStreak: restoredStreak,
          completions: completionsWithoutSkip,
        };
      })
    );

    // DB: delete the skip record, refund wallet, and restore streak
    Promise.all([
      supabase.from('task_completions')
        .delete()
        .eq('task_id', taskId)
        .eq('device_id', deviceId)
        .eq('completed_date', dateStr)
        .eq('amount_earned', 0),
      supabase.from('wallets').update({
        balance: newWalletBalance,
        updated_at: new Date().toISOString(),
      }).eq('device_id', deviceId),
      supabase.from('tasks').update({
        current_streak: restoredStreak,
      }).eq('id', taskId),
    ]).catch((err) => console.error('Error undoing skip:', err));

    reverseXpForTaskDate(taskId, dateStr);
  };


  const updateTask = async (
    taskId: string,
    updates: Partial<Pick<Task, 'name' | 'frequencyType' | 'frequencyValue' | 'baseAmount' | 'difficulty' | 'effortWeight' | 'scheduledTime' | 'traits'>>
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Calculate new amount based on new baseAmount and streaksCompleted
    const newBaseAmount = updates.baseAmount ?? task.baseAmount;
    const newDifficulty = updates.difficulty ?? task.difficulty;
    const multiplier = DIFFICULTY_MULTIPLIERS[newDifficulty];
    const newAmount = task.streaksCompleted > 0
      ? newBaseAmount * Math.pow(multiplier, task.streaksCompleted)
      : newBaseAmount;

    const newTraits = (updates.traits && updates.traits.length > 0 ? updates.traits : task.traits) as TraitId[];
    const { error } = await supabase
      .from('tasks')
      .update({
        name: updates.name ?? task.name,
        frequency_type: updates.frequencyType ?? task.frequencyType,
        frequency_value: (updates.frequencyValue ?? task.frequencyValue) as any,
        base_amount: newBaseAmount,
        amount: newAmount,
        difficulty: newDifficulty,
        effort_weight: updates.effortWeight ?? task.effortWeight,
        scheduled_time: updates.scheduledTime !== undefined ? updates.scheduledTime : (task.scheduledTime || null),
        traits: newTraits as any,
        trait: newTraits[0] || 'discipline',
      })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      return;
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              name: updates.name ?? t.name,
              frequencyType: updates.frequencyType ?? t.frequencyType,
              frequencyValue: updates.frequencyValue ?? t.frequencyValue,
              baseAmount: newBaseAmount,
              amount: newAmount,
              difficulty: newDifficulty,
              effortWeight: updates.effortWeight ?? t.effortWeight,
              scheduledTime: updates.scheduledTime !== undefined ? updates.scheduledTime : t.scheduledTime,
              traits: newTraits,
            }
          : t
      )
    );
  };


  /**
   * Is this task on the schedule for `date`, ignoring completion state?
   * For flexible ("at least N per period") tasks this means the period quota
   * has not been met yet.
   */
  const isScheduledOn = (task: Task, date: Date, dateStr: string): boolean => {
    // Paused days show nothing and demand nothing.
    if (isPausedOn(pauseRanges, dateStr)) return false;
    // A flexible task that has already met its quota for the period drops off
    // the list for the rest of that period rather than nagging every day.
    if (task.frequencyType === 'at-least-weekly' || task.frequencyType === 'at-least-monthly') {
      const unit = periodUnitFor(task)!;
      return successesInPeriod(task, dateStr, unit) < Math.max(1, task.frequencyValue as number);
    }
    return isTaskDueOn(task, date);
  };

  const getTasksForDate = (date: Date): Task[] => {
    const dateStr = format(date, 'yyyy-MM-dd');

    return tasks.filter((task) => {
      if (task.startDate > dateStr) return false;

      const completion = task.completions.find((c) => c.date === dateStr);
      // Completed for money — nothing left to do today.
      if (completion && completion.earnedAmount > 0) return false;
      // Failed/skipped — keep it visible so the user can undo it.
      if (completion) return true;

      return isScheduledOn(task, date, dateStr);
    });
  };

  const getAllTasksForDate = (date: Date): Task[] => {
    const dateStr = format(date, 'yyyy-MM-dd');

    return tasks.filter((task) => {
      if (task.startDate > dateStr) return false;
      // Unlike getTasksForDate, anything with a record for the day stays on
      // screen — the timeline shows completed rows too.
      if (task.completions.some((c) => c.date === dateStr)) return true;

      return isScheduledOn(task, date, dateStr);
    });
  };

  const isTaskSkippedOnDate = (taskId: string, date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const task = tasks.find((t) => t.id === taskId);
    return task?.completions.some((c) => c.date === dateStr && c.earnedAmount === 0) || false;
  };

  const isTaskCompletedOnDate = (taskId: string, date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const task = tasks.find((t) => t.id === taskId);
    // Only return true for genuinely completed tasks (earnedAmount > 0), not skipped ones
    return task?.completions.some((c) => c.date === dateStr && c.earnedAmount > 0) || false;
  };

  const toggleSubtask = async (subtaskId: string) => {
    // Find the subtask and its parent task
    let parentTask: Task | undefined;
    let subtask: Subtask | undefined;
    
    for (const task of tasks) {
      const found = task.subtasks.find((s) => s.id === subtaskId);
      if (found) {
        parentTask = task;
        subtask = found;
        break;
      }
    }

    if (!subtask || !parentTask) return;

    const newCompletedState = !subtask.isCompleted;

    const { error } = await supabase
      .from('subtasks')
      .update({ is_completed: newCompletedState })
      .eq('id', subtaskId);

    if (error) {
      console.error('Error toggling subtask:', error);
      return;
    }

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== parentTask!.id) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, isCompleted: newCompletedState } : s
          ),
        };
      })
    );
  };

  // ---------- Per-date subtask helpers ----------
  const subKey = (subtaskId: string, date: Date) => `${subtaskId}|${format(date, 'yyyy-MM-dd')}`;

  const isSubtaskCompletedOnDate = (subtaskId: string, date: Date): boolean => {
    return subtaskDoneSet.has(subKey(subtaskId, date));
  };

  const isSubtaskMissed = (subtaskId: string, date: Date): boolean => {
    return subtaskMissedSet.has(subKey(subtaskId, date));
  };

  const markSubtaskMissed = (subtaskId: string, date: Date) => {
    if (!deviceId) return;
    const k = subKey(subtaskId, date);
    const dateStr = format(date, 'yyyy-MM-dd');

    // Find parent task + subtask
    const parentTask = tasks.find((t) => t.subtasks.some((s) => s.id === subtaskId));
    if (!parentTask) return;
    const total = parentTask.subtasks.length;

    // Compute per-subtask share to deduct (skip for hourly tasks)
    const share = parentTask.isHourly ? 0 : parentTask.amount / total;

    // Also unmark it as done if it happened to be flagged done
    const doneNext = new Set(subtaskDoneSet);
    if (doneNext.has(k)) {
      doneNext.delete(k);
      setSubtaskDoneSet(doneNext);
      supabase.from('subtask_completions')
        .delete()
        .eq('subtask_id', subtaskId)
        .eq('completed_date', dateStr)
        .then(({ error }) => { if (error) console.error('clear subtask on miss:', error); });
    }
    const next = new Set(subtaskMissedSet);
    next.add(k);
    setSubtaskMissedSet(next);
    if (deviceId) {
      supabase
        .from('subtask_missed')
        .upsert(
          { device_id: deviceId, task_id: parentTask.id, subtask_id: subtaskId, missed_date: dateStr },
          { onConflict: 'subtask_id,missed_date' },
        )
        .then(({ error }) => { if (error) console.error('markSubtaskMissed:', error); });
    }

    // Deduct this subtask's share from wallet
    const newWallet = wallet - share;

    // If ALL subtasks are now missed → treat as full-task failure:
    // record a zero-earning completion + reset streak. Wallet already
    // reflects the full task amount (sum of shares), so no extra penalty.
    const missedCountAfter = parentTask.subtasks.filter((s) =>
      next.has(subKey(s.id, date))
    ).length;
    const alreadyHasCompletion = parentTask.completions.some((c) => c.date === dateStr);
    const triggerFailure = missedCountAfter === total && !alreadyHasCompletion;

    setWallet(newWallet);
    if (triggerFailure) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === parentTask.id
            ? {
                ...t,
                currentStreak: 0,
                completions: [
                  ...t.completions,
                  { date: dateStr, earnedAmount: 0, wasStreakBonus: false },
                ],
              }
            : t
        )
      );
    }

    // Background sync
    const jobs: any[] = [
      supabase.from('wallets').update({
        balance: newWallet,
        updated_at: new Date().toISOString(),
      }).eq('device_id', deviceId),
    ];
    if (triggerFailure) {
      jobs.push(
        supabase.from('task_completions').insert({
          task_id: parentTask.id,
          device_id: deviceId,
          completed_date: dateStr,
          amount_earned: 0,
          streak_bonus: false,
        }),
        supabase.from('tasks').update({ current_streak: 0 }).eq('id', parentTask.id),
      );
    }
    Promise.all(jobs).catch((err) => console.error('markSubtaskMissed sync:', err));

    if (triggerFailure) {
      const baseXp = baseXpForEffort(parentTask.effortWeight);
      const penalty = Math.round(baseXp * 0.6);
      for (const tr of parentTask.traits) applyXp(tr, parentTask.id, dateStr, -penalty, 'failure_penalty');
    }
  };


  const undoMissSubtask = (subtaskId: string, date: Date) => {
    if (!deviceId) return;
    const k = subKey(subtaskId, date);
    if (!subtaskMissedSet.has(k)) return;
    const dateStr = format(date, 'yyyy-MM-dd');

    const parentTask = tasks.find((t) => t.subtasks.some((s) => s.id === subtaskId));
    if (!parentTask) return;
    const total = parentTask.subtasks.length;
    const share = parentTask.isHourly ? 0 : parentTask.amount / total;

    const wasAllMissed = parentTask.subtasks.every((s) => subtaskMissedSet.has(subKey(s.id, date)));

    const next = new Set(subtaskMissedSet);
    next.delete(k);
    setSubtaskMissedSet(next);
    supabase
      .from('subtask_missed')
      .delete()
      .eq('subtask_id', subtaskId)
      .eq('missed_date', dateStr)
      .then(({ error }) => { if (error) console.error('undoSubtaskMissed:', error); });

    // Refund the share
    const newWallet = wallet + share;
    setWallet(newWallet);

    // If undoing the last-missed that had triggered a full failure,
    // remove that zero-earning completion + recompute streak.
    let removedFailureCompletion = false;
    if (wasAllMissed) {
      const failure = parentTask.completions.find((c) => c.date === dateStr && c.earnedAmount === 0);
      if (failure) {
        removedFailureCompletion = true;
        const remaining = parentTask.completions.filter((c) => !(c.date === dateStr && c.earnedAmount === 0));
        const restoredStreak = computeCurrentStreak(
          parentTask,
          remaining,
          format(new Date(), 'yyyy-MM-dd'),
          excludedDatesFor(parentTask, remaining),
        );
        setTasks((prev) =>
          prev.map((t) =>
            t.id === parentTask.id
              ? { ...t, completions: remaining, currentStreak: restoredStreak }
              : t
          )
        );
      }
    }

    const jobs: any[] = [
      supabase.from('wallets').update({
        balance: newWallet,
        updated_at: new Date().toISOString(),
      }).eq('device_id', deviceId),
    ];
    if (removedFailureCompletion) {
      jobs.push(
        supabase.from('task_completions').delete()
          .eq('task_id', parentTask.id)
          .eq('device_id', deviceId)
          .eq('completed_date', dateStr)
          .eq('amount_earned', 0),
      );
    }
    Promise.all(jobs).catch((err) => console.error('undoMissSubtask sync:', err));

    // If undoing the miss removed a full-task failure record, also reverse
    // any failure XP that was applied for that parent task on this date.
    if (removedFailureCompletion) {
      reverseXpForTaskDate(parentTask.id, dateStr);
    }
  };


  const getSubtaskProgress = (taskId: string, date: Date) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) return { done: 0, total: 0, missed: 0 };
    const total = task.subtasks.length;
    const done = task.subtasks.filter((s) => subtaskDoneSet.has(subKey(s.id, date))).length;
    const missed = task.subtasks.filter((s) => subtaskMissedSet.has(subKey(s.id, date))).length;
    return { done, total, missed };
  };

  const toggleSubtaskOnDate = async (
    subtaskId: string,
    date: Date,
    onTaskComplete?: (amount: number, element?: HTMLElement) => void,
    element?: HTMLElement,
  ) => {
    if (!deviceId) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${subtaskId}|${dateStr}`;

    let parentTask: Task | undefined;
    for (const t of tasks) {
      if (t.subtasks.find((s) => s.id === subtaskId)) { parentTask = t; break; }
    }
    if (!parentTask) return;

    // Don't allow toggling if parent already completed/skipped for that date
    const parentCompletion = parentTask.completions.find((c) => c.date === dateStr);
    if (parentCompletion) return;

    // Don't allow toggling if this subtask has been marked missed for the date
    if (subtaskMissedSet.has(key)) return;

    const currentlyDone = subtaskDoneSet.has(key);
    const next = new Set(subtaskDoneSet);
    if (currentlyDone) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSubtaskDoneSet(next);

    if (currentlyDone) {
      supabase.from('subtask_completions')
        .delete()
        .eq('subtask_id', subtaskId)
        .eq('completed_date', dateStr)
        .then(({ error }) => { if (error) console.error('undo subtask:', error); });
    } else {
      supabase.from('subtask_completions').insert({
        subtask_id: subtaskId,
        task_id: parentTask.id,
        device_id: deviceId,
        completed_date: dateStr,
      }).then(({ error }) => { if (error) console.error('mark subtask:', error); });
    }

    // Auto-complete parent task only if ALL subtasks are done AND none missed
    if (!currentlyDone) {
      const anyMissed = parentTask.subtasks.some((s) => subtaskMissedSet.has(`${s.id}|${dateStr}`));
      const allDone = parentTask.subtasks.every((s) => next.has(`${s.id}|${dateStr}`));
      if (allDone && !anyMissed && !parentTask.completions.some((c) => c.date === dateStr)) {
        const earned = parentTask.isHourly ? 0 : parentTask.amount;
        await completeTask(parentTask.id, date);
        if (onTaskComplete && earned > 0) onTaskComplete(earned, element);
      }
    }
  };

  const toggleParentSubtasks = async (
    taskId: string,
    date: Date,
    onTaskComplete?: (amount: number, element?: HTMLElement) => void,
    element?: HTMLElement,
  ) => {
    if (!deviceId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.subtasks.length === 0) return;
    const dateStr = format(date, 'yyyy-MM-dd');

    // If parent already completed/skipped, do nothing
    if (task.completions.some((c) => c.date === dateStr)) return;

    const anyMissed = task.subtasks.some((s) => subtaskMissedSet.has(`${s.id}|${dateStr}`));
    const { done, total } = getSubtaskProgress(taskId, date);
    const markAll = done < total; // if not all done → mark all; if all done → clear all

    const next = new Set(subtaskDoneSet);
    if (markAll) {
      // Skip missed subtasks — they can't be marked done
      task.subtasks.forEach((s) => {
        if (!subtaskMissedSet.has(`${s.id}|${dateStr}`)) next.add(`${s.id}|${dateStr}`);
      });
    } else {
      task.subtasks.forEach((s) => next.delete(`${s.id}|${dateStr}`));
    }
    setSubtaskDoneSet(next);

    if (markAll) {
      const rows = task.subtasks
        .filter((s) => !subtaskDoneSet.has(`${s.id}|${dateStr}`) && !subtaskMissedSet.has(`${s.id}|${dateStr}`))
        .map((s) => ({
          subtask_id: s.id,
          task_id: taskId,
          device_id: deviceId,
          completed_date: dateStr,
        }));
      if (rows.length > 0) {
        supabase.from('subtask_completions').insert(rows)
          .then(({ error }) => { if (error) console.error('mark all subtasks:', error); });
      }
      // Only auto-complete the parent if no subtask is missed for this date
      if (!anyMissed) {
        const earned = task.isHourly ? 0 : task.amount;
        await completeTask(taskId, date);
        if (onTaskComplete && earned > 0) onTaskComplete(earned, element);
      }
    } else {
      supabase.from('subtask_completions')
        .delete()
        .eq('task_id', taskId)
        .eq('completed_date', dateStr)
        .then(({ error }) => { if (error) console.error('clear subtasks:', error); });
    }
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        wallet,
        loading,
        dayOffSet,
        pauseRanges,
        addPause,
        removePause,
        isPausedDate,
        traitXp,
        xpEvents,

        addTask,
        updateTask,
        completeTask,
        cancelTask,
        undoComplete,
        undoSkip,
        deleteTask,
        getTasksForDate,
        getAllTasksForDate,
        isTaskCompletedOnDate,
        isTaskSkippedOnDate,
        withdrawFromWallet,
        toggleSubtask,
        isSubtaskCompletedOnDate,
        isSubtaskMissed,
        markSubtaskMissed,
        undoMissSubtask,
        toggleSubtaskOnDate,
        getSubtaskProgress,
        toggleParentSubtasks,
        skipDay,
        undoSkipDay,
        isDayOff,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
