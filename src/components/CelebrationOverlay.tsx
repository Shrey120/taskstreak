import { useEffect } from 'react';
import { useCelebration } from '@/contexts/CelebrationContext';
import { TRAIT_BY_ID } from '@/lib/xpUtils';
import { cn } from '@/lib/utils';

const AUTO_DISMISS_MS = 3800;

/**
 * The full-screen "moment" for a level-up or rank-up, mounted once near the
 * app root so it overlays whichever screen is open. Auto-dismisses, or tap
 * anywhere to close early. Respects prefers-reduced-motion by skipping the
 * entrance animation rather than the moment itself.
 */
export function CelebrationOverlay() {
  const { active, dismiss } = useCelebration();

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [active, dismiss]);

  if (!active) return null;

  const isLevelUp = active.kind === 'level-up';
  const trait = isLevelUp ? TRAIT_BY_ID[active.trait] : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-6 backdrop-blur-md animate-fade-in motion-reduce:animate-none"
      onClick={dismiss}
      role="dialog"
      aria-label={isLevelUp ? 'Level up' : 'Rank up'}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-primary/50 bg-card/90 p-8 text-center shadow-glow animate-scale-in motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corner brackets — the system-window motif */}
        {(['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2',
           'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'] as const)
          .map((pos) => (
            <span key={pos} className={cn('pointer-events-none absolute h-4 w-4 border-primary/70', pos)} />
          ))}

        <span className="text-xs font-bold uppercase tracking-[0.3em] text-primary neon-text-orange">
          {isLevelUp ? 'Level Up' : 'Rank Up'}
        </span>

        {isLevelUp && trait && (
          <>
            <div className="mt-4 text-5xl">{trait.emoji}</div>
            <div className={cn('mt-2 font-display text-xl font-bold', trait.color)}>{trait.name}</div>
            <div className="mt-3 flex items-center justify-center gap-3 font-display text-3xl font-bold tabular-nums">
              <span className="text-muted-foreground/60">Lv {active.fromLevel}</span>
              <span className="text-primary">→</span>
              <span className="neon-text">Lv {active.toLevel}</span>
            </div>
          </>
        )}

        {!isLevelUp && active.kind === 'rank-up' && (
          <>
            <div className="mt-5 flex items-center justify-center gap-4">
              <span className="font-display text-3xl font-bold text-muted-foreground/60">{active.fromLabel}</span>
              <span className="text-2xl text-primary">→</span>
              <span className="font-display text-4xl font-bold neon-text">{active.toLabel}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Legacy never forgets this.</p>
          </>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Tap to continue
        </button>
      </div>
    </div>
  );
}
