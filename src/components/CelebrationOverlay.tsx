import { useEffect } from 'react';
import { useCelebration } from '@/contexts/CelebrationContext';
import { TRAIT_BY_ID } from '@/lib/xpUtils';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

const AUTO_DISMISS_MS = 3800;

/**
 * The full-screen "moment" for a level-up, level-down or rank-up, mounted
 * once near the app root so it overlays whichever screen is open.
 * Auto-dismisses, or tap ANYWHERE to close early -- the whole overlay is one
 * hit target rather than a single small link, and it skips backdrop-blur
 * (expensive to composite/remove on a phone WebView) in favour of a plain
 * darker layer, so dismissing feels instant rather than laggy.
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
  const isLevelDown = active.kind === 'level-down';
  const isDanger = isLevelDown;
  const trait = active.kind === 'rank-up' ? null : TRAIT_BY_ID[active.trait];

  const label = isLevelUp ? 'Level up' : isLevelDown ? 'Level down' : 'Rank up';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 p-6 animate-fade-in motion-reduce:animate-none"
      onClick={dismiss}
      role="dialog"
      aria-label={label}
    >
      <div
        className={cn(
          // The pulsing glow (box-shadow only, no blur-filter) is what carries
          // the "alive" feeling cheaply -- confined to this one ~380px panel
          // rather than the full screen, so it stays smooth on a phone WebView
          // in a way a full-viewport backdrop-blur never could.
          'relative w-full max-w-sm rounded-2xl border p-8 text-center animate-scale-in motion-reduce:animate-none motion-reduce:shadow-glow',
          isDanger
            ? 'border-destructive/50 bg-card/90 animate-pulse-glow-danger'
            : 'border-primary/50 bg-card/90 animate-pulse-glow',
        )}
      >
        {/* Corner brackets — the system-window motif */}
        {(['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2',
           'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'] as const)
          .map((pos) => (
            <span
              key={pos}
              className={cn('pointer-events-none absolute h-4 w-4', pos, isDanger ? 'border-destructive/70' : 'border-primary/70')}
            />
          ))}

        <span
          className={cn(
            'flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.3em]',
            isDanger ? 'text-destructive' : 'text-primary neon-text-orange',
          )}
        >
          {isDanger && <AlertTriangle className="h-3.5 w-3.5" />}
          {label}
        </span>

        {/* A thin sweeping highlight -- only for the good news; a warning
            shouldn't sparkle. Pure background-position animation, no repaint. */}
        {!isDanger && (
          <div className="mx-auto mt-2 h-px w-24 animate-shimmer motion-reduce:animate-none" />
        )}

        {(isLevelUp || isLevelDown) && trait && (
          <>
            <div className={cn('mt-4 text-5xl animate-float motion-reduce:animate-none', isDanger && 'grayscale')}>
              {trait.emoji}
            </div>
            <div className={cn('mt-2 font-display text-xl font-bold', isDanger ? 'text-destructive' : trait.color)}>
              {trait.name}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 font-display text-3xl font-bold tabular-nums">
              <span className="text-muted-foreground/60">Lv {active.fromLevel}</span>
              <span className={isDanger ? 'text-destructive' : 'text-primary'}>→</span>
              <span className={isDanger ? 'text-destructive' : 'neon-text'}>Lv {active.toLevel}</span>
            </div>
            {isDanger && (
              <p className="mt-3 text-sm text-muted-foreground">A miss cost you this. Get it back tomorrow.</p>
            )}
          </>
        )}

        {active.kind === 'rank-up' && (
          <>
            <div className="mt-5 flex items-center justify-center gap-4 animate-float motion-reduce:animate-none">
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
          Tap anywhere to continue
        </button>
      </div>
    </div>
  );
}
