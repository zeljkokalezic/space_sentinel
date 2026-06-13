/**
 * screenShake.ts — Pure screen shake offset calculation.
 * No Three.js imports — safe for unit testing.
 */

/**
 * Calculate random screen shake offset proportional to intensity.
 * Uses Math.random for uniform distribution within [-intensity, +intensity].
 *
 * @param {number} intensity — Shake intensity (0 = no shake)
 * @returns {{ x: number, y: number }} Camera offset
 */
export interface ScreenShakeOffset {
  x: number;
  y: number;
}

export const getScreenShakeOffset = (intensity: number, time: number): ScreenShakeOffset => {
  if (intensity <= 0) return { x: 0, y: 0 };
  return {
    x: Math.sin(time * 13.7) * intensity,
    y: Math.cos(time * 17.3) * intensity,
  };
};
