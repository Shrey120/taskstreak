import { useState, useEffect } from 'react';
import { Task, DIFFICULTY_MULTIPLIERS } from '@/types/task';
import { useTasks } from '@/contexts/TaskContext';
import { Button } from '@/components/ui/button';
import { Check, Flame, AlertTriangle, Trash2, Zap, X, Clock, ListChecks, Undo2, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MinutesInputDialog } from './MinutesInputDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { getStreakCycleLength } from '@/lib/streakUtils';

interface TaskCardProps {
  task: Task;
  date: Date;
  compact?: boolean;
  onComplete?: (amount: number, element?: HTMLElement) => void;
}

export function TaskCard({ task, date, compact = false, onComplete }: TaskCardProps) {
  const { completeTask, cancelTask, undoSkip, deleteTask, isTaskCompletedOnDate, isTaskSkippedOnDate, toggleSubtask, skipDay, undoSkipDay, isDayOff } = useTasks();
  const [showMinutesDialog, setShowMinutesDialog] = useState(false);
  const isCompleted = isTaskCompletedOnDate(task.id, date);
  const isSkipped = isTaskSkippedOnDate(task.id, date);
  const dayOff = isDayOff(task.id, date);
  const multiplier = DIFFICULTY_MULTIPLIERS[task.difficulty];
  const cycleLength = getStreakCycleLength(task);
  const hasCycle = Number.isFinite(cycleLength) && cycleLength > 0;
  const isOnStreak = task.currentStreak > 0 && (!hasCycle || task.currentStreak % cycleLength !== 0);
  const streakProgress = hasCycle ? task.currentStreak % cycleLength : task.currentStreak;
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks = hasSubtasks ? task.subtasks.filter((s) => s.isCompleted).length : 0;
  const allSubtasksCompleted = hasSubtasks && completedSubtasks === task.subtasks.length;

  // For "at-least X per week" tasks, hide the skip button once the user
  // can no longer afford to skip. Week is Monday-based (per user preference):
  // daysLeftIncludingToday goes from 7 (Mon) down to 1 (Sun).
  // Skip is allowed only while daysLeftIncludingToday > remainingRequired.
  let canSkip = true;
  if (task.frequencyType === 'at-least-weekly') {
    const jsDay = date.getDay(); // 0=Sun..6=Sat
    const daysLeftIncludingToday = jsDay === 0 ? 1 : 8 - jsDay; // Mon=7 ... Sun=1
    // Monday-based week window containing `date`
    const weekStart = new Date(date);
    const daysSinceMon = jsDay === 0 ? 6 : jsDay - 1;
    weekStart.setDate(weekStart.getDate() - daysSinceMon);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const doneThisWeek = task.completions.filter((c) => {
      const cd = new Date(c.date + 'T12:00:00');
      return c.earnedAmount > 0 && cd >= weekStart && cd <= weekEnd;
    }).length;
    const required = task.frequencyValue as number;
    const remainingRequired = Math.max(0, required - doneThisWeek);
    canSkip = daysLeftIncludingToday > remainingRequired;
  }

  useEffect(() => {
    if (allSubtasksCompleted && !isCompleted) {
      if (task.isHourly) {
        setShowMinutesDialog(true);
      } else {
        completeTask(task.id, date);
        onComplete?.(task.amount);
      }
    }
  }, [allSubtasksCompleted, isCompleted, task.id, task.isHourly, task.amount, date, completeTask, onComplete]);

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

  const handleCancel = () => {
    cancelTask(task.id, date);
  };

  const handleUndoSkip = () => {
    undoSkip(task.id, date);
  };

  const handleSkipDay = () => {
    skipDay(task.id, date);
  };

  const handleUndoSkipDay = () => {
    undoSkipDay(task.id, date);
  };

  if (compact) {
      return (
        <>
          <div className={cn(
            'rounded-xl border border-border/50 bg-card/70 px-3 py-2.5 transition-colors duration-200',
            task.streakBrokenThisWeek && 'border-destructive/30 bg-destructive/[0.07]',
            isSkipped && 'border-destructive/30 bg-destructive/[0.07]',
            dayOff && 'border-yellow-400/40 bg-yellow-400/[0.07]',
          )}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {/* Name + chips */}
              <div className="flex min-w-0 flex-[1_1_58%] items-center gap-1.5">
                <span className={cn(
                  'truncate text-[13px] font-semibold',
                  isSkipped && 'text-destructive/80 line-through',
                  dayOff && 'text-yellow-200',
                )}>
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
                <span className={cn(
                  'mr-0.5 font-display text-[13px] font-bold tabular-nums',
                  isSkipped ? 'text-destructive/70' : dayOff ? 'text-yellow-300' : 'text-accent',
                )}>
                  {task.isHourly ? `₹${task.perMinuteRate.toFixed(2)}/m` : `₹${task.amount}`}
                </span>

                {isSkipped ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-primary/30 px-2 text-[11px] text-primary"
                    onClick={handleUndoSkip}
                  >
                    <Undo2 className="mr-1 h-3 w-3" />
                    Undo
                  </Button>
                ) : dayOff ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-yellow-400/40 px-2 text-[11px] text-yellow-300"
                    onClick={handleUndoSkipDay}
                  >
                    <Undo2 className="mr-1 h-3 w-3" />
                    Undo
                  </Button>
                ) : (
                  <>
                    {task.frequencyType === 'at-least-weekly' && canSkip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-yellow-300"
                            onClick={handleSkipDay}
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
                          className="h-8 w-8 p-0 text-destructive/80"
                          onClick={handleCancel}
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

  return (
    <>
      <div className={cn(
        'relative p-4 rounded-xl bg-card/80 border border-border/50 shadow-card transition-colors duration-200 sm:hover:border-primary/30 animate-slide-in group',
        task.streakBrokenThisWeek && 'border-destructive/50 bg-destructive/5 hover:border-destructive/50',
        isSkipped && 'border-destructive/50 bg-destructive/5 opacity-75 hover:border-destructive/50',
        dayOff && 'border-yellow-400/60 bg-yellow-400/10 hover:border-yellow-400/60'
      )}>
        {/* Day-off badge */}
        {dayOff && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400 text-black text-xs font-bold shadow-glow">
            <SkipForward className="w-3 h-3" />
            Skipped today
          </div>
        )}
        {/* Skipped badge */}
        {isSkipped && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full gradient-danger text-destructive-foreground text-xs font-bold shadow-neon-orange">
              <X className="w-3 h-3" />
              Skipped
            </div>
          </div>
        )}
        {/* Hourly task badge */}
        {task.isHourly && (
          <div className="absolute -top-2 -left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold border border-primary/30 shadow-glow">
            <Clock className="w-3 h-3" />
            Hourly
          </div>
        )}

        {/* Streak indicator */}
        {!isSkipped && isOnStreak && !task.streakBrokenThisWeek && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full gradient-primary text-primary-foreground text-xs font-bold shadow-glow animate-pulse-glow">
            <Flame className="w-3 h-3" />
            {task.currentStreak}
          </div>
        )}

        {/* Broken streak warning */}
        {task.streakBrokenThisWeek && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full gradient-danger text-destructive-foreground text-xs font-bold shadow-neon-orange">
            <AlertTriangle className="w-3 h-3" />
            No bonus
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground truncate">{task.name}</h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {task.isHourly ? (
                <div className="flex items-center gap-1 text-accent">
                  <span className="text-lg font-bold font-display neon-text-orange">₹{task.perMinuteRate.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">/min</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-accent">
                  <span className="text-lg font-bold font-display neon-text-orange">₹{task.amount}</span>
                </div>
              )}
              
              {!task.isHourly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground text-xs font-semibold cursor-help border border-border/50 hover:border-primary/30 transition-all duration-300">
                      <Zap className="w-3 h-3 text-primary" />
                      D{task.difficulty} · {multiplier}x
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasCycle ? (
                      <p>Complete a {cycleLength}-day streak for {multiplier}x bonus!</p>
                    ) : (
                      <p>Difficulty multiplier applies on repeat completions</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              
              {task.isHourly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground text-xs font-semibold cursor-help border border-border/50 hover:border-primary/30 transition-all duration-300">
                      +₹0.50/streak
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Rate increases by ₹0.50 after a {hasCycle ? cycleLength : 7}-day streak!</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Streak progress bar */}
            {task.currentStreak > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1 font-body">
                  <span>Streak progress</span>
                  <span className="font-semibold text-primary">
                    {hasCycle ? `${streakProgress}/${cycleLength}` : streakProgress}
                  </span>
                </div>
                {hasCycle && (
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500 shadow-glow"
                      style={{ width: `${(streakProgress / cycleLength) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Subtasks */}
            {hasSubtasks && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                  <ListChecks className="w-3.5 h-3.5 text-primary" />
                  <span>Subtasks ({completedSubtasks}/{task.subtasks.length})</span>
                </div>
                <div className="space-y-1.5">
                  {task.subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg bg-secondary/30 transition-all duration-300 border border-transparent hover:border-primary/20",
                        subtask.isCompleted && "bg-success/10 border-success/20"
                      )}
                    >
                      <Checkbox
                        id={subtask.id}
                        checked={subtask.isCompleted}
                        onCheckedChange={() => toggleSubtask(subtask.id)}
                        className="h-4 w-4"
                      />
                      <label
                        htmlFor={subtask.id}
                        className={cn(
                          "text-sm cursor-pointer flex-1",
                          subtask.isCompleted && "line-through text-muted-foreground"
                        )}
                      >
                        {subtask.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {dayOff ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleUndoSkipDay}
                    className="h-10 w-10 rounded-full text-yellow-300 hover:bg-yellow-400/10 border-yellow-400/40 hover:shadow-glow transition-all duration-300"
                  >
                    <Undo2 className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo skip</TooltipContent>
              </Tooltip>
            ) : isSkipped ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="outline"
                    onClick={handleUndoSkip}
                    className="h-10 w-10 rounded-full text-primary hover:bg-primary/10 border-primary/30 hover:shadow-glow transition-all duration-300"
                  >
                    <Undo2 className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo skip (refunds penalty)</TooltipContent>
              </Tooltip>
            ) : (
              <>
                {task.frequencyType === 'at-least-weekly' && canSkip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleSkipDay}
                        className="h-10 w-10 rounded-full text-primary hover:bg-primary/10 border-primary/30 hover:shadow-glow transition-all duration-300"
                      >
                        <SkipForward className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Skip today (no penalty, no streak impact)</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={handleCancel}
                      className="h-10 w-10 rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30 hover:shadow-neon-orange transition-all duration-300"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fail (breaks streak, penalty)</TooltipContent>
                </Tooltip>
                {!hasSubtasks && (
                  <Button 
                    size="icon" 
                    onClick={handleComplete}
                    className="h-10 w-10 rounded-full hover:shadow-glow transition-all duration-300"
                  >
                    <Check className="w-5 h-5" />
                  </Button>
                )}
              </>
            )}
            <Button 
              size="icon" 
              variant="ghost"
              onClick={() => deleteTask(task.id)}
              className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
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
