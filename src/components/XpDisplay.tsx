import { useTasks } from '@/contexts/TaskContext';
import { TRAITS, levelForXp } from '@/lib/xpUtils';
import { Flame } from 'lucide-react';

export function XpDisplay() {
  const { traitXp } = useTasks();

  const totalXp = TRAITS.reduce((s, t) => s + (traitXp[t.id] || 0), 0);
  const totalLevel = levelForXp(totalXp).level;
  const negative = totalLevel < 0;

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-card/80 shadow-card border border-border/50 neon-border backdrop-blur-sm hover:shadow-glow transition-all duration-500 group min-w-0">
      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 border border-primary/40 shrink-0 group-hover:animate-float">
        <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="hidden sm:inline text-xs font-semibold text-muted-foreground uppercase tracking-widest font-body">Level</span>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-base sm:text-xl font-bold font-display tabular-nums ${negative ? 'text-destructive' : 'text-foreground'}`}>
            {totalLevel}
          </span>
          <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums truncate">
            {totalXp} XP
          </span>
        </div>
      </div>
    </div>
  );
}
