import { Task } from '@/types/task';
import { TraitId } from '@/lib/xpUtils';

/**
 * The unbounded half of the system.
 *
 * The wallet is a spending gate: it has to stay close to what you could
 * actually spend, or it stops gating anything. Legacy is the opposite — it
 * only ever counts what you have already done, is never spent, never decays
 * and has no ceiling. Ambition lives here so it cannot inflate the budget.
 *
 * Everything is derived from rows the app already stores, so there is nothing
 * extra to persist and nothing that can drift out of sync.
 */

export interface LegacyStats {
  /** Every rupee ever earned. Withdrawals and penalties never reduce it. */
  earned: number;
  /** Every task completion that paid out. */
  completions: number;
  /** Sum of all positive XP ever awarded, ignoring penalties. */
  xp: number;
  /** Distinct days with at least one paid completion. */
  activeDays: number;
  /** Longest run of consecutive active days, ever. */
  longestActiveRun: number;
  rank: LegacyRank;
}

export interface LegacyRank {
  /** 0-based tier index. Unbounded — it never stops climbing. */
  tier: number;
  /** E, D, C, B, A, S, then S★1, S★2, ... */
  label: string;
  /** Legacy XP at which this tier started. */
  floor: number;
  /** Legacy XP needed for the next tier. */
  next: number;
  /** 0..1 progress through the current tier. */
  progress: number;
}

const BASE_TIERS = ['E', 'D', 'C', 'B', 'A', 'S'];

/**
 * Each tier costs 40% more XP than the one before it. The curve never ends —
 * past S the tiers become S★1, S★2 and so on — but it steepens, so the early
 * ranks arrive fast and the late ones stay worth chasing.
 */
const TIER_BASE = 5_000;
const TIER_GROWTH = 1.4;

function tierFloor(tier: number): number {
  // Sum of a geometric series: the XP at which `tier` begins.
  if (tier <= 0) return 0;
  return Math.round(TIER_BASE * ((TIER_GROWTH ** tier - 1) / (TIER_GROWTH - 1)));
}

export function tierLabel(tier: number): string {
  if (tier < BASE_TIERS.length) return BASE_TIERS[tier];
  return `S★${tier - BASE_TIERS.length + 1}`;
}

export function rankFromLegacyXp(xp: number): LegacyRank {
  const safe = Math.max(0, xp);
  let tier = 0;
  // Bounded loop; the curve is steep enough that this never runs long.
  while (tier < 200 && tierFloor(tier + 1) <= safe) tier++;
  const floor = tierFloor(tier);
  const next = tierFloor(tier + 1);
  const span = Math.max(1, next - floor);
  return {
    tier,
    label: tierLabel(tier),
    floor,
    next,
    progress: Math.max(0, Math.min(1, (safe - floor) / span)),
  };
}

export function buildLegacyStats(
  tasks: Task[],
  xpEvents: { trait: TraitId; amount: number }[],
): LegacyStats {
  let earned = 0;
  let completions = 0;
  const days = new Set<string>();

  for (const task of tasks) {
    for (const c of task.completions) {
      if (c.earnedAmount > 0) {
        earned += c.earnedAmount;
        completions++;
        days.add(c.date);
      }
    }
  }

  // Positive XP only: a bad week costs you level, never legacy.
  const xp = xpEvents.reduce((sum, e) => (e.amount > 0 ? sum + e.amount : sum), 0);

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const key of sorted) {
    const t = new Date(`${key}T12:00:00`).getTime();
    run = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = t;
  }

  return {
    earned,
    completions,
    xp,
    activeDays: days.size,
    longestActiveRun: longest,
    rank: rankFromLegacyXp(xp),
  };
}
