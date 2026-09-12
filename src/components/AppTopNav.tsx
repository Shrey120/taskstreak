import { useTasks } from '@/contexts/TaskContext';
import { useAuth } from '@/contexts/AuthContext';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CORE_TABS, METRIC_TABS, type ViewType } from '@/lib/navItems';
import { TRAITS, levelForXp } from '@/lib/xpUtils';
import { cn } from '@/lib/utils';
import { Flame, LogOut, Plus, Sparkles, Wallet } from 'lucide-react';

interface AppTopNavProps {
  view: ViewType;
  onSelect: (view: ViewType) => void;
}

/**
 * Permanent desktop navigation (lg and up), as two stacked horizontal rows
 * under the app header rather than a left-hand rail. The top row carries the
 * six core views plus utilities; the row below carries all eight per-task
 * metric views as plain tabs, always visible rather than tucked behind a menu.
 *
 * Phones and tablets are untouched: they still get the hamburger drawer and
 * bottom tab bar from AppNavDrawer / BottomNav.
 */
export function AppTopNav({ view, onSelect }: AppTopNavProps) {
  const { wallet, traitXp } = useTasks();
  const { user, logout } = useAuth();
  const totalXp = TRAITS.reduce((s, t) => s + (traitXp[t.id] || 0), 0);
  const level = levelForXp(totalXp).level;

  return (
    <div className="sticky top-14 z-20 hidden border-b border-border/50 bg-background/80 backdrop-blur-xl lg:top-16 lg:block">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-gutter">
        <span className="mr-1 flex shrink-0 items-center gap-1.5">
          <span className="font-display text-base font-bold text-foreground">TaskStreak</span>
          <Sparkles className="h-3.5 w-3.5 text-accent" />
        </span>

        <nav className="flex shrink-0 items-center gap-1 overflow-x-auto scrollbar-hide">
          {CORE_TABS.map((t) => (
            <TopNavTab
              key={t.id}
              label={t.label}
              icon={t.icon}
              active={view === t.id}
              onClick={() => onSelect(t.id)}
            />
          ))}
        </nav>

        <div className="flex-1" />

        <CreateTaskDialog
          trigger={
            <Button size="sm" className="h-9 gap-1.5 font-semibold">
              <Plus className="h-4 w-4" />
              New task
            </Button>
          }
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-9 cursor-default items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-2.5">
              <Wallet className="h-4 w-4 text-accent" />
              <span className={cn('text-[13px] font-bold tabular-nums', wallet < 0 ? 'text-destructive' : 'text-foreground')}>
                {compactMoney(wallet)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">Wallet · ₹{wallet.toFixed(2)}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-9 cursor-default items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-2.5">
              <Flame className={cn('h-4 w-4', level < 0 ? 'text-destructive' : 'text-primary')} />
              <span className={cn('text-[13px] font-bold tabular-nums', level < 0 ? 'text-destructive' : 'text-foreground')}>
                {level}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">Level {level} · {totalXp.toLocaleString()} XP</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={logout}
              aria-label={`Log out @${user?.username ?? ''}`}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gradient-primary text-[11px] font-bold text-primary-foreground">
                {(user?.username ?? '?').charAt(0).toUpperCase()}
              </div>
              <LogOut className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Log out @{user?.username}</TooltipContent>
        </Tooltip>
      </div>

      <div className="mx-auto flex h-11 max-w-[1440px] items-center gap-1 border-t border-border/40 px-gutter">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {METRIC_TABS.map((t) => {
            const id = `metric:${t.id}` as ViewType;
            return (
              <TopNavTab
                key={t.id}
                label={t.label}
                icon={t.icon}
                active={view === id}
                onClick={() => onSelect(id)}
                compact
              />
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function TopNavTab({
  label,
  icon: Icon,
  active,
  onClick,
  compact = false,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  /** Slightly smaller styling for the secondary (metrics) row. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1.5 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        compact ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-[13px]',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
      )}
    >
      <Icon className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      {label}
    </button>
  );
}

function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${Math.round(abs)}`;
}
