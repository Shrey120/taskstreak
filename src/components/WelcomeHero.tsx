import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TaskContext';
import { Button } from '@/components/ui/button';
import { TRAITS, levelForXp } from '@/lib/xpUtils';
import { type ViewType } from '@/lib/navItems';
import { cn } from '@/lib/utils';
import { Flame, Wallet, Trophy, ListChecks, ArrowDown } from 'lucide-react';

interface WelcomeHeroProps {
  onNavigate: (view: ViewType) => void;
}

/**
 * The app's front door: a welcome banner over the Timeline, showing what's
 * true right now rather than a static tagline. Every number here is read
 * straight from context -- nothing computed specially for this component --
 * so it can never drift from what the rest of the app already believes.
 */
export function WelcomeHero({ onNavigate }: WelcomeHeroProps) {
  const { user } = useAuth();
  const { tasks, wallet, traitXp, getAllTasksForDate, isTaskCompletedOnDate, getTasksForDate } = useTasks();

  const today = new Date();
  const todaysTasks = getAllTasksForDate(today);
  const doneToday = todaysTasks.filter((t) => isTaskCompletedOnDate(t.id, today)).length;
  const dueToday = getTasksForDate(today).length;
  const bestStreak = tasks.reduce((max, t) => Math.max(max, t.currentStreak || 0), 0);
  const totalXp = TRAITS.reduce((sum, t) => sum + (traitXp[t.id] || 0), 0);
  const level = levelForXp(totalXp).level;
  const pct = todaysTasks.length ? Math.round((doneToday / todaysTasks.length) * 100) : 0;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/10 p-6 sm:p-8">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Welcome back
      </span>

      <h1 className="mt-3 text-wrap-balance font-display text-3xl font-bold leading-tight sm:text-4xl">
        Build your{' '}
        <span className="bg-gradient-to-r from-[hsl(258,90%,72%)] to-[hsl(258,90%,72%)] bg-clip-text text-transparent">
          Streaks
        </span>
        , grow your{' '}
        <span className="bg-gradient-to-r from-[hsl(217,85%,68%)] to-[hsl(217,85%,68%)] bg-clip-text text-transparent">
          Wallet
        </span>
        , level your{' '}
        <span className="bg-gradient-to-r from-[hsl(176,70%,55%)] to-[hsl(176,70%,55%)] bg-clip-text text-transparent">
          Traits
        </span>
        .
      </h1>

      <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
        {dueToday === 0
          ? "Nothing left to do today — everything due is already done."
          : `${dueToday} task${dueToday === 1 ? '' : 's'} still due today. Every one closes a
             streak cycle, earns its reward, and levels a trait.`}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          className="gap-2 font-semibold"
          onClick={() => document.getElementById('timeline-tasks')?.scrollIntoView({ behavior: 'smooth' })}
        >
          {dueToday === 0 ? "Review today" : "Start today's tasks"}
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => onNavigate('report')}>
          View report
        </Button>
      </div>

      <div className="mt-6 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Today's progress</span>
          <span className="tabular-nums">{doneToday} of {todaysTasks.length} tasks · {pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
          <div
            className="h-full rounded-full gradient-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Flame} label="Best streak" value={String(bestStreak)} tone="text-primary" />
        <StatTile icon={Trophy} label="Level" value={String(level)} tone="text-accent" />
        <StatTile
          icon={Wallet}
          label="Wallet"
          value={`₹${Math.round(wallet).toLocaleString('en-IN')}`}
          tone={wallet < 0 ? 'text-destructive' : 'text-foreground'}
        />
        <StatTile icon={ListChecks} label="Due today" value={String(dueToday)} tone="text-foreground" />
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', tone)} />
        {label}
      </div>
      <div className={cn('mt-1.5 font-display text-xl font-bold tabular-nums', tone)}>{value}</div>
    </div>
  );
}
