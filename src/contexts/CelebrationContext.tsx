import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { TraitId } from '@/lib/xpUtils';

export type CelebrationEvent =
  | { kind: 'level-up'; trait: TraitId; fromLevel: number; toLevel: number }
  | { kind: 'level-down'; trait: TraitId; fromLevel: number; toLevel: number }
  | { kind: 'rank-up'; fromLabel: string; toLabel: string };

interface CelebrationContextValue {
  /** Fire a level-up celebration. Queued if one is already showing. */
  celebrateLevelUp: (trait: TraitId, fromLevel: number, toLevel: number) => void;
  /** Fire a level-down warning -- a failure already dropped a trait a
   *  level; this only makes that existing, silent consequence visible. */
  celebrateLevelDown: (trait: TraitId, fromLevel: number, toLevel: number) => void;
  /** Fire a rank-up celebration. Queued if one is already showing. */
  celebrateRankUp: (fromLabel: string, toLabel: string) => void;
  /** The event currently on screen, or null. */
  active: CelebrationEvent | null;
  dismiss: () => void;
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

/**
 * A tiny queue so a multi-trait task that levels up two traits at once (or a
 * level-up landing in the same tick as a rank-up) shows one moment at a time
 * instead of stacking overlays.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<CelebrationEvent[]>([]);
  const active = queue[0] ?? null;

  const push = useCallback((event: CelebrationEvent) => {
    setQueue((prev) => [...prev, event]);
  }, []);

  const celebrateLevelUp = useCallback(
    (trait: TraitId, fromLevel: number, toLevel: number) => {
      push({ kind: 'level-up', trait, fromLevel, toLevel });
    },
    [push],
  );

  const celebrateLevelDown = useCallback(
    (trait: TraitId, fromLevel: number, toLevel: number) => {
      push({ kind: 'level-down', trait, fromLevel, toLevel });
    },
    [push],
  );

  const celebrateRankUp = useCallback(
    (fromLabel: string, toLabel: string) => {
      push({ kind: 'rank-up', fromLabel, toLabel });
    },
    [push],
  );

  const dismiss = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrateLevelUp, celebrateLevelDown, celebrateRankUp, active, dismiss }}>
      {children}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be used within CelebrationProvider');
  return ctx;
}
