import { useState, useMemo } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { Task, DIFFICULTY_MULTIPLIERS, DAY_LABELS, DAYS_OF_WEEK } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Trash2, Flame, TrendingUp, Zap, Award, Pencil, Clock, DollarSign, BarChart3, Calendar, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditTaskDialog } from './EditTaskDialog';
import { ConfirmDeleteTask } from './ConfirmDeleteTask';
import { format, parseISO, eachDayOfInterval, differenceInDays, isAfter, isBefore, isEqual } from 'date-fns';
import { getStreakCycleLength } from '@/lib/streakUtils';
import { isEveryNWeeksValue, isTaskDueOn, isPausedOn, getAtLeastConfig } from '@/lib/schedule';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SortOption = 'none' | 'money-asc' | 'money-desc';

export function AllTasksView({ onSelectHabit }: { onSelectHabit?: (task: Task) => void } = {}) {
  const { tasks, deleteTask, pauseRanges, dayOffSet } = useTasks();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [analyticsTask, setAnalyticsTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('none');

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setEditDialogOpen(true);
  };

  const getFrequencyLabel = (task: Task) => {
    switch (task.frequencyType) {
      case 'weekly':
        return `${(task.frequencyValue as number[]).length} days/week`;
      case 'monthly':
        return `${(task.frequencyValue as number[]).length} days/month`;
      case 'every-n-weeks': {
        const v = task.frequencyValue;
        if (!isEveryNWeeksValue(v)) return 'Every few weeks';
        return v.interval === 2
          ? `${v.days.length} days, every other week`
          : `${v.days.length} days, every ${v.interval} weeks`;
      }
      case 'at-least-weekly':
      case 'at-least-monthly': {
        const { quota, excludedDays } = getAtLeastConfig(task.frequencyValue);
        const per = task.frequencyType === 'at-least-weekly' ? 'week' : 'month';
        const excl = excludedDays.length
          ? ` (excl. ${excludedDays.map((d) => DAY_LABELS[DAYS_OF_WEEK[(d + 6) % 7]]).join(', ')})`
          : '';
        return `At least ${quota} days/${per}${excl}`;
      }
      case 'specific-day':
        return `Every ${task.frequencyValue}`;
      case 'specific-date':
        return `On ${task.frequencyValue}`;
      default:
        return '';
    }
  };

  const getTotalEarnings = (task: Task) => 
    task.completions.reduce((sum, c) => sum + c.earnedAmount, 0);

  // Calculate global insights
  const globalInsights = useMemo(() => {
    let totalEarned = 0;
    let totalLost = 0;
    let brokenStreaks = 0;

    tasks.forEach(task => {
      // Total earned
      totalEarned += task.completions.reduce((sum, c) => sum + c.earnedAmount, 0);

      // Calculate missed days and lost amount
      const startDate = parseISO(task.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // A task created today (or later) has no elapsed days to have missed yet.
      // eachDayOfInterval does not validate start <= end -- given a startDate of
      // today and an end of yesterday, it silently walks BACKWARD and returns
      // dates from before the task existed, which then got counted as missed.
      // That is exactly what inflated Total Lost for a brand-new task.
      if (isAfter(startDate, yesterday)) return;

      const daysToCheck = eachDayOfInterval({ start: startDate, end: yesterday });

      const completedDates = new Set(task.completions.map(c => c.date));

      daysToCheck.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (completedDates.has(dateStr)) return;
        // A skipped or paused day was never a real obligation -- it cost
        // nothing when it happened, so it should not read as a loss here.
        if (dayOffSet.has(`${task.id}|${dateStr}`)) return;
        if (isPausedOn(pauseRanges, dateStr)) return;
        if (!isTaskDueOn(task, date)) return;

        // Missed this day - add potential earnings to lost
        if (task.isHourly) {
          totalLost += task.perMinuteRate * 30; // Assume 30 min session
        } else {
          totalLost += task.amount;
        }
      });

      // Count broken streaks (streaksCompleted shows how many 7-day streaks completed)
      // We can estimate broken streaks from the difference between expected and current
      // A simple heuristic: if currentStreak is 0 and there are completions, streak was broken
      if (task.currentStreak === 0 && task.completions.length > 0) {
        brokenStreaks++;
      }
    });

    return { totalEarned, totalLost, brokenStreaks };
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    if (sortOption === 'none') return tasks;
    
    return [...tasks].sort((a, b) => {
      const earningsA = getTotalEarnings(a);
      const earningsB = getTotalEarnings(b);
      return sortOption === 'money-asc' 
        ? earningsA - earningsB 
        : earningsB - earningsA;
    });
  }, [tasks, sortOption]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl bg-card border border-dashed border-border">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
          <Award className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground mb-1">No tasks yet</p>
        <p className="text-sm text-muted-foreground text-center">
          Create your first task to start tracking!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Global Insights */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Total Earned</span>
            </div>
            <p className="text-lg font-bold text-accent">₹{globalInsights.totalEarned.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Total Lost</span>
            </div>
            <p className="text-lg font-bold text-destructive">₹{globalInsights.totalLost.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Broken Streaks</span>
            </div>
            <p className="text-lg font-bold text-orange-500">{globalInsights.brokenStreaks}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">All Tasks</h2>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  {sortOption === 'money-asc' && <ArrowUp className="w-3.5 h-3.5" />}
                  {sortOption === 'money-desc' && <ArrowDown className="w-3.5 h-3.5" />}
                  {sortOption === 'none' && <ArrowUpDown className="w-3.5 h-3.5" />}
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortOption('none')}>
                  Default
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('money-asc')}>
                  <ArrowUp className="w-3.5 h-3.5 mr-2" />
                  Earnings: Low to High
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOption('money-desc')}>
                  <ArrowDown className="w-3.5 h-3.5 mr-2" />
                  Earnings: High to Low
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-sm text-muted-foreground">{tasks.length} total</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sortedTasks.map((task) => (
            <TaskDetailCard 
              key={task.id} 
              task={task} 
              onDelete={() => setDeletingTask(task)}
              onEdit={() => handleEdit(task)}
              onViewAnalytics={() => setAnalyticsTask(task)}
              onOpen={onSelectHabit ? () => onSelectHabit(task) : undefined}
              getFrequencyLabel={getFrequencyLabel} 
            />
          ))}
        </div>
      </div>

      <EditTaskDialog 
        task={editingTask} 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />

      <TaskAnalyticsDialog
        task={analyticsTask}
        open={!!analyticsTask}
        onOpenChange={(open) => !open && setAnalyticsTask(null)}
      />

      <ConfirmDeleteTask
        taskName={deletingTask?.name ?? null}
        completionCount={deletingTask?.completions.length ?? 0}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        onConfirm={() => {
          if (deletingTask) deleteTask(deletingTask.id);
          setDeletingTask(null);
        }}
      />
    </>
  );
}

