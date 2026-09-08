## Fix XP → level mapping

Make levels linear and symmetric: **cumulative XP to reach level n = 10,000 × n**. That means every level costs a flat 10,000 XP, level 0 sits at exactly 0 XP, and negatives mirror positives (−10,000 XP → Level −1, −20,000 XP → Level −2).

Concretely, 20,000 XP → Level **2**, not Level 1.

### Changes

**`src/lib/xpUtils.ts`**
- `requiredXp(n)` returns a constant `10000` (every level band is 10k wide).
- `levelForXp(totalXp)`:
  - `level = Math.trunc(totalXp / 10000)` (works symmetrically for negatives).
  - `intoLevel = totalXp - level * 10000` for xp ≥ 0.
  - For xp < 0, `intoLevel = |totalXp - level * 10000|` measured outward toward the next more-negative level, so the progress bar fills as XP drops further.
  - `bandSize = 10000`, `nextLevel = level + 1` (positive side) or `level - 1` (negative side), `toNext = 10000 - intoLevel`.
- Remove the old asymmetric level-0 special case and the `while` walk.

**`src/components/CodexView.tsx`**
- Update the "Level curve" section: formula becomes `xp to reach level n = 10,000 × n` (flat 10,000 XP per level, symmetric).
- Sample table: show "XP to next" as a constant 10,000 across all sampled levels; keep the rank column.

### Not changing
- Base XP per completion, streak/mastery bonuses, failure penalty.
- Rank bands and titles.
- `XpDisplay` header (already renders `levelForXp` output).
- Trait definitions.