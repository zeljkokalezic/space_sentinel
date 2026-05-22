/**
 * systems/cleanup.js — Dead entity pool cleanup with proper timer.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

/**
 * Periodically filter out dead/inactive entities from all pools.
 * Uses a proper accumulator timer instead of the fragile g.totalTime % 5 < dt check.
 *
 * Also performs spatial culling: removes entities far outside the camera view
 * to reduce per-frame update cost.
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const cleanup = (dt, g) => {
  const C = GAME_CONFIG;
  g._cleanupTimer = (g._cleanupTimer ?? 0) + dt;
  if (g._cleanupTimer >= C.cleanup.interval) {
    g._cleanupTimer = 0;
    
    // Single-pass: filter dead + spatial cull in one go
    const cullDistSq = 3000 * 3000; // 3km squared
    const px = g.player.x;
    const py = g.player.y;

    const inBounds = (e) => {
      const dx = e.x - px, dy = e.y - py;
      return dx * dx + dy * dy < cullDistSq;
    };

    g.enemies     = g.enemies.filter(e => e.active && inBounds(e));
    g.projectiles = g.projectiles.filter(p => p.active && inBounds(p));
    g.particles   = g.particles.filter(p => p.active && inBounds(p));
    g.pickups     = g.pickups.filter(p => p.active && inBounds(p));
    g.powerups    = g.powerups.filter(p => p.active && inBounds(p));
    g.effects     = g.effects.filter(e => e.life > 0);
    g.spawnFlashes = g.spawnFlashes.filter(f => f.active);
  }
};
