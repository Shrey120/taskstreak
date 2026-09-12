// XP / trait leveling system.
//
// Level curve: requiredXp(n) = 100 * (|n| + 1) XP to move from level n → n+1
// (positive direction) OR from n → n-1 (negative direction).
//
// Cumulative thresholds outward from 0:
//   Level  0 spans totalXp in [-99, 99]         (100 XP band)
//   Level  1 spans [100, 299]                    (200 XP band)
//   Level  2 spans [300, 599]                    (300 XP band)
//   Level -1 spans [-299, -100]                  (200 XP band)
//   Level -2 spans [-599, -300]                  (300 XP band)
// i.e. level n's band size is requiredXp(|n|) = 100*(|n|+1).
//
// Note the entry point for a positive level n is cumulative sum:
//   entryXp(n>0) = sum_{k=0..n-1} requiredXp(k) = sum 100*(k+1) = 100 * n*(n+1)/2
//   entryXp(-n<0) = -sum_{k=0..n-1} requiredXp(k) - requiredXp(n) ...
// Easier: walk outward level-by-level.

export type TraitId =
  | 'strength'
  | 'knowledge'
  | 'wealth'
  | 'personality'
  | 'discipline'
  | 'creativity'
  | 'mind';

export interface TraitDef {
  id: TraitId;
  name: string;
  emoji: string;
  color: string; // tailwind text color class
  hex: string;   // hex for chart fills
  description: string;
}

export const TRAITS: TraitDef[] = [
  { id: 'strength',    name: 'Strength',    emoji: '💪', color: 'text-rose-400',    hex: '#fb7185', description: 'Physique, fitness, workouts, body' },
  { id: 'knowledge',   name: 'Knowledge',   emoji: '📚', color: 'text-sky-400',     hex: '#38bdf8', description: 'Learning, study, reading, research' },
  { id: 'wealth',      name: 'Wealth',      emoji: '💰', color: 'text-amber-400',   hex: '#fbbf24', description: 'Money, career, work, side hustles' },
  { id: 'personality', name: 'Personality', emoji: '🗣️', color: 'text-pink-400',    hex: '#f472b6', description: 'Social, charisma, communication' },
  { id: 'discipline',  name: 'Discipline',  emoji: '🔥', color: 'text-orange-400',  hex: '#fb923c', description: 'Willpower, habits, routines, chores' },
  { id: 'creativity',  name: 'Creativity',  emoji: '🎨', color: 'text-fuchsia-400', hex: '#e879f9', description: 'Art, writing, music, making' },
  { id: 'mind',        name: 'Mind',        emoji: '🧘', color: 'text-emerald-400', hex: '#34d399', description: 'Mindfulness, rest, mental wellness' },
];

export const TRAIT_BY_ID: Record<TraitId, TraitDef> = TRAITS.reduce((m, t) => {
  m[t.id] = t;
  return m;
}, {} as Record<TraitId, TraitDef>);

export const isTraitId = (v: unknown): v is TraitId =>
  typeof v === 'string' && (TRAITS as { id: string }[]).some((t) => t.id === v);

// Flat linear curve: cumulative XP to reach level n = 10,000 × n.
// Every level band is 10,000 XP wide, symmetric around 0.
export function requiredXp(_n: number): number {
  return 10000;
}

export interface LevelInfo {
  level: number;
  intoLevel: number;   // progress into current band toward next level up (0..bandSize-1)
  bandSize: number;    // 10000
  nextLevel: number;   // the level reached by going UP (toward positive)
  toNext: number;      // alias of toNextUp (back-compat)
  toNextUp: number;    // XP needed to climb to the next level up
}

export function levelForXp(totalXp: number): LevelInfo {
  const xp = Math.round(totalXp);
  const band = 10000;

  // Symmetric bands: level 0 spans -9,999..+9,999. Truncate toward zero.
  const level = Math.trunc(xp / band);
  const targetLevel = level + 1;

  // Lowest xp value that reads as targetLevel going up:
  //   target > 0  -> target*band              (level 1 starts at 10,000)
  //   target <= 0 -> target*band - (band - 1) (level 0 starts at -9,999)
  const boundary = targetLevel > 0 ? targetLevel * band : targetLevel * band - (band - 1);
  const toNextUp = boundary - xp;

  const intoLevel = Math.min(band - 1, Math.max(0, band - toNextUp));

  return { level, intoLevel, bandSize: band, nextLevel: targetLevel, toNext: toNextUp, toNextUp };
}


/**
 * Your CURRENT standing, derived from net XP. Unlike Legacy rank this can
 * fall: penalties subtract from net XP, so a bad stretch moves you back down
 * the scale. Legacy rank (E -> S*n, in lib/legacy.ts) is the permanent,
 * unbounded counterpart that failure never touches -- the two are different
 * measurements and deliberately do not agree.
 */
export function standingTitle(level: number): string {
  if (level <= -50) return 'Adrift';
  if (level <= -20) return 'Slipping';
  if (level <= -5) return 'Shaky';
  if (level <= 4) return 'Balanced';
  if (level <= 19) return 'Building';
  if (level <= 49) return 'Disciplined';
  if (level <= 99) return 'Mastery';
  return 'Legendary';
}

export function characterStanding(avgLevel: number): string {
  return standingTitle(Math.round(avgLevel));
}

/**
 * Base XP per completion by EFFORT WEIGHT (1..5 → light/moderate/heavy).
 *
 * This used to key off `difficulty`, which also drives money compounding —
 * so throttling a daily habit's money growth silently cut the XP it earned.
 * The two are independent now: difficulty paces money, effort weight pays XP.
 */
export function baseXpForEffort(effortWeight: number): number {
  if (effortWeight <= 2) return 100;   // light
  if (effortWeight === 3) return 200;  // moderate
  return 350;                          // heavy (4, 5)
}

/**
 * Base XP for one completion.
 *   - Normal task: flat baseXp for its effort weight.
 *   - Hourly ("count") task: perMinuteRate × minutes worked (the money rate
 *     doubles as the XP rate). Rounded to a whole number.
 */
export function baseXpForCompletion(
  effortWeight: number,
  isHourly: boolean,
  perMinuteRate: number,
  minutesWorked: number,
): number {
  if (isHourly) return Math.round(Math.max(0, perMinuteRate) * Math.max(0, minutesWorked));
  return baseXpForEffort(effortWeight);
}
