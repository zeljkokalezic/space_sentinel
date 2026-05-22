/**
 * systems/deathPulses.js — Enemy death pulse shockwave system.
 *
 * When eligible enemy types (heavy, shielded, missile_boat) die, they emit
 * an expanding shockwave ring that damages nearby enemies (chain kills) and
 * the player if too close. Creates strategic depth: don't kill enemies in
 * clusters without positioning!
 *
 * Pulse lifecycle:
 * 1. Created at enemy death position with radius=0
 * 2. Expands linearly to maxRadius over ringDuration
 * 3. Damages enemies and player when ring passes through them
 * 4. Chain-killed enemies may trigger secondary pulses (30% chance)
 * 5. Removed when life expires
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, triggerDeathPulse } from '../combat';

/**
 * Update all active death pulses: expand rings, check collisions, apply damage.
 *
 * @param {number} dt — Delta time in seconds
 * @param {object} g — Game state
 * @returns {boolean} Always false (death pulses don't end the game)
 */
export const updateDeathPulses = (dt, g) => {
  if (!g || !g.deathPulses) return false;
  const C = GAME_CONFIG.deathPulse;

  // Track chain-kill pulses to add after iteration (avoids mutating during loop)
  const chainPulses = [];

  for (let i = g.deathPulses.length - 1; i >= 0; i--) {
    const pulse = g.deathPulses[i];
    if (!pulse.active) continue;

    // ─── Decay life ────────────────────────────────────────────────
    pulse.life -= dt;
    if (pulse.life <= 0) {
      pulse.active = false;
      g.deathPulses.splice(i, 1);
      continue;
    }

    // ─── Expand ring (BEFORE collision check) ──────────────────────
    const lifeRatio = pulse.life / pulse.maxLife;
    pulse.radius = pulse.maxRadius * (1 - lifeRatio);

    // ─── Damage nearby enemies ─────────────────────────────────────
    if (g.enemies) {
      for (const e of g.enemies) {
        if (!e.active) continue;
        // Skip if already hit by this pulse (use pulse reference in enemy's hitByPulse set)
        if (e._hitByDeathPulses && e._hitByDeathPulses.has(pulse)) continue;

        const dist = Math.hypot(e.x - pulse.x, e.y - pulse.y);
        if (dist <= pulse.radius + (e.radius || 15)) {
          // Mark this enemy as hit by this pulse
          if (!e._hitByDeathPulses) e._hitByDeathPulses = new Set();
          e._hitByDeathPulses.add(pulse);

          // Apply damage (shield first)
          let dmg = pulse.damage;
          if (e.shield > 0) {
            const absorb = Math.min(e.shield, dmg);
            e.shield -= absorb;
            dmg -= absorb;
          }
          e.hp -= dmg;

          // Push enemy away from pulse center
          if (dist > 0) {
            const pushForce = 80;
            e.x += (e.x - pulse.x) / dist * pushForce * dt * 3;
            e.y += (e.y - pulse.y) / dist * pushForce * dt * 3;
          }

          // Check if enemy died from pulse
          if (e.hp <= 0 && e.active) {
            e.active = false;
            createParticles(g, e.x, e.y, e.color, 10);

            // Chain kill: eligible enemies may trigger secondary pulse
            if (C.eligibleTypes.includes(e.type) && Math.random() < C.chainKillChance) {
              chainPulses.push({ x: e.x, y: e.y, type: e.type });
            }
          }
        }
      }
    }

    // ─── Damage player ─────────────────────────────────────────────
    if (!pulse.hasDamagedPlayer && g.player) {
      const distToPlayer = Math.hypot(g.player.x - pulse.x, g.player.y - pulse.y);
      if (distToPlayer <= pulse.radius + (g.player.radius || 38)) {
        pulse.hasDamagedPlayer = true;

        let dmg = pulse.damage;
        if (g.player.shield > 0) {
          const absorb = Math.min(g.player.shield, dmg);
          g.player.shield -= absorb;
          dmg -= absorb;
        }
        g.player.hp -= dmg;

        // Push player away
        if (distToPlayer > 0) {
          const pushForce = 120;
          g.player.x += (g.player.x - pulse.x) / distToPlayer * pushForce * dt * 3;
          g.player.y += (g.player.y - pulse.y) / distToPlayer * pushForce * dt * 3;
        }

        // Impact particles at player position
        createParticles(g, g.player.x, g.player.y, 0xf97316, 8);
      }
    }
  }

  // ─── Apply chain-kill pulses ─────────────────────────────────────
  for (const cp of chainPulses) {
    triggerDeathPulse(g, cp.x, cp.y, cp.type);
  }

  return false;
};
