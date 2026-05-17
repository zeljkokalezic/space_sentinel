/**
 * systems/powerups.js — Power-up pickup and buff management.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, killEnemy } from '../combat';
import { SoundManager } from '../audio';

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updatePowerups = (dt, g, completeMission) => {
  const C = GAME_CONFIG;
  if (!g.activeBuffs) g.activeBuffs = {};
  if (!g.powerups) g.powerups = [];

  // Decay active buffs
  for (const [type, buff] of Object.entries(g.activeBuffs)) {
    if (buff.timer > 0) {
      buff.timer -= dt;
      if (buff.timer <= 0) {
        delete g.activeBuffs[type];
      }
    }
  }

  // Pickup power-ups
  for (let pu of g.powerups) {
    if (!pu.active) continue;
    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);

    // Auto-attract
    if (dist < g.player.magnetRadius * 1.5) {
      const angle = Math.atan2(g.player.y - pu.y, g.player.x - pu.x);
      pu.x += Math.cos(angle) * 400 * dt;
      pu.y += Math.sin(angle) * 400 * dt;
    }

    // Collect on contact
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      SoundManager.play('powerup_pickup');

      const cfg = C.powerups.types[pu.type];

      if (pu.type === 'nuke') {
        // Instant kill all enemies
        for (let e of g.enemies) {
          if (e.active) {
            killEnemy(g, e, completeMission);
          }
        }
        // White flash effect
        g.effects.push({ type: 'flash', color: '#ffffff', life: 0.5 });
      } else if (pu.type === 'repair') {
        // Heal 30% max HP
        const heal = g.player.maxHp * 0.3;
        g.player.hp = Math.min(g.player.maxHp, g.player.hp + heal);
        createParticles(g, g.player.x, g.player.y, '#22c55e', 20);
      } else {
        // Duration-based buff
        g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
        if (pu.type === 'shieldBoost') {
          g.player.shield = g.player.maxShield;
        }
        createParticles(g, g.player.x, g.player.y, pu.color, 15);
      }
    }
  }
};
