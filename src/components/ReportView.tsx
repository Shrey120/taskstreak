import { useMemo, useState } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { buildPeriodReport, ReportUnit } from '@/lib/periodReport';
import { TRAITS, levelForXp } from '@/lib/xpUtils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pretty = (key: string) => format(new Date(`${key}T12:00:00`), 'd MMM');

function Delta({ now, before, unit = '' }: { now: number; before: number; unit?: string }) {
  const diff = now - before;
  if (before === 0 && now === 0) {
    return <span className="text-xs text-muted-foreground">no change</span>;
  }
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const tone = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-muted-foreground';
  const pct = before > 0 ? Math.round((diff / before) * 100) : null;
  return (
    <span className={cn('text-xs font-medium inline-flex items-center gap-1', tone)}>
      <Icon className="w-3 h-3" />
      {diff > 0 ? '+' : ''}{Math.round(diff).toLocaleString('en-IN')}{unit}
      {pct !== null && <span className="opacity-70">({diff > 0 ? '+' : ''}{pct}%)</span>}
    </span>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
      {children}
    </div>
  );
}

export function ReportView() {
  const { tasks, xpEvents, pauseRanges, dayOffSet, traitXp } = useTasks();
  const [unit, setUnit] = useState<ReportUnit>('week');

  const report = useMemo(
    () => buildPeriodReport(tasks, xpEvents, pauseRanges, dayOffSet, unit),
    [tasks, xpEvents, pauseRanges, dayOffSet, unit],
  );

  const rate = report.due > 0 ? Math.round((report.completed / report.due) * 100) : 0;
  const prevRate = report.prevDue > 0 ? Math.round((report.prevCompleted / report.prevDue) * 100) : 0;
  const net = report.earned - report.lost;
  const prevNet = report.prevEarned - report.prevLost;
  const peakWeekday = Math.max(1, ...report.byWeekday);

  const movers = [...report.traits]
    .map((t) => ({ ...t, diff: t.xp - t.prevXp }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">System Report</h2>
          <p className="text-sm text-muted-foreground">
            {pretty(report.start)} – {pretty(report.end)}
            <span className="opacity-60"> vs {pretty(report.prevStart)} – {pretty(report.prevEnd)}</span>
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(['week', 'month'] as ReportUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={cn(
                'px-3 h-8 rounded-md text-sm font-medium capitalize transition-all',
                unit === u ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Net" value={money(net)}>
          <Delta now={net} before={prevNet} />
        </Tile>
        <Tile label="Earned" value={money(report.earned)}>
          <Delta now={report.earned} before={report.prevEarned} />
        </Tile>
        <Tile label="Lost to misses" value={money(report.lost)}>
          <Delta now={report.lost} before={report.prevLost} />
        </Tile>
        <Tile label="Consistency" value={`${rate}%`}>
          <Delta now={rate} before={prevRate} unit="pp" />
        </Tile>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Traits</h3>
          <span className="text-xs text-muted-foreground">XP this {unit}, vs last</span>
        </div>
        <div className="space-y-2">
          {movers.map((m) => {
            const trait = TRAITS.find((t) => t.id === m.trait)!;
            return (
              <div key={m.trait} className="flex items-center gap-3">
                <span className="w-6 text-center">{trait.emoji}</span>
                <span className="flex-1 text-sm font-medium">{trait.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  lv {levelForXp(traitXp[m.trait] ?? 0).level}
                </span>
                <span className="text-sm font-semibold tabular-nums w-16 text-right">
                  {m.xp > 0 ? '+' : ''}{m.xp}
                </span>
                <span className="w-24 text-right"><Delta now={m.xp} before={m.prevXp} /></span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Which days you show up</h3>
          <div className="flex items-end gap-2 h-24">
            {report.byWeekday.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-muted-foreground">{n || ''}</span>
                <div
                  className={cn(
                    'w-full rounded-sm',
                    i === report.bestWeekday ? 'gradient-primary'
                      : i === report.worstWeekday ? 'bg-rose-400/40' : 'bg-secondary',
                  )}
                  style={{ height: `${Math.max(n > 0 ? 8 : 3, (n / peakWeekday) * 72)}px` }}
                />
                <span className="text-[10px] text-muted-foreground">{WEEKDAYS[i]}</span>
              </div>
            ))}
          </div>
          {report.bestWeekday !== null && (
            <p className="text-xs text-muted-foreground">
              Strongest on {WEEKDAYS[report.bestWeekday]}
              {report.worstWeekday !== null && `, thinnest on ${WEEKDAYS[report.worstWeekday]}`}.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">What slipped</h3>
          {report.mostMissed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing missed this {unit}. Every due task was done.
            </p>
          ) : (
            <div className="space-y-2">
              {report.mostMissed.map((m) => (
                <div key={m.taskId} className="flex items-center gap-3">
                  <span className="flex-1 text-sm truncate">{m.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-rose-400">
                    {m.missed} missed
                  </span>
                </div>
              ))}
            </div>
          )}
          {report.pausedDays > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              {report.pausedDays} paused {report.pausedDays === 1 ? 'day' : 'days'}, not counted.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
