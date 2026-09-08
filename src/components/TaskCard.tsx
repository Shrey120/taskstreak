import { useState } from 'react';
import { Task } from '@/types/task';
import { useTasks } from '@/contexts/TaskContext';
import { Button } from '@/components/ui/button';
import { Check, Flame, Clock, Undo2, X, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MinutesInputDialog } from './MinutesInputDialog';
import { getStreakCycleLength } from '@/lib/streakUtils';
import { canAffordDayOff } from '@/lib/periodUtils';

interface TaskCardProps {
  task: Task;
  date: Date;
  /** Retained for call-site compatibility; the row has one layout now. */
  compact?: boolean;
  onComplete?: (amount: number, element?: HTMLElement) => void;
}

/**
 * A single actionable task row in the timeline.
 *
 * This used to carry a second, much larger "expanded" layout rendered only by
 * GridView, which nothing routed to. That layout also held a legacy effect that
 * auto-completed a task from the global `subtasks[].isCompleted` flags rather
 * than the per-date completion set — so it could complete a task on whatever
 * day happened to be on screen. Both are gone; per-date subtasks are handled by
 * TimelineView's ParentTaskRow.
 */
export function TaskCard({ task, date, onComplete }: TaskCardProps) {
  const {
    completeTask, cancelTask, undoSkip,
    isTaskCompletedOnDate, isTaskSkippedOnDate,
    skipDay, undoSkipDay, isDayOff,
  } = useTasks();
  const [showMinutesDialog, setShowMinutesDialog] = useState(false);

  const isCompleted = isTaskCompletedOnDate(task.id, date);
  const isSkipped = isTaskSkippedOnDate(task.id, date);
  const dayOff = isDayOff(task.id, date);
  const cycleLength = getStreakCycleLength(task);
  const hasCycle = Number.isFinite(cycleLength) && cycleLength > 0;
  const isOnStreak = task.currentStreak > 0 && (!hasCycle || task.currentStreak % cycleLength !== 0);

  // Single source of truth (periodUtils). This used to be a local
  // reimplementation that disagreed with both TimelineView's copy and the week
  // boundary the streak logic uses.
  const canSkip = canAffordDayOff(task, date);

  if (isCompleted) return null;

  const handleComplete = (e?: React.MouseEvent) => {
    if (task.isHourly) {
      setShowMinutesDialog(true);
    } else {
      completeTask(task.id, date);
      onComplete?.(task.amount, e?.currentTarget as HTMLElement);
    }
  };

  const handleHourlyComplete = (minutes: number) => {
    completeTask(task.id, date, minutes);
    onComplete?.(minutes * task.perMinuteRate);
  };

  return (
    <>
      <div
        className={cn(
          'rounded-xl border border-border/50 bg-card/70 px-3 py-2.5 transition-colors duration-200',
          'hover:border-border lg:px-4 lg:py-3',
          isSkipped && 'border-destructive/30 bg-destructive/[0.07]',
          dayOff && 'border-yellow-400/40 bg-yellow-400/[0.07]',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {/* Name + chips */}
          <div className="flex min-w-0 flex-[1_1_58%] items-center gap-1.5">
            <span
              className={cn(
                'truncate text-[13px] font-semibold lg:text-sm',
                isSkipped && 'text-destructive/80 line-through',
                dayOff && 'text-yellow-200',
              )}
            >
              {task.name}
            </span>
            {!isSkipped && !dayOff && task.isHourly && (
              <Clock className="h-3 w-3 shrink-0 text-primary/70" />
            )}
            {!isSkipped && !dayOff && isOnStreak && (
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary">
                <Flame className="h-3 w-3" />
                {task.currentStreak}
              </span>
            )}
          </div>

          {/* Amount + actions */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <span
              className={cn(
                'mr-0.5 font-display text-[13px] font-bold tabular-nums lg:text-sm',
                isSkipped ? 'text-destructive/70' : dayOff ? 'text-yellow-300' : 'text-accent',
              )}
            >
              {task.isHourly ? `₹${task.perMinuteRate.toFixed(2)}/m` : `₹${task.amount}`}
            </span>

            {isSkipped ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-primary/30 px-2 text-[11px] text-primary"
                onClick={() => undoSkip(task.id, date)}
              >
                <Undo2 className="mr-1 h-3 w-3" />
                Undo
              </Button>
            ) : dayOff ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-yellow-400/40 px-2 text-[11px] text-yellow-300"
                onClick={() => undoSkipDay(task.id, date)}
              >
                <Undo2 className="mr-1 h-3 w-3" />
                Undo
              </Button>
            ) : (
              <>
                {canSkip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-yellow-300 hover:bg-yellow-400/10"
                        onClick={() => skipDay(task.id, date)}
                        aria-label="Skip today"
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Skip today (no penalty, no streak impact)</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => cancelTask(task.id, date)}
                      aria-label="Fail task"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fail task (breaks streak, penalty)</TooltipContent>
                </Tooltip>
                <Button
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleComplete}
                  aria-label="Complete task"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <MinutesInputDialog
        open={showMinutesDialog}
        onOpenChange={setShowMinutesDialog}
        taskName={task.name}
        perMinuteRate={task.perMinuteRate}
        onConfirm={handleHourlyComplete}
      />
    </>
  );
}
