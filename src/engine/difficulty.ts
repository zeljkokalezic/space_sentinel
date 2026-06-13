/**
 * difficulty.ts — Shared difficulty scaling calculation.
 *
 * The difficulty multiplier increases with both player level and elapsed mission time.
 * Formula breakdown:
 *   - Base value:        0.5
 *   - Level linear:     level × 0.15
 *   - Level exponential: level^1.6 × 0.04  (accelerates at higher levels)
 *   - Time scaling:     totalTime / 100     (linear time pressure)
 *
 * Veteran mode (unlocked by S-rank) applies a 1.2× multiplier to enemy stats
 * and a 1.5× multiplier to scrap rewards.
 *
 * @param {number} level     - Current player level (positive integer)
 * @param {number} totalTime - Total mission elapsed time in seconds
 * @param {string} [difficulty='normal'] - Difficulty preset: 'easy'|'normal'|'hard'|'veteran'
 * @returns {number} Difficulty multiplier applied to enemy stats
 */
export type DifficultyMode = 'easy' | 'normal' | 'hard' | 'veteran';

export const calculateDifficultyMultiplier = (
  level: number,
  totalTime: number,
  difficulty: DifficultyMode | string = 'normal',
): number => {
  const base = 0.5 + (level * 0.15) + Math.pow(level, 1.6) * 0.04 + totalTime / 100;
  const mult = difficulty === 'easy' ? 0.75
    : difficulty === 'hard' ? 1.25
    : difficulty === 'veteran' ? 1.2
    : 1;
  return base * mult;
};

/**
 * Get the scrap reward multiplier for the current difficulty.
 * Veteran mode grants 1.5× scrap rewards.
 *
 * @param {string} [difficulty='normal']
 * @returns {number} Scrap reward multiplier
 */
export const getScrapMultiplier = (difficulty: DifficultyMode | string = 'normal'): number => {
  return difficulty === 'veteran' ? 1.5 : 1;
};
