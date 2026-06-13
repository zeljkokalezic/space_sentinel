/**
 * engine/viewport.ts — Screen/world coordinate helpers.
 *
 * Kept separate from combat.js to avoid an import cycle with relicSystem.js.
 */

/** Return current viewport dimensions in CSS pixels. */
export interface ViewportSize {
  vw: number;
  vh: number;
}

export const getViewportSize = (): ViewportSize => ({
  vw: typeof window !== 'undefined' ? window.innerWidth : 1920,
  vh: typeof window !== 'undefined' ? window.innerHeight : 1080,
});
