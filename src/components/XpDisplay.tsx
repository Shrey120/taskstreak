import { useTasks } from '@/contexts/TaskContext';
import { TRAITS, levelForXp, standingTitle } from '@/lib/xpUtils';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

const BAND = 10000; // XP per level

/** Level card for the nav rail / drawer. Mirrors WalletDisplay's stacked shape. */
export function XpDisplay() {
  const { traitXp } = useTasks();

  const totalXp = TRAITS.reduce((s, t) => s + (traitXp[t.id] || 0), 0);
  const info = levelForXp(totalXp);
  const negative = info.level < 0;
  const pct = Math.max(0, Math.min(100, (info.intoLevel / BAND) * 100));

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-3 shadow-card backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            negative ? 'border-destructive/40 bg-destructive/15' : 'border-primary/40 bg-primary/20',
          )}
        >
          <Flame className={cn('h-4 w-4', negative ? 'text-destructive' : 'text-primary')} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Level · {standingTitle(info.level)}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                'font-display text-lg font-bold tabular-nums',
                negative ? 'text-destructive' : 'text-foreground',
              )}
            >
              {info.level}
            </span>
            <span className="truncate text-[11px] tabular-nums text-muted-foreground">
              {totalXp.toLocaleString()} XP
            </span>
          </div>
        </div>
      </div>

      {/* Progress to the next level — previously the drawer showed a raw XP
          number with no sense of how close the next level was. */}
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary/70">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            negative ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
        {info.toNextUp.toLocaleString()} XP to Lv {info.nextLevel}
      </div>
    </div>
  );
}
