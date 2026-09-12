import type { TraitId } from '@/lib/xpUtils';
import type { EveryNWeeksValue } from '@/lib/schedule';

/**
 * `specific-day` is legacy: it is folded into `weekly` on read by
 * normalizeFrequency and is never written for new tasks. It stays in the
 * union so stored rows still type-check.
 */
export type FrequencyType = 'weekly' | 'monthly' | 'every-n-weeks' | 'specific-date' | 'specific-day' | 'at-least-weekly' | 'at-least-monthly';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Task {
  id: string;
  name: string;
  frequencyType: FrequencyType;
  frequencyValue: number[] | string | DayOfWeek | number | EveryNWeeksValue | AtLeastValue; // days of week (0-6), day of month (1-31), date string, day name, minimum count (legacy) or {quota, excludedDays}, or every-N-weeks config
  amount: number;
  baseAmount: number;
  /** Money growth: the multiplier applied when a streak cycle closes. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** XP weight: how much effort one completion represents. Independent of
   *  difficulty, so throttling a task's money growth no longer cuts its XP. */
  effortWeight: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  startDate: string; // yyyy-MM-dd format
  scheduledTime: string | null; // HH:mm format or null
  completions: TaskCompletion[];
  currentStreak: number;
  streaksCompleted: number;
  streakBrokenThisWeek: boolean;
  isHourly: boolean;
  perMinuteRate: number;
  subtasks: Subtask[];
  traits: TraitId[];
}

export interface TaskCompletion {
  date: string;
  earnedAmount: number;
  wasStreakBonus: boolean;
  /**
   * What the wallet was actually charged when this task was failed. Recorded
   * so the refund on undo matches the charge exactly, and so the report can
   * value a past failure at its real cost rather than today's compounded
   * amount. Undefined for successful completions and for rows written before
   * this was stored.
   */
  penaltyAmount?: number;
}

/**
 * `frequencyValue` shape for `at-least-weekly` / `at-least-monthly`.
 *
 * `excludedDays` (JS getDay(): 0 = Sunday) are days this task is never
 * expected on at all -- they don't count toward the period's available pool,
 * so "5 days/week excluding Sunday" means 5 of the 6 remaining days, not 5
 * of 7. A plain number is still accepted as legacy shorthand for a quota
 * with no exclusions; see getAtLeastConfig in lib/schedule.ts.
 */
export interface AtLeastValue {
  quota: number;
  excludedDays?: number[];
}

export interface Subtask {
  id: string;
  taskId: string;
  name: string;
  isCompleted: boolean;
  scheduledTime: string; // HH:mm — required
}

export const DIFFICULTY_MULTIPLIERS: Record<number, number> = {
  1: 1.5,
  2: 2,
  3: 2.5,
  4: 3,
  5: 4,
};

export const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};
