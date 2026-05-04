/**
 * systems/cleanup.js — Dead entity pool cleanup with proper timer.
 */

/**
 * Periodically filter out dead/inactive entities from all pools.
 * Uses a proper accumulator timer instead of the fragile g.totalTime % 5 < dt check.
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const cleanup = (dt, g) => {
  g._cleanupTimer = (g._cleanupTimer ?? 0) + dt;
  if (g._cleanupTimer >= 5.0) {
    g._cleanupTimer = 0;
    g.enemies     = g.enemies.filter(e => e.active);
    g.projectiles = g.projectiles.filter(p => p.active);
    g.particles   = g.particles.filter(p => p.active);
    g.pickups     = g.pickups.filter(p => p.active);
    g.effects     = g.effects.filter(e => e.life > 0);
  }
};
