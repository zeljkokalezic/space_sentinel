/**
 * systems/cleanup.js — Dead entity pool cleanup with proper timer.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

/**

 * Periodically filter out dead/inactive entities from all pools.
 * Uses a proper accumulator timer instead of the fragile g.totalTime % 5 < dt check.
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const cleanup = (dt, g) => {
  const C = GAME_CONFIG;
  g._cleanupTimer = (g._cleanupTimer ?? 0) + dt;
  if (g._cleanupTimer >= C.cleanup.interval) {
    g._cleanupTimer = 0;
    g.enemies     = g.enemies.filter(e => e.active);
    g.projectiles = g.projectiles.filter(p => p.active);
    g.particles   = g.particles.filter(p => p.active);
    g.pickups     = g.pickups.filter(p => p.active);
    g.effects     = g.effects.filter(e => e.life > 0);
  }
};
