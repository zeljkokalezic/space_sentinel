/**
 * difficulty.js — Shared difficulty scaling calculation.
 *
 * The difficulty multiplier increases with both player level and elapsed mission time.
 * Formula breakdown:
 *   - Base value:        0.5
 *   - Level linear:     level × 0.15
 *   - Level exponential: level^1.6 × 0.04  (accelerates at higher levels)
 *   - Time scaling:     totalTime / 100     (linear time pressure)
 *
 * @param {number} level     - Current player level (positive integer)
 * @param {number} totalTime - Total mission elapsed time in seconds
 * @returns {number} Difficulty multiplier applied to enemy stats
 */
export const calculateDifficultyMultiplier = (level, totalTime, difficulty = 'normal') => {
  const base = 0.5 + (level * 0.15) + Math.pow(level, 1.6) * 0.04 + totalTime / 100;
  const mult = difficulty === 'easy' ? 0.75 : difficulty === 'hard' ? 1.25 : 1;
  return base * mult;
};
