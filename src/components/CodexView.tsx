import { TRAITS, baseXpForDifficulty, rankTitle, levelForXp } from '@/lib/xpUtils';
import { DIFFICULTY_MULTIPLIERS } from '@/types/task';
import { useTasks } from '@/contexts/TaskContext';
import { buildLegacyStats } from '@/lib/legacy';
import { cn } from '@/lib/utils';
import { Check, Coins, Flame, Repeat, Trophy, XCircle, Infinity as InfinityIcon } from 'lucide-react';

const BAND = 10000;

export function CodexView() {
  const { traitXp, tasks, xpEvents } = useTasks();
  const legacy = buildLegacyStats(tasks, xpEvents);

  const totalXp = TRAITS.reduce((s, t) => s + (traitXp[t.id] || 0), 0);
  const me = levelForXp(totalXp);
  const currentLevel = me.level;

  const milestones = [-50, -20, -10, -5, -2, -1, 0, 1, 2, 5, 10, 20, 50, 100];
  const levelsToShow = Array.from(
    new Set([
      currentLevel - 2, currentLevel - 1, currentLevel, currentLevel + 1, currentLevel + 2,
      ...milestones,
    ]),
  )
    .filter((n) => n >= -100 && n <= 100)
    .sort((a, b) => a - b);

  // Signed XP needed to reach level n's entry threshold.
  // For n > 0: positive number = XP to climb up.
  // For n < 0: negative number = XP that needs to be lost to sink there.
  const remainingTo = (n: number): number => n * BAND - totalXp;

  // A target level is "reached" when the user's XP is on the far side of its entry from zero.
  const isReached = (n: number): boolean => {
    if (n === currentLevel) return true;
    if (n > 0) return totalXp >= n * BAND;
    if (n < 0) return totalXp <= n * BAND;
    // n === 0
    return true; // level 0 entry is 0 XP — always "reached" as a checkpoint
  };

  const rankBands = [
    { range: '≤ -50', title: 'Adrift' },
    { range: '-49 to -20', title: 'Slipping' },
    { range: '-19 to -5', title: 'Shaky' },
    { range: '-4 to 4', title: 'Balanced' },
    { range: '5 to 19', title: 'Building' },
    { range: '20 to 49', title: 'Disciplined' },
    { range: '50 to 99', title: 'Mastery' },
    { range: '100+', title: 'Legendary' },
  ];

  const pct = Math.max(0, Math.min(100, (me.intoLevel / BAND) * 100));

  const mult = (d: number) => DIFFICULTY_MULTIPLIERS[d];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/50 bg-card/60 p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Reference</div>
        <div className="font-display text-2xl font-bold neon-text">Codex</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Exactly how money, XP, streaks, and levels are calculated.
        </p>
      </div>

      {/* Task types */}
      <section>
        <SectionTitle>Task types</SectionTitle>
        <div className="space-y-2 rounded-xl border border-border/50 bg-card/50 p-4 text-sm">
          <Row label="Fixed reward">
            Earns a set <span className="text-primary">₹ amount</span> each time it's completed. Most tasks.
          </Row>
          <Row label="Count / rate">
            Earns <span className="text-primary">₹ rate × minutes</span> logged. The same rate also drives its XP.
          </Row>
          <Row label="Multi-step">
            A parent with subtasks. Completing all steps completes the parent; each step is an equal share of the reward.
          </Row>
        </div>
      </section>

      {/* Money */}
      <section>
        <SectionTitle icon={<Coins className="h-3.5 w-3.5" />}>Money (₹)</SectionTitle>
        <div className="space-y-3 rounded-xl border border-border/50 bg-card/50 p-4 text-sm">
          <Block title="Per completion">
            Fixed task pays its current <span className="text-primary font-semibold">amount</span>.
            Count task pays <span className="text-primary font-semibold">rate × minutes</span> worked.
          </Block>
          <Block title="Streak raise (every 7-cycle)">
            Closing a cycle raises the pay: fixed amount is{' '}
            <span className="text-primary font-semibold">× the difficulty multiplier</span>,
            count rate <span className="text-primary font-semibold">+₹0.50 / min</span>.
            No ceiling — this compounds for as long as you keep closing cycles.
          </Block>
          <Block title="A raise must be earned by the whole day">
            The cycle only pays out if you cleared{' '}
            <span className="text-primary font-semibold">at least 80%</span> of everything due that
            day. Finish one habit while the rest of the day rots and the cycle still counts, but the
            raise does not land. One task can never run away from the others — the growth has no
            ceiling, but it has to be earned broadly to keep compounding.
          </Block>
          <Block title="Failure (✗)">
            Deducts the task's current amount from your wallet
            (count task: <span className="text-destructive font-semibold">200 × rate</span>). The wallet can go negative.
          </Block>
          <Block title="Difficulty multipliers">
            <span className="tabular-nums">
              D1 {mult(1)}× · D2 {mult(2)}× · D3 {mult(3)}× · D4 {mult(4)}× · D5 {mult(5)}×
            </span>
          </Block>
        </div>
      </section>

      {/* XP */}
      <section>
        <SectionTitle icon={<Flame className="h-3.5 w-3.5" />}>XP</SectionTitle>
        <div className="space-y-3 rounded-xl border border-border/50 bg-card/50 p-4 text-sm">
          <Block title="Base XP per completion">
            Fixed task by difficulty — easy (1–2) <B>{baseXpForDifficulty(1)}</B>,
            medium (3) <B>{baseXpForDifficulty(3)}</B>, hard (4–5) <B>{baseXpForDifficulty(5)}</B>.
            Count task earns <B>rate × minutes</B> as XP (same number that drives its money).
          </Block>
          <Block title="Consistency bonus">
            On a normal completion with a running streak, add
            <B> 3% of base XP per streak-day</B> (e.g. streak 5 → +15%).
          </Block>
          <Block title="Mastery bonus (cycle close)">
            The completion that finishes a 7-streak instead adds
            <B> base XP × (difficulty multiplier − 1)</B>, then the streak resets.
            Same rule for every task type.
          </Block>
          <Block title="Failure penalty (✗)">
            Deducts <span className="text-destructive font-semibold">60% of base XP</span> from each tagged trait. XP can go negative.
          </Block>
          <Block title="Neutral events">
            Skip / day-off, missed subtask (partial), and undo actions award and deduct nothing.
          </Block>
          <Block title="Traits">
            Every tagged trait receives the full XP — a task on two traits feeds both at full value.
          </Block>
        </div>
      </section>

      {/* Streaks */}
      <section>
        <SectionTitle icon={<Repeat className="h-3.5 w-3.5" />}>Streaks</SectionTitle>
        <div className="space-y-3 rounded-xl border border-border/50 bg-card/50 p-4 text-sm">
          <Block title="Cycle length">
            One cycle is <B>7 completions</B> for every recurring task. A cycle close triggers the money raise and the XP mastery bonus, then the counter wraps to 0. One-off (specific-date) tasks have no cycle.
          </Block>
          <Block title="Fixed schedules (weekly / monthly / specific-day)">
            The streak counts consecutive due occurrences. Missing a due day resets it to 0.
          </Block>
          <Block title="Flexible (at-least N / week or month)">
            The streak is period-based: a period counts if you hit its quota. Completing on non-consecutive days is fine — only missing the quota for a whole elapsed period breaks it.
          </Block>
          <Block title="Skip / day-off">
            Marks a day streak-neutral: no penalty, no streak impact. Only for flexible tasks that can still hit quota on remaining days.
          </Block>
        </div>
      </section>

      {/* Legacy — the unbounded half */}
      <section>
        <SectionTitle icon={<InfinityIcon className="h-3.5 w-3.5" />}>Legacy</SectionTitle>
        <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold neon-text">{legacy.rank.label}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                rank
              </span>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {legacy.xp.toLocaleString('en-IN')} / {legacy.rank.next.toLocaleString('en-IN')} legacy XP
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/70">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.round(legacy.rank.progress * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Earned ever" value={`₹${legacy.earned.toLocaleString('en-IN')}`} />
            <Stat label="Completions" value={legacy.completions.toLocaleString('en-IN')} />
            <Stat label="Active days" value={legacy.activeDays.toLocaleString('en-IN')} />
            <Stat label="Longest run" value={`${legacy.longestActiveRun}d`} />
          </div>

          <Block title="Why this exists">
            The wallet has a ceiling because it gates real spending. Legacy has none. It counts only
            what you have already done, is never spent, never decays, and no failure reduces it —
            penalties cost you level, never legacy. Ranks run{' '}
            <span className="text-primary font-semibold">E → D → C → B → A → S</span>, then S★1, S★2,
            and onward with no end. Each rank costs 40% more than the last.
          </Block>
        </div>
      </section>

      {/* Live level progress */}
      <section>
        <SectionTitle icon={<Trophy className="h-3.5 w-3.5" />}>Your level progress</SectionTitle>
        <div className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4 text-sm">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold tabular-nums text-foreground">Lv {currentLevel}</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">{rankTitle(currentLevel)}</span>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{totalXp.toLocaleString()} XP total</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/70">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              <B>{me.toNextUp.toLocaleString()} XP</B> to Lv {me.nextLevel}. Every level is a flat {BAND.toLocaleString()} XP;
              this uses your overall XP across all traits.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 text-left">Level</th>
                  <th className="py-1 pr-4 text-left">XP remaining</th>
                  <th className="py-1 text-left">Rank</th>
                </tr>
              </thead>
              <tbody>
                {levelsToShow.map((n) => {
                  const remaining = remainingTo(n);
                  const reached = isReached(n);
                  const isCurrent = n === currentLevel;
                  return (
                    <tr key={n} className={cn('border-t border-border/40', isCurrent && 'bg-primary/10')}>
                      <td className="py-1.5 pr-4 font-mono">
                        {isCurrent && <span className="mr-1 text-primary">▸</span>}
                        {n}
                      </td>
                      <td className="py-1.5 pr-4 font-bold">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <Check className="h-3 w-3" />
                            You are here
                          </span>
                        ) : reached ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <Check className="h-3 w-3" />
                            Reached
                          </span>
                        ) : (
                          <span className={cn('tabular-nums', remaining < 0 ? 'text-destructive' : 'text-primary')}>
                            {remaining > 0 ? '+' : ''}{remaining.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-foreground/80">{rankTitle(n)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Ranks */}
      <section>
        <SectionTitle>Rank titles</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Level range</th>
                <th className="px-4 py-2 text-left">Title</th>
              </tr>
            </thead>
            <tbody>
              {rankBands.map((b) => (
                <tr key={b.title} className="border-t border-border/40">
                  <td className="px-4 py-2 font-mono">{b.range}</td>
                  <td className="px-4 py-2 font-semibold text-foreground">{b.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Traits legend */}
      <section>
        <SectionTitle>Traits</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRAITS.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3">
              <span className="text-2xl">{t.emoji}</span>
              <div className="min-w-0">
                <div className={cn('font-semibold', t.color)}>{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* — small presentational helpers — */

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 pl-1 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
      {icon}
      {children}
    </h3>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-semibold text-foreground">{title}</div>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="w-28 shrink-0 font-semibold text-foreground">{label}</span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}
