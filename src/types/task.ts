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
  frequencyValue: number[] | string | DayOfWeek | number | EveryNWeeksValue; // days of week (0-6), day of month (1-31), date string, day name, minimum count, or every-N-weeks config
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
