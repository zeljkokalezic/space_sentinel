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
    
    // Filter dead entities
    g.enemies     = g.enemies.filter(e => e.active);
    g.projectiles = g.projectiles.filter(p => p.active);
    g.particles   = g.particles.filter(p => p.active);
    g.pickups     = g.pickups.filter(p => p.active);
    g.effects     = g.effects.filter(e => e.life > 0);
    
    // Spatial culling: remove entities far from player
    const cullRadius = 3000; // Cull entities beyond 3km
    const px = g.player.x;
    const py = g.player.y;
    
    g.enemies = g.enemies.filter(e => {
      if (!e.active) return false;
      const dx = e.x - px;
      const dy = e.y - py;
      return dx * dx + dy * dy < cullRadius * cullRadius;
    });
    
    g.projectiles = g.projectiles.filter(p => {
      if (!p.active) return false;
      const dx = p.x - px;
      const dy = p.y - py;
      return dx * dx + dy * dy < cullRadius * cullRadius;
    });
    
    g.pickups = g.pickups.filter(p => {
      if (!p.active) return false;
      const dx = p.x - px;
      const dy = p.y - py;
      return dx * dx + dy * dy < cullRadius * cullRadius;
    });
  }
};
