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
import { createParticles, triggerPlayerIFrames, checkShieldBreak, killEnemy } from '../combat';

/**
 * Update all active death pulses: expand rings, check collisions, apply damage.
 *
 * @param {number} dt — Delta time in seconds
 * @param {object} g — Game state
 * @param {function} [completeMission] — Optional callback to complete the current mission
 * @returns {boolean} Always false (death pulses don't end the game)
 */
export const updateDeathPulses = (dt, g, completeMission) => {
  if (!g || !g.deathPulses) return false;
  const C = GAME_CONFIG.deathPulse;

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
          const dpEnemyShieldWasFull = e.shield > 0 && e.maxShield > 0;
          if (e.shield > 0) {
            const absorb = Math.min(e.shield, dmg);
            e.shield -= absorb;
            dmg -= absorb;
          }
          e.hp -= dmg;
          if (dpEnemyShieldWasFull && e.shield <= 0) {
            checkShieldBreak(g, e, e.x, e.y);
          }

          // Push enemy away from pulse center
          if (dist > 0) {
            const pushForce = 80;
            e.x += (e.x - pulse.x) / dist * pushForce * dt * 3;
            e.y += (e.y - pulse.y) / dist * pushForce * dt * 3;
          }

          // Check if enemy died from pulse — use killEnemy for proper rewards
          if (e.hp <= 0 && e.active) {
            killEnemy(g, e, completeMission);
          }
        }
      }
    }

    // ─── Damage player ─────────────────────────────────────────────
    if (!pulse.hasDamagedPlayer && g.player) {
      const distToPlayer = Math.hypot(g.player.x - pulse.x, g.player.y - pulse.y);
      if (distToPlayer <= pulse.radius + (g.player.radius || 38)) {
        pulse.hasDamagedPlayer = true;

        // Check invincibility frames — block damage if invincible
        if (g.playerIFrames && g.playerIFrames.isInvincible) {
          createParticles(g, g.player.x, g.player.y, 0x60a5fa, 5);
          // Still push player away
          if (distToPlayer > 0) {
            const pushForce = 120;
            g.player.x += (g.player.x - pulse.x) / distToPlayer * pushForce * dt * 3;
            g.player.y += (g.player.y - pulse.y) / distToPlayer * pushForce * dt * 3;
          }
        } else {
          let dmg = pulse.damage;
          const dpPlayerShieldWasFull = g.player.shield > 0 && g.player.maxShield > 0;
          if (g.player.shield > 0) {
            const absorb = Math.min(g.player.shield, dmg);
            g.player.shield -= absorb;
            dmg -= absorb;
          }
          g.player.hp -= dmg;
          if (dpPlayerShieldWasFull && g.player.shield <= 0) {
            checkShieldBreak(g, g.player, g.player.x, g.player.y);
          }

          // Push player away
          if (distToPlayer > 0) {
            const pushForce = 120;
            g.player.x += (g.player.x - pulse.x) / distToPlayer * pushForce * dt * 3;
            g.player.y += (g.player.y - pulse.y) / distToPlayer * pushForce * dt * 3;
          }

          // Impact particles at player position
          createParticles(g, g.player.x, g.player.y, 0xf97316, 8);

          triggerPlayerIFrames(g);
        }
      }
    }
  }

  return false;
};
