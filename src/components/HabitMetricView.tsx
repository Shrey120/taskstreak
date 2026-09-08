import { useMemo } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { Task } from '@/types/task';
import {
  format, parseISO, subDays, startOfWeek, addDays, differenceInCalendarDays,
  isAfter, eachDayOfInterval, startOfMonth, isSameMonth,
} from 'date-fns';
import {
  Flame, Trophy, Target, Coins, XCircle, Zap, TrendingUp, Calendar as CalendarIcon, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStreakCycleLength } from '@/lib/streakUtils';

export type HabitMetric =
  | 'earned' | 'best' | 'rate' | 'skipped' | 'heatmap' | 'chart' | 'reward' | 'loss';


interface Props {
  metric: HabitMetric;
}

type HabitStats = {
  task: Task;
  totalEarned: number;
  totalLoss: number;

  skips: number;
  best: number;
  completionPct: number;
  untilMilestone: number;
  months: { label: string; earned: number }[];
  heatmap: {
    days: Date[];
    map: Map<string, { done: boolean; failed: boolean; dayOff: boolean; amount: number }>;
  };
};

function computeStats(task: Task, dayOffSet: Set<string>): HabitStats {
  const successes = task.completions.filter((c) => c.earnedAmount > 0);
  const totalEarned = successes.reduce((s, c) => s + c.earnedAmount, 0);
  const failures = task.completions.filter((c) => c.earnedAmount === 0);
  const skips = failures.length;
  const penaltyPerFailure = task.isHourly ? 200 * (task.perMinuteRate || 0) : (task.amount || 0);
  const totalLoss = failures.length * penaltyPerFailure;

  const startDate = parseISO(task.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = successes.map((c) => c.date).sort();
  let best = 0, run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    if (!prev) run = 1;
    else {
      const diff = differenceInCalendarDays(parseISO(d), parseISO(prev));
      run = diff === 1 ? run + 1 : 1;
    }
    best = Math.max(best, run);
    prev = d;
  }

  const daysActive = Math.max(1, differenceInCalendarDays(today, startDate) + 1);
  const completionPct = Math.min(100, Math.round((successes.length / daysActive) * 100));

  const nextMilestone = getStreakCycleLength(task);
  const hasCycle = Number.isFinite(nextMilestone) && nextMilestone > 0;
  const untilMilestone = hasCycle ? nextMilestone - (task.currentStreak % nextMilestone) : Infinity;

  const months: { label: string; earned: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = startOfMonth(subDays(new Date(), i * 30));
    const total = successes
      .filter((c) => isSameMonth(parseISO(c.date), m))
      .reduce((s, c) => s + c.earnedAmount, 0);
    months.push({ label: format(m, 'MMM'), earned: total });
  }

  const end = startOfWeek(new Date(), { weekStartsOn: 1 });
  const start = subDays(end, 25 * 7);
  const days = eachDayOfInterval({ start, end: addDays(end, 6) });
  const map = new Map<string, { done: boolean; failed: boolean; dayOff: boolean; amount: number }>();
  task.completions.forEach((c) => {
    map.set(c.date, {
      done: c.earnedAmount > 0,
      failed: c.earnedAmount === 0,
      dayOff: dayOffSet.has(`${task.id}|${c.date}`),
      amount: c.earnedAmount,
    });
  });
  // Day-off entries may not have a completion record, so overlay them explicitly.
  for (const key of dayOffSet) {
    if (!key.startsWith(`${task.id}|`)) continue;
    const date = key.slice(task.id.length + 1);
    if (!map.has(date)) {
      map.set(date, { done: false, failed: false, dayOff: true, amount: 0 });
    }
  }
  

  return {
    task, totalEarned, totalLoss, skips, best, completionPct, untilMilestone, months,
    heatmap: { days, map },
  };
}


