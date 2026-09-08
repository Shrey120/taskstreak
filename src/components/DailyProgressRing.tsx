import { useMemo } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { format } from 'date-fns';

interface DailyProgressRingProps {
  size?: number;
  strokeWidth?: number;
}

export function DailyProgressRing({ size = 44, strokeWidth = 3.5 }: DailyProgressRingProps) {
  const { tasks, isTaskCompletedOnDate } = useTasks();
  const today = new Date();

  const { completed, total } = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const dayOfWeek = today.getDay();
    const dayOfMonth = today.getDate();
    const dayName = format(today, 'EEEE').toLowerCase();

    const dueTasks = tasks.filter(task => {
      if (task.startDate > todayStr) return false;
      switch (task.frequencyType) {
        case 'weekly':
          return (task.frequencyValue as number[]).includes(dayOfWeek);
        case 'monthly':
          return (task.frequencyValue as number[]).includes(dayOfMonth);
        case 'specific-date':
          return task.frequencyValue === todayStr;
        case 'specific-day':
          return task.frequencyValue === dayName;
        case 'at-least-weekly':
        case 'at-least-monthly':
          return true;
        default:
          return false;
      }
    });

    const completedCount = dueTasks.filter(t => isTaskCompletedOnDate(t.id, today)).length;
    return { completed: completedCount, total: dueTasks.length };
  }, [tasks, today]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? completed / total : 0;
  const offset = circumference - progress * circumference;
  const isComplete = total > 0 && completed === total;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(230 15% 14%)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isComplete ? "hsl(160 100% 50%)" : "url(#progressGradient)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-700 ease-out ${isComplete ? 'drop-shadow-[0_0_6px_hsl(160_100%_50%_/_0.6)]' : ''}`}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(160 100% 50%)" />
            <stop offset="100%" stopColor="hsl(280 100% 65%)" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold font-display ${isComplete ? 'text-primary neon-text' : 'text-foreground'}`}>
          {total > 0 ? `${completed}` : '—'}
        </span>
      </div>
    </div>
  );
}
