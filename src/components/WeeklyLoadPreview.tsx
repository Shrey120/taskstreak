import { useMemo } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { isTaskDueOn } from '@/lib/schedule';
import { cn } from '@/lib/utils';

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface WeeklyLoadPreviewProps {
  /** Days the user is currently choosing, JS getDay() values. */
  selectedDays: number[];
  /** Task being edited, so it isn't double-counted against itself. */
  excludeTaskId?: string;
}

/**
 * How many tasks already land on each weekday, with the days being chosen
 * stacked on top. Makes an overloaded Monday visible while you're picking
 * rather than a week later.
 */
export function WeeklyLoadPreview({ selectedDays, excludeTaskId }: WeeklyLoadPreviewProps) {
  const { tasks } = useTasks();

  const existing = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    // Probe one real week so every frequency type is counted by the same rule
    // the scheduler uses, rather than by re-reading frequencyValue here.
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (const task of tasks) {
      if (task.id === excludeTaskId) continue;
      if (task.frequencyType === 'at-least-weekly' || task.frequencyType === 'at-least-monthly') continue;
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        if (isTaskDueOn(task, d)) counts[d.getDay()]++;
      }
    }
    return counts;
  }, [tasks, excludeTaskId]);

  const totals = existing.map((n, i) => n + (selectedDays.includes(i) ? 1 : 0));
  const peak = Math.max(1, ...totals);

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1.5 h-12">
        {totals.map((total, i) => {
          const chosen = selectedDays.includes(i);
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-muted-foreground leading-none">
                {total > 0 ? total : ''}
              </span>
              <div
                className={cn(
                  'w-full rounded-sm transition-all',
                  chosen ? 'gradient-primary' : 'bg-secondary',
                )}
                style={{ height: `${Math.max(total > 0 ? 10 : 3, (total / peak) * 32)}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {LABELS.map((l, i) => (
          <span
            key={i}
            className={cn(
              'flex-1 text-center text-[10px] font-medium',
              selectedDays.includes(i) ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {l}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tasks landing on each day this week, including this one.
      </p>
    </div>
  );
}