const METRIC_CONFIG: Record<HabitMetric, {
  title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>;
}> = {
  earned: { title: 'Total Earned', subtitle: 'Lifetime rupees earned per habit', icon: Coins },
  best: { title: 'Best Streak', subtitle: 'Longest consecutive-day run', icon: Trophy },
  rate: { title: 'Completion Rate', subtitle: 'Success rate since habit start', icon: Target },
  skipped: { title: 'Skipped', subtitle: 'Times you canceled a due task', icon: XCircle },
  heatmap: { title: 'Last 26 Weeks', subtitle: 'GitHub-style activity heatmap', icon: CalendarIcon },
  chart: { title: 'Last 6 Months', subtitle: 'Monthly earnings trend', icon: TrendingUp },
  reward: { title: 'Next Reward', subtitle: 'Days remaining to next milestone', icon: Zap },
  loss: { title: 'Total Loss', subtitle: 'All-time rupees lost to failed tasks', icon: TrendingDown },

};

export function HabitMetricView({ metric }: Props) {
  const { tasks, dayOffSet } = useTasks();

  const stats = useMemo(() => tasks.map((task) => computeStats(task, dayOffSet)), [tasks, dayOffSet]);

  const sorted = useMemo(() => {
    const arr = [...stats];
    switch (metric) {
      case 'earned': return arr.sort((a, b) => b.totalEarned - a.totalEarned);
      case 'best': return arr.sort((a, b) => b.best - a.best);
      case 'rate': return arr.sort((a, b) => b.completionPct - a.completionPct);
      case 'skipped': return arr.sort((a, b) => b.skips - a.skips);
      case 'reward': return arr.sort((a, b) => a.untilMilestone - b.untilMilestone);
      case 'loss': return arr.sort((a, b) => b.totalLoss - a.totalLoss);

      case 'chart': return arr.sort((a, b) =>
        b.months.reduce((s, m) => s + m.earned, 0) - a.months.reduce((s, m) => s + m.earned, 0));
      case 'heatmap':
      default:
        return arr.sort((a, b) => b.task.currentStreak - a.task.currentStreak);
    }
  }, [stats, metric]);

  const cfg = METRIC_CONFIG[metric];
  const Icon = cfg.icon;

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/50 p-12 text-center animate-fade-in">
        <p className="text-muted-foreground">No habits yet. Create one to start tracking.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-glow">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{cfg.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{cfg.subtitle}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.map((s, i) => (
          <MetricRow key={s.task.id} stats={s} metric={metric} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

function MetricRow({ stats, metric, rank }: { stats: HabitStats; metric: HabitMetric; rank: number }) {
  const { task } = stats;
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-card p-3 sm:p-4 hover:border-primary/40 transition-all">
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-black tabular-nums',
          rank === 1 ? 'bg-primary/20 text-primary border border-primary/40' :
          rank === 2 ? 'bg-accent/15 text-accent border border-accent/30' :
          rank === 3 ? 'bg-secondary text-foreground border border-border' :
          'bg-secondary/50 text-muted-foreground border border-border/50',
        )}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-foreground truncate">{task.name}</h3>
            {task.currentStreak > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent shrink-0">
                <Flame className="w-3 h-3" />
                {task.currentStreak}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground truncate">
            Diff {task.difficulty} · {task.isHourly ? 'Hourly' : `₹${task.baseAmount}`} · Since {format(parseISO(task.startDate), 'MMM d')}
          </p>
        </div>

        <div className="shrink-0">
          <MetricValue stats={stats} metric={metric} />
        </div>
      </div>

      {(metric === 'heatmap' || metric === 'chart') && (
        <div className="mt-3 pt-3 border-t border-border/40">
          {metric === 'heatmap' && <Heatmap heatmap={stats.heatmap} />}
          {metric === 'chart' && <BarChart months={stats.months} />}
        </div>
      )}
    </div>
  );
}

