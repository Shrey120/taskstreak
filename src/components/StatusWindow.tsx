import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TaskContext';
import { useCelebration } from '@/contexts/CelebrationContext';
import { TraitRadarChart } from './TraitRadarChart';
import { TRAITS, levelForXp, standingTitle } from '@/lib/xpUtils';
import { buildLegacyStats, tierLabel } from '@/lib/legacy';
import { Sparkles, Flame, Wallet } from 'lucide-react';

interface StatusWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The character sheet -- a blue-glass, bracket-cornered panel evoking the
 * source material's system window, reachable from anywhere. Everything
 * shown is read from the same context data every other screen uses; this
 * is a different presentation of it, not a second copy of it.
 */
export function StatusWindow({ open, onOpenChange }: StatusWindowProps) {
  const { user } = useAuth();
  const { tasks, wallet, traitXp, xpEvents } = useTasks();
  const { celebrateLevelUp, celebrateRankUp } = useCelebration();

  const rows = TRAITS.map((t) => ({ t, xp: traitXp[t.id] || 0, info: levelForXp(traitXp[t.id] || 0) }));
  const totalLevel = rows.reduce((s, r) => s + r.info.level, 0);
  const maxReach = Math.max(1, ...rows.map((r) => Math.abs(r.info.level) + 1));
  const bestStreak = tasks.reduce((max, t) => Math.max(max, t.currentStreak || 0), 0);
  const legacy = buildLegacyStats(tasks, xpEvents);

  const topTrait = [...rows].sort((a, b) => b.info.level - a.info.level)[0];

  const previewLevelUp = () => {
    if (!topTrait) return;
    celebrateLevelUp(topTrait.t.id, topTrait.info.level, topTrait.info.level + 1);
  };
  const previewRankUp = () => {
    celebrateRankUp(legacy.rank.label, tierLabel(legacy.rank.tier + 1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-primary/40 bg-card/95 p-0 shadow-glow sm:max-w-lg">
        <div className="relative max-h-[85vh] overflow-y-auto p-6">
          {/* Corner brackets, matching the celebration overlay's motif */}
          {(['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2',
             'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'] as const)
            .map((pos) => (
              <span key={pos} className={`pointer-events-none absolute h-5 w-5 border-primary/50 ${pos}`} />
            ))}

          <DialogHeader className="mb-4 text-left">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.25em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Status Window
            </div>
            <DialogTitle className="font-display text-2xl">@{user?.username}</DialogTitle>
            <DialogDescription className="sr-only">Your character sheet</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-border/50 bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Level</div>
              <div className="mt-1 font-display text-xl font-bold tabular-nums">{totalLevel}</div>
              <div className="text-[10px] text-muted-foreground">{standingTitle(totalLevel)}</div>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Rank</div>
              <div className="mt-1 font-display text-xl font-bold neon-text">{legacy.rank.label}</div>
              <div className="text-[10px] text-muted-foreground">
                {Math.round(legacy.rank.progress * 100)}% to next
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/40 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Flame className="h-3 w-3 text-primary" /> Streak
              </div>
              <div className="mt-1 font-display text-xl font-bold tabular-nums">{bestStreak}</div>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/40 p-3">
            <Wallet className="h-4 w-4 shrink-0 text-accent" />
            <span className="text-xs text-muted-foreground">Wallet</span>
            <span className={`ml-auto font-display text-lg font-bold tabular-nums ${wallet < 0 ? 'text-destructive' : ''}`}>
              ₹{Math.round(wallet).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="mt-5">
            <TraitRadarChart
              levels={Object.fromEntries(rows.map((r) => [r.t.id, r.info.level])) as Record<typeof rows[number]['t']['id'], number>}
              xp={Object.fromEntries(rows.map((r) => [r.t.id, r.xp])) as Record<typeof rows[number]['t']['id'], number>}
              maxReach={maxReach}
              size={260}
            />
          </div>

          <div className="mt-5 space-y-2 border-t border-border/40 pt-4">
            <p className="text-[11px] text-muted-foreground">
              Won't level up or rank up for a while? Preview what the moment looks like —
              this doesn't touch your real progress.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={previewLevelUp} disabled={!topTrait}>
                Preview level up
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={previewRankUp}>
                Preview rank up
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
