import { useEffect, useRef } from 'react';
import { useTasks } from '@/contexts/TaskContext';
import { useCelebration } from '@/contexts/CelebrationContext';
import { TRAITS, levelForXp } from '@/lib/xpUtils';
import { buildLegacyStats, tierLabel } from '@/lib/legacy';

/**
 * Watches real progress and fires the level-up / rank-up moments -- purely
 * an observer. It never reads or writes XP, wallet or streak state, so
 * nothing here can affect the reward math; it only reacts to numbers
 * TaskContext already computed. Renders nothing.
 */
export function CelebrationWatcher() {
  const { traitXp, tasks, xpEvents } = useTasks();
  const { celebrateLevelUp, celebrateRankUp } = useCelebration();

  const prevLevels = useRef<Record<string, number> | null>(null);
  const prevTier = useRef<number | null>(null);

  // Level-up: per trait, on every real increase.
  useEffect(() => {
    const current: Record<string, number> = {};
    for (const t of TRAITS) current[t.id] = levelForXp(traitXp[t.id] || 0).level;

    // First run after load establishes the baseline -- hydrating existing
    // progress must never look like a level-up that just happened.
    if (prevLevels.current) {
      for (const t of TRAITS) {
        const before = prevLevels.current[t.id];
        const after = current[t.id];
        if (before !== undefined && after > before) {
          celebrateLevelUp(t.id, before, after);
        }
      }
    }
    prevLevels.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitXp]);

  // Rank-up: Legacy is lifetime and derived from the full history, so it's
  // watched separately from per-trait levels rather than inferred from them.
  useEffect(() => {
    const stats = buildLegacyStats(tasks, xpEvents);
    const tier = stats.rank.tier;

    if (prevTier.current !== null && tier > prevTier.current) {
      const fromLabel = tierLabel(prevTier.current);
      celebrateRankUp(fromLabel, stats.rank.label);
    }
    prevTier.current = tier;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, xpEvents]);

  return null;
}