function MetricValue({ stats, metric }: { stats: HabitStats; metric: HabitMetric }) {
  const { task, totalEarned, best, completionPct, skips, untilMilestone } = stats;
  switch (metric) {
    case 'earned':
      return (
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-black text-primary tabular-nums leading-none">
            ₹{totalEarned.toFixed(0)}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">earned</div>
        </div>
      );
    case 'best':
      return (
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 text-xl sm:text-2xl font-black text-accent tabular-nums leading-none">
            <Trophy className="w-4 h-4" />
            {best}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">days</div>
        </div>
      );
    case 'rate':
      return (
        <div className="text-right min-w-[100px]">
          <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums leading-none">
            {completionPct}%
          </div>
          <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full gradient-neon" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      );
    case 'skipped':
      return (
        <div className="text-right">
          <div className={cn(
            'text-xl sm:text-2xl font-black tabular-nums leading-none',
            skips > 0 ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {skips}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">skips</div>
        </div>
      );
    case 'loss':
      return (
        <div className="text-right">
          <div className={cn(
            'text-xl sm:text-2xl font-black tabular-nums leading-none',
            stats.totalLoss > 0 ? 'text-destructive' : 'text-muted-foreground',
          )}>
            −₹{stats.totalLoss.toFixed(0)}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">lost</div>
        </div>
      );

    case 'reward': {
      const cycleLength = getStreakCycleLength(task);
      const hasCycle = Number.isFinite(cycleLength) && cycleLength > 0;
      const hit = hasCycle && untilMilestone === cycleLength && task.currentStreak > 0;
      return (
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-black text-accent tabular-nums leading-none">
            {!hasCycle ? '—' : hit ? '★' : `${untilMilestone}d`}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">
            {hit ? 'unlocked' : 'to reward'}
          </div>
        </div>
      );
    }
    case 'chart':
      return (
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-black text-primary tabular-nums leading-none">
            ₹{stats.months.reduce((s, m) => s + m.earned, 0).toFixed(0)}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">6mo</div>
        </div>
      );
    case 'heatmap':
      return (
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums leading-none">
            {stats.heatmap.map.size}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">entries</div>
        </div>
      );
  }
}

function Heatmap({ heatmap }: { heatmap: HabitStats['heatmap'] }) {
  const weeks: Date[][] = [];
  for (let i = 0; i < heatmap.days.length; i += 7) weeks.push(heatmap.days.slice(i, i + 7));

  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((d, di) => {
            const key = format(d, 'yyyy-MM-dd');
            const entry = heatmap.map.get(key);
            const future = isAfter(d, new Date());
            let bg = 'hsl(0 0% 14% / 0.9)';
            let label = 'No activity';
            if (future) {
              bg = 'transparent';
              label = 'Future';
            } else if (entry?.done) {
              bg = 'hsl(140 70% 45% / 0.95)';
              label = `Success · ₹${entry.amount.toFixed(0)}`;
            } else if (entry?.failed) {
              bg = 'hsl(0 80% 55% / 0.95)';
              label = 'Failed · streak broken';
            } else if (entry?.dayOff) {
              bg = 'hsl(48 95% 55% / 0.95)';
              label = 'Skipped · no penalty';
            }
            const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            return (
              <div
                key={di}
                title={`${format(d, 'MMM d')} · ${label}`}
                className={cn(
                  'w-3 h-3 rounded-[2px] transition-transform hover:scale-125',
                  isToday && 'ring-1 ring-primary',
                )}
                style={{ background: bg }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function BarChart({ months }: { months: { label: string; earned: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.earned));
  return (
    <div className="flex items-end justify-between gap-2 h-[80px]">
      {months.map((m, i) => {
        const h = (m.earned / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
            <div className="flex-1 w-full flex items-end">
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-primary/70 to-primary transition-all duration-700"
                style={{
                  height: `${h}%`,
                  minHeight: m.earned > 0 ? '4px' : '2px',
                  boxShadow: m.earned > 0 ? '0 0 10px hsl(243 76% 59% / 0.5)' : undefined,
                }}
              />
            </div>
            <div className="text-[9px] text-muted-foreground font-medium">{m.label}</div>
            <div className="text-[9px] text-foreground font-bold tabular-nums -mt-0.5">
              ₹{m.earned.toFixed(0)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