interface TaskDetailCardProps {
  task: Task;
  onDelete: () => void;
  onEdit: () => void;
  onViewAnalytics: () => void;
  onOpen?: () => void;
  getFrequencyLabel: (task: Task) => string;
}

function TaskDetailCard({ task, onDelete, onEdit, onViewAnalytics, onOpen, getFrequencyLabel }: TaskDetailCardProps) {
  const multiplier = DIFFICULTY_MULTIPLIERS[task.difficulty];
  const cycleLength = getStreakCycleLength(task);
  const hasCycle = Number.isFinite(cycleLength) && cycleLength > 0;
  const hasIncremented = task.isHourly 
    ? task.perMinuteRate > (task.baseAmount || task.perMinuteRate) 
    : task.amount > task.baseAmount;
  const incrementCount = task.streaksCompleted;

  // Calculate total earnings
  const totalEarnings = task.completions.reduce((sum, c) => sum + c.earnedAmount, 0);

  return (
    <div className="relative p-4 rounded-xl bg-card border border-border shadow-card transition-colors duration-200 hover:border-primary/30 group">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={onOpen}
              disabled={!onOpen}
              className={cn(
                'font-semibold text-foreground truncate text-left w-full',
                onOpen && 'hover:text-primary transition-colors cursor-pointer',
              )}
              title={onOpen ? 'Open habit dashboard' : undefined}
            >
              {task.name}
            </button>
            {/*
              The streak and hourly badges used to be absolutely positioned at
              -top-2/-left-2 — outside the card — where they overlapped whichever
              card sat next to them in the grid. Inline here they also keep every
              card's title on the same baseline.
            */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-xs text-muted-foreground">{getFrequencyLabel(task)}</p>
              {task.isHourly && (
                <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary">
                  <Clock className="w-2.5 h-2.5" />
                  Hourly
                </span>
              )}
              {task.currentStreak > 0 && (
                <span className="flex items-center gap-1 rounded-full gradient-primary px-1.5 py-px text-[10px] font-bold tabular-nums text-primary-foreground">
                  <Flame className="w-2.5 h-2.5" />
                  {task.currentStreak}
                </span>
              )}
            </div>
          </div>
          {/*
            These were opacity-0 until :group-hover, which made edit, delete and
            analytics unreachable on any touch device. They are now always
            visible where there is no hover, and reveal on hover on desktop.
          */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={onViewAnalytics}
              aria-label="View analytics"
              title="View analytics"
              className="h-9 w-9 rounded-full text-muted-foreground transition-opacity hover:text-primary [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              aria-label="Edit task"
              title="Edit task"
              className="h-9 w-9 rounded-full text-muted-foreground transition-opacity hover:text-primary [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              aria-label="Delete task"
              title="Delete task"
              className="h-9 w-9 rounded-full text-muted-foreground transition-opacity hover:text-destructive [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Total Earnings */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/10 border border-accent/20">
          <DollarSign className="w-4 h-4 text-accent" />
          <span className="text-xs text-muted-foreground">Total Earned:</span>
          <span className="text-sm font-bold text-accent ml-auto">₹{totalEarnings.toFixed(2)}</span>
        </div>

        {/* Pay Info */}
        <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
          {task.isHourly ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Rate</span>
                <span className={cn("text-sm font-bold", hasIncremented ? "text-accent" : "text-foreground")}>
                  ₹{task.perMinuteRate.toFixed(2)}/min
                  {hasIncremented && <TrendingUp className="w-3 h-3 inline ml-1" />}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Streaks</span>
                <span className="text-sm font-semibold text-primary">{incrementCount}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Base</span>
                <span className="text-sm font-medium text-foreground">₹{task.baseAmount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Current</span>
                <span className={cn("text-sm font-bold", hasIncremented ? "text-accent" : "text-foreground")}>
                  ₹{task.amount}
                  {hasIncremented && <TrendingUp className="w-3 h-3 inline ml-1" />}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Streaks</span>
                <span className="text-sm font-semibold text-primary">{incrementCount}</span>
              </div>
            </>
          )}
        </div>

        {/* Difficulty & Progress */}
        <div className="flex items-center justify-between">
          {task.isHourly ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Clock className="w-3 h-3" />
              Time-based
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
              <Zap className="w-3 h-3" />
              D{task.difficulty} · {multiplier}x
            </div>
          )}
          {task.currentStreak > 0 && hasCycle && (
            <div className="text-xs text-muted-foreground">
              {task.currentStreak % cycleLength}/{cycleLength} to next
            </div>
          )}
        </div>

        {/* Streak progress */}
        {task.currentStreak > 0 && hasCycle && (
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary transition-all duration-500"
              style={{ width: `${((task.currentStreak % cycleLength) / cycleLength) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskAnalyticsDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TaskAnalyticsDialog({ task, open, onOpenChange }: TaskAnalyticsDialogProps) {
  if (!task) return null;

  const completions = task.completions;
  const totalEarnings = completions.reduce((sum, c) => sum + c.earnedAmount, 0);
  const totalCompletions = completions.length;
  const streakBonusEarnings = completions.filter(c => c.wasStreakBonus).reduce((sum, c) => sum + c.earnedAmount, 0);
  
  // Calculate the number of days the task was scheduled to be performed
  const calculateScheduledDays = () => {
    const startDate = parseISO(task.startDate);
    const today = new Date();
    const daysSinceStart = differenceInDays(today, startDate);
    
    if (daysSinceStart < 0) return 0;
    
    const daysToCheck = eachDayOfInterval({ start: startDate, end: today });

    let scheduledDays = 0;
    daysToCheck.forEach(date => {
      if (isTaskDueOn(task, date)) scheduledDays++;
    });

    return scheduledDays;
  };
  
  const scheduledDays = calculateScheduledDays();
  const averageEarning = scheduledDays > 0 ? totalEarnings / scheduledDays : 0;

  // Get last 10 completions for recent history
  const recentCompletions = [...completions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  // Monthly breakdown
  const monthlyData: Record<string, number> = {};
  completions.forEach(c => {
    const month = format(parseISO(c.date), 'MMM yyyy');
    monthlyData[month] = (monthlyData[month] || 0) + c.earnedAmount;
  });

  const sortedMonths = Object.entries(monthlyData)
    .sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 6);

  const maxMonthlyEarning = Math.max(...sortedMonths.map(([, v]) => v), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {task.name} - Analytics
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground">Total Earned</span>
              </div>
              <p className="text-xl font-bold text-accent">₹{totalEarnings.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Completions</span>
              </div>
              <p className="text-xl font-bold text-primary">{totalCompletions}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-foreground" />
                <span className="text-xs text-muted-foreground">Avg Earning</span>
              </div>
              <p className="text-xl font-bold text-foreground">₹{averageEarning.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Streak Bonus</span>
              </div>
              <p className="text-xl font-bold text-foreground">₹{streakBonusEarnings.toFixed(2)}</p>
            </div>
          </div>

          {/* Monthly Breakdown */}
          {sortedMonths.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Monthly Breakdown
              </h4>
              <div className="space-y-2">
                {sortedMonths.map(([month, amount]) => (
                  <div key={month} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{month}</span>
                      <span className="font-medium text-foreground">₹{amount.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${(amount / maxMonthlyEarning) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Completions */}
          {recentCompletions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Recent Completions</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {recentCompletions.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/50 text-sm">
                    <span className="text-muted-foreground">
                      {format(parseISO(c.date), 'dd MMM yyyy')}
                    </span>
                    <div className="flex items-center gap-2">
                      {c.wasStreakBonus && <Flame className="w-3 h-3 text-orange-500" />}
                      <span className="font-medium text-foreground">₹{c.earnedAmount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalCompletions === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <p>No completions yet</p>
              <p className="text-xs mt-1">Complete this task to see analytics</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}