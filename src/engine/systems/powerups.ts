/**
 * systems/powerups.ts — Power-up pickup and buff management.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, killEnemy, triggerPowerupAura, triggerShieldRestoration } from '../combat';
import { SoundManager } from '../audio';
import { spawnEffect } from '../pool';
import type { GameState } from '../state';

interface Powerup {
  active: boolean;
  x: number; y: number;
  radius: number;
  type: string;
  color: string;
}

interface Enemy { active: boolean }

/**
 * @param dt — Delta time
 * @param g — Game state
 */
export const updatePowerups = (dt: number, g: GameState, completeMission?: () => void): void => {
  const C = GAME_CONFIG;
  if (!g.activeBuffs) g.activeBuffs = {};
  if (!g.powerups) {
    const pool = g.entityPools?.powerups as { active?: unknown[] } | undefined;
    g.powerups = pool?.active || [];
  }

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
  for (const pu of g.powerups as Powerup[]) {
    if (!pu.active) continue;
    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);

    // Auto-attract
    if (dist < g.player.magnetRadius * 1.5) {
      const angle = Math.atan2(g.player.y - pu.y, g.player.x - pu.x);
      pu.x += Math.cos(angle) * C.powerups.attractSpeed * dt;
      pu.y += Math.sin(angle) * C.powerups.attractSpeed * dt;
    }

    // Collect on contact
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      SoundManager.play('powerup_pickup');

      // Trigger aura ring effect
      triggerPowerupAura(g, pu.type, pu.color, g.player.x, g.player.y);

      const cfg = (C.powerups.types as Record<string, { duration: number }>)[pu.type];

      if (pu.type === 'nuke') {
        // Instant kill all enemies
        for (const e of g.enemies as Enemy[]) {
          if (e.active) {
            killEnemy(g, e as unknown as Record<string, unknown>, completeMission);
          }
        }
        // White flash effect
        spawnEffect(g, { type: 'flash', color: '#ffffff', life: 0.5 });
      } else if (pu.type === 'repair') {
        // Heal 30% max HP
        const heal = g.player.maxHp * 0.3;
        g.player.hp = Math.min(g.player.maxHp, g.player.hp + heal);
        createParticles(g, g.player.x, g.player.y, '#22c55e' as unknown as number, 20);
      } else {
        // Duration-based buff
        g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
        if (pu.type === 'shieldBoost') {
          g.player.shield = g.player.maxShield;
          if (g.player._shieldWasDepleted) {
            g.player._shieldWasDepleted = false;
            triggerShieldRestoration(g);
          }
        }
        createParticles(g, g.player.x, g.player.y, pu.color as unknown as number, 15);
      }
    }
  }
};
