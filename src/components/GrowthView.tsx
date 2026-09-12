import { useTasks } from '@/contexts/TaskContext';
import { TRAITS, levelForXp, standingTitle, characterStanding } from '@/lib/xpUtils';
import { computeMaxWeeklyXp } from '@/lib/maxWeeklyXp';
import { cn } from '@/lib/utils';
import { Flame, TrendingDown, TrendingUp, Target } from 'lucide-react';
import { format } from 'date-fns';

const BAND = 10000; // XP per level

export function GrowthView() {
  const { traitXp, xpEvents, tasks } = useTasks();

  const rows = TRAITS.map((t) => {
    const xp = traitXp[t.id] || 0;
    const info = levelForXp(xp);
    return { t, xp, info };
  });

  const avgLevel = rows.reduce((s, r) => s + r.info.level, 0) / (rows.length || 1);
  const totalLevel = rows.reduce((s, r) => s + r.info.level, 0);
  const totalXp = rows.reduce((s, r) => s + r.xp, 0);
  const overall = characterStanding(avgLevel);
  const overallNegative = totalLevel < 0;

  // Axis reaches one full level past the furthest trait.
  const maxReach = Math.max(1, ...rows.map((r) => Math.abs(r.info.level) + 1));
  const halfXp = maxReach * BAND;
  const gridLevels: number[] = [];
  for (let l = -maxReach; l <= maxReach; l++) gridLevels.push(l);
  const pctForLevel = (l: number) => 50 + (l / maxReach) * 50;

  const barRows = [...rows].sort((a, b) => a.xp - b.xp);

  // Max additional XP each trait can still earn this week (perfect play from today).
  const maxWeekly = computeMaxWeeklyXp(tasks, new Date());
  const maxRows = TRAITS
    .map((t) => ({ t, ...maxWeekly.perTrait[t.id] }))
    .filter((r) => r.occurrences > 0)
    .sort((a, b) => b.maxXp - a.maxXp);
  const totalMax = maxRows.reduce((s, r) => s + r.maxXp, 0);
  const biggestMax = Math.max(1, ...maxRows.map((r) => r.maxXp));

  return (
    <div className="space-y-6">
      {/* Overall summary */}
      <div className="rounded-2xl border border-border/50 bg-card/80 p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border sm:h-16 sm:w-16',
              overallNegative
                ? 'border-destructive/40 bg-destructive/15'
                : 'border-primary/40 bg-primary/15 shadow-glow',
            )}>
              <Flame className={cn('h-7 w-7 sm:h-8 sm:w-8', overallNegative ? 'text-destructive' : 'text-primary')} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">
                Standing · {overall}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  'font-display text-4xl font-bold tabular-nums neon-text sm:text-5xl',
                  overallNegative && 'text-destructive',
                )}>
                  {totalLevel > 0 ? '+' : ''}{totalLevel}
                </span>
                <span className="text-sm uppercase tracking-widest text-muted-foreground">Lvl</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                {overallNegative
                  ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  : <TrendingUp className="h-3.5 w-3.5 text-primary" />}
                <span className="font-medium tabular-nums">{totalXp.toLocaleString()} XP total</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg lvl</div>
            <div className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{avgLevel.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Trait balance */}
      <div className="rounded-xl border border-border/50 bg-card/60 p-4">
        <div className="mb-3 flex items-center justify-between pl-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Trait balance
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            XP · gridlines = levels
          </span>
        </div>

        <div className="space-y-2">
          {barRows.map(({ t, xp }) => {
            const negative = xp < 0;
            const mag = (Math.min(Math.abs(xp), halfXp) / halfXp) * 50;
            return (
              <div key={t.id} className="flex items-center gap-2">
                <div className="flex w-24 shrink-0 items-center gap-1.5 sm:w-28">
                  <span className="text-base">{t.emoji}</span>
                  <span className={cn('truncate text-xs font-medium', t.color)}>{t.name}</span>
                </div>
                <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-secondary/40">
                  {gridLevels.map((l) => (
                    <div
                      key={l}
                      className={cn('absolute top-0 h-full w-px', l === 0 ? 'bg-border' : 'bg-border/40')}
                      style={{ left: `${pctForLevel(l)}%` }}
                    />
                  ))}
                  {xp !== 0 && (
                    <div
                      className={cn(
                        'absolute top-1/2 h-4 -translate-y-1/2',
                        negative
                          ? 'right-1/2 rounded-l-sm bg-gradient-to-l from-destructive to-orange-500'
                          : 'left-1/2 rounded-r-sm bg-gradient-to-r from-primary to-amber-400',
                      )}
                      style={{ width: `${Math.max(mag, 1.5)}%` }}
                    />
                  )}
                  <span
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold tabular-nums',
                      xp < 0 ? 'text-destructive' : xp > 0 ? 'text-success' : 'text-foreground'
                    )}
                    style={
                      negative
                        ? { right: `calc(50% + ${Math.max(mag, 1.5)}% + 4px)` }
                        : { left: `calc(50% + ${xp > 0 ? Math.max(mag, 1.5) : 0}% + 6px)` }
                    }
                  >
                    {xp > 0 ? '+' : ''}{xp.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative mt-1.5 h-4 pl-[6.5rem] sm:pl-[7.5rem]">
          <div className="relative h-full">
            {gridLevels.map((l) => (
              <span
                key={l}
                className={cn(
                  'absolute top-0 -translate-x-1/2 text-[9px] font-medium tabular-nums',
                  l === 0 ? 'text-muted-foreground' : 'text-muted-foreground/50',
                )}
                style={{ left: `${pctForLevel(l)}%` }}
              >
                {l > 0 ? `+${l}` : l}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-1 pl-[6.5rem] text-center text-[9px] uppercase tracking-widest text-muted-foreground/50 sm:pl-[7.5rem]">
          level
        </div>
      </div>

      {/* Max XP this week — perfect-play ceiling per trait */}
      <div className="rounded-xl border border-border/50 bg-card/60 p-4">
        <div className="mb-1 flex items-center justify-between pl-1">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            Max XP this week
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            by Sun {format(new Date(maxWeekly.weekEnd), 'd MMM')}
          </span>
        </div>
        <p className="mb-3 pl-1 text-[11px] text-muted-foreground">
          If every remaining task is completed perfectly from today, including streak &amp; mastery bonuses.
        </p>

        {maxRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground">
            No tasks due for the rest of this week.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {maxRows.map(({ t, maxXp, occurrences }) => {
                const w = (maxXp / biggestMax) * 100;
                return (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="flex w-24 shrink-0 items-center gap-1.5 sm:w-28">
                      <span className="text-base">{t.emoji}</span>
                      <span className={cn('truncate text-xs font-medium', t.color)}>{t.name}</span>
                    </div>
                    <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-secondary/40">
                      <div
                        className="absolute left-0 top-0 h-full rounded-md bg-gradient-to-r from-primary/70 to-amber-400/70"
                        style={{ width: `${Math.max(w, 3)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[11px] font-bold tabular-nums text-foreground">
                          +{maxXp.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {/* Outside the bar: the largest row fills 100% width, so an
                        overlaid count sat on the gradient with no contrast. */}
                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                      {occurrences}×
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 pl-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Total ceiling</span>
              <span className="font-display text-sm font-bold tabular-nums text-primary">
                +{totalMax.toLocaleString()} XP
              </span>
            </div>
          </>
        )}
      </div>

      {/* Per-trait detail cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ t, xp, info }) => {
          const pct = info.bandSize > 0 ? (info.intoLevel / info.bandSize) * 100 : 0;
          const negative = info.level < 0;
          return (
            <div
              key={t.id}
              className={cn('rounded-xl border bg-card/50 p-4', negative ? 'border-destructive/40' : 'border-border/50')}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{t.emoji}</span>
                  <div>
                    <div className={cn('font-semibold', t.color)}>{t.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {standingTitle(info.level)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Lvl</div>
                  <div className={cn('text-2xl font-bold', negative && 'text-destructive')}>{info.level}</div>
                </div>
              </div>

              <div className={cn(
                'relative h-2 overflow-hidden rounded-full',
                negative ? 'bg-destructive/10 ring-1 ring-destructive/30' : 'bg-secondary/60',
              )}>
                <div
                  className={cn(
                    'absolute top-0 h-full rounded-full transition-all',
                    negative ? 'right-0 bg-gradient-to-l from-destructive via-orange-500 to-amber-400' : 'left-0 bg-primary',
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className={cn('font-medium', negative ? 'text-destructive/90' : 'text-foreground/80')}>
                  {info.toNextUp.toLocaleString()} XP to Lv {info.nextLevel}
                </span>
                <span className={cn('font-medium', negative ? 'text-destructive/90' : 'text-foreground/80')}>
                  {xp.toLocaleString()} total
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent events */}
      <div>
        <div className="mb-2 pl-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recent XP events
        </div>
        <div className="max-h-80 divide-y divide-border/40 overflow-y-auto rounded-xl border border-border/50 bg-card/50">
          {xpEvents.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No XP yet. Complete a task to start leveling up.
            </div>
          )}
          {xpEvents.slice(0, 100).map((e) => {
            const trait = TRAITS.find((t) => t.id === e.trait);
            const positive = e.amount >= 0;
            return (
              <div key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span>{trait?.emoji}</span>
                  <span className={cn('truncate font-medium', trait?.color)}>{trait?.name}</span>
                  <span className="truncate text-muted-foreground">· {e.reason.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">{e.date}</span>
                  <span className={cn('font-bold', positive ? 'text-primary' : 'text-destructive')}>
                    {positive ? '+' : ''}{e.amount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}