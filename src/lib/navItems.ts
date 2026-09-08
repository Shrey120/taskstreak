import type { ComponentType } from 'react';
import {
  Clock, Layers, List, Flame, BookOpen,
  Coins, Trophy, Target, XCircle, CalendarDays, TrendingUp, Zap, TrendingDown,
} from 'lucide-react';
import type { HabitMetric } from '@/components/HabitMetricView';

export type CoreView = 'timeline' | 'stack' | 'all' | 'growth' | 'codex';
export type ViewType = CoreView | `metric:${HabitMetric}`;

export interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const CORE_TABS: NavItem<CoreView>[] = [
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'stack', label: 'Stack', icon: Layers },
  { id: 'all', label: 'All tasks', icon: List },
  { id: 'growth', label: 'Growth', icon: Flame },
  { id: 'codex', label: 'Codex', icon: BookOpen },
];

export const METRIC_TABS: NavItem<HabitMetric>[] = [
  { id: 'earned', label: 'Earned', icon: Coins },
  { id: 'best', label: 'Best streak', icon: Trophy },
  { id: 'rate', label: 'Rate', icon: Target },
  { id: 'skipped', label: 'Skipped', icon: XCircle },
  { id: 'heatmap', label: 'Heatmap', icon: CalendarDays },
  { id: 'chart', label: '6-month', icon: TrendingUp },
  { id: 'reward', label: 'Reward', icon: Zap },
  { id: 'loss', label: 'Loss', icon: TrendingDown },
];

/** The four destinations that get a slot in the bottom bar on phones. */
export const BOTTOM_NAV: NavItem<CoreView>[] = CORE_TABS.filter((t) =>
  ['timeline', 'stack', 'all', 'growth'].includes(t.id),
);

/** Human-readable label for whatever is currently on screen. */
export function labelForView(view: ViewType): string {
  if (view.startsWith('metric:')) {
    const id = view.split(':')[1] as HabitMetric;
    return METRIC_TABS.find((m) => m.id === id)?.label ?? 'Metric';
  }
  return CORE_TABS.find((t) => t.id === view)?.label ?? 'TaskStreak';
}
