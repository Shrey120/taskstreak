import { useMemo } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DailyProgressRingProps {
  size?: number;
  strokeWidth?: number;
}

export function DailyProgressRing({ size = 44, strokeWidth = 3.5 }: DailyProgressRingProps) {
  const { tasks, getAllTasksForDate, isTaskCompletedOnDate } = useTasks();

  // Recomputing on every render was the old behaviour: `today` was a fresh
  // Date each pass, so it never matched as a memo dependency. Key off the day
  // string instead.
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { completed, total } = useMemo(() => {
    const today = new Date();
    // Reuse the context's scheduling rules rather than a fifth copy of them —
    // this one used to count every flexible task as due even after its weekly
    // quota was already met.
    const dueTasks = getAllTasksForDate(today);
    const completedCount = dueTasks.filter((t) => isTaskCompletedOnDate(t.id, today)).length;
    return { completed: completedCount, total: dueTasks.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, todayStr]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? completed / total : 0;
  const offset = circumference - progress * circumference;
  const isComplete = total > 0 && completed === total;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        total > 0
          ? `${completed} of ${total} tasks done today`
          : 'Nothing scheduled today'
      }
      title={
        total > 0
          ? `${completed}/${total} done today`
          : 'Nothing scheduled today'
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isComplete ? 'hsl(var(--success))' : 'url(#progressGradient)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'transition-all duration-700 ease-out',
            isComplete && 'drop-shadow-[0_0_6px_hsl(var(--success)/0.6)]',
          )}
        />
        <defs>
          {/* Theme tokens, not the app's previous cyan/purple palette */}
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            'font-display text-xs font-bold tabular-nums',
            isComplete ? 'text-success' : 'text-foreground',
          )}
        >
          {total > 0 ? `${completed}` : '—'}
        </span>
      </div>
    </div>
  );
}
