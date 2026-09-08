import type { TraitId } from '@/lib/xpUtils';

export type FrequencyType = 'weekly' | 'monthly' | 'specific-date' | 'specific-day' | 'at-least-weekly' | 'at-least-monthly';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Task {
  id: string;
  name: string;
  frequencyType: FrequencyType;
  frequencyValue: number[] | string | DayOfWeek | number; // days of week (0-6), day of month (1-31), date string, day name, or minimum count
  amount: number;
  baseAmount: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
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
