/**
 * systems/particles.js — Particle lifecycle and visual effects update.
 *
 * Supports multiple particle types with different behaviors:
 * - spark: Fast, bright particles with gravity (explosions, impacts)
 * - smoke: Slow, expanding particles with fade (engine exhaust, damage)
 * - trail: Persistent trail particles (projectile trails, movement)
 * - explosion: Large burst with shockwave effect
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

/**
 * Particle type configurations.
 */
const PARTICLE_TYPES = {
  spark: {
    life: 0.6,
    speedMin: 50,
    speedMax: 200,
    gravity: 80,
    size: 2,
    fade: 'linear',
  },
  smoke: {
    life: 1.2,
    speedMin: 10,
    speedMax: 50,
    gravity: -20,
    size: 4,
    fade: 'slow',
  },
  trail: {
    life: 0.3,
    speedMin: 5,
    speedMax: 20,
    gravity: 0,
    size: 1.5,
    fade: 'fast',
  },
  explosion: {
    life: 0.8,
    speedMin: 30,
    speedMax: 150,
    gravity: 40,
    size: 3,
    fade: 'linear',
  },
};

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updateParticles = (dt, g) => {
  for (let p of g.particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }

    // Apply velocity
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vz) p.z = (p.z || 0) + p.vz * dt;

    // Apply type-specific behavior
    const type = p.type || 'spark';
    const config = PARTICLE_TYPES[type];
    if (config) {
      // Apply gravity
      if (config.gravity) {
        p.vy += config.gravity * dt;
      }

      // Apply drag based on type
      if (type === 'smoke') {
        p.vx *= (1 - 2 * dt);
        p.vy *= (1 - 2 * dt);
      } else if (type === 'trail') {
        p.vx *= (1 - 5 * dt);
        p.vy *= (1 - 5 * dt);
      }

      // Update size based on fade type
      if (p.maxLife && p.maxLife > 0) {
        const lifeRatio = p.life / p.maxLife;
        if (config.fade === 'fast') {
          p.size = (config.size || 2) * lifeRatio * lifeRatio;
        } else if (config.fade === 'slow') {
          p.size = (config.size || 3) * (1 + (1 - lifeRatio) * 2);
        } else {
          p.size = (config.size || 2) * lifeRatio;
        }
      }
    }
  }
};

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updateEffects = (dt, g) => {
  const C = GAME_CONFIG.damageNumbers;
  const celeb = GAME_CONFIG.comboCelebration;
  for (let e of g.effects) {
    e.life -= dt;
    if (e.type === 'dmg') {
      // Float upward
      e.y += C.floatSpeed * dt;

      // Pop animation: scale from 0.5x → popScale → 1x over popDuration
      if (e.popTimer !== undefined) {
        e.popTimer += dt;
      }
    }
    if (e.type === 'shield_down') e.y += 30 * dt;
    if (e.type === 'combo_milestone') {
      // Bounce animation timer
      e.bounceTimer += dt;
    }
  }

  // Update screen flash
  if (g.screenFlash && g.screenFlash.active) {
    g.screenFlash.remaining -= dt;
    if (g.screenFlash.remaining <= 0) {
      g.screenFlash.active = false;
      g.screenFlash.remaining = 0;
    }
  }
};

/**
 * Create particles with a specific type.
 * @param {object} g - Game state
 * @param {number} x - World X position
 * @param {number} y - World Y position
 * @param {number} color - Hex color integer
 * @param {number} count - Number of particles to emit
 * @param {string} type - Particle type ('spark', 'smoke', 'trail', 'explosion')
 */
export const createParticlesWithType = (g, x, y, color, count, type = 'spark') => {
  const config = PARTICLE_TYPES[type] || PARTICLE_TYPES.spark;
  const quality = g.settings?.particlesQuality;
  const qualityMult = quality === 'low' ? 0.35 : quality === 'medium' ? 0.65 : 1;
  const motionMult = g.settings?.reducedMotion ? 0.5 : 1;
  const actualCount = Math.max(0, Math.round(count * qualityMult * motionMult));
  for (let i = 0; i < actualCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * (config.speedMax - config.speedMin) + config.speedMin;
    g.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: (Math.random() - 0.5) * speed,
      life: config.life,
      maxLife: config.life,
      color,
      active: true,
      type,
      size: config.size,
    });
  }
};

/**
 * Screen shake decay — reduces intensity each frame.
 * Deactivates when intensity drops below minThreshold.
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updateScreenShake = (dt, g) => {
  if (!g || !g.screenShake) return;
  const ss = g.screenShake;
  if (!ss.active) return;

  const C = GAME_CONFIG.screenShake;
  ss.intensity -= C.decay * dt;
  if (ss.intensity <= 0) {
    ss.intensity = 0;
    ss.active = false;
  }
};

/**
 * Hit stop countdown — pauses physics while counting down.
 * Returns true while active (signals physics should be skipped).
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @returns {boolean} true if hit stop is active (physics should be skipped)
 */
export const updateHitStop = (dt, g) => {
  if (!g || !g.hitStop) return false;
  const hs = g.hitStop;
  if (!hs.active) return false;

  hs.remaining -= dt;
  if (hs.remaining <= 0) {
    hs.remaining = 0;
    hs.active = false;
    return false;
  }
  return true;
};

/**
 * Player invincibility frames (i-frames) update.
 * Counts down the invulnerability timer and manages the blink cycle.
 * During the grace period, the player is always invincible.
 * After the grace period, invincibility toggles with the blink cycle.
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updatePlayerIFrames = (dt, g) => {
  if (!g || !g.playerIFrames) return;
  const iframes = g.playerIFrames;
  if (!iframes.active) return;

  const C = GAME_CONFIG.playerIFrames;

  // Count down remaining time
  iframes.remaining -= dt;
  if (iframes.remaining <= 0) {
    iframes.remaining = 0;
    iframes.active = false;
    iframes.isInvincible = false;
    iframes.blinkTimer = 0;
    return;
  }

  // Time elapsed since i-frames started
  const elapsed = C.duration - iframes.remaining;

  if (elapsed < C.gracePeriod) {
    // Grace period: always invincible, no blinking
    iframes.isInvincible = true;
  } else {
    // Blink phase: toggle invincibility based on blink timer
    iframes.blinkTimer += dt;
    if (iframes.blinkTimer >= C.blinkPeriod) {
      iframes.blinkTimer -= C.blinkPeriod;
      iframes.isInvincible = !iframes.isInvincible;
    }
  }
};

/**
 * Power-up aura ring update — expanding ring + floating buff name text.
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updatePowerupAuras = (dt, g) => {
  if (!g || !g.powerupAuras) return;
  const C = GAME_CONFIG.powerupAura;
  for (const aura of g.powerupAuras) {
    if (!aura.active) continue;

    // Ring expansion
    aura.ringLife -= dt;
    if (aura.ringLife <= 0) {
      aura.ringLife = 0;
    } else {
      aura.ringRadius += C.expandSpeed * dt;
      if (aura.ringRadius > aura.ringMaxRadius) aura.ringRadius = aura.ringMaxRadius;
    }

    // Text float upward
    aura.textLife -= dt;
    if (aura.textLife > 0) {
      aura.textY += C.textFloatSpeed * dt;
    }

    // Deactivate when both ring and text expire
    if (aura.ringLife <= 0 && aura.textLife <= 0) {
      aura.active = false;
    }
  }

  // Periodic cleanup of dead auras
  g.powerupAuras = g.powerupAuras.filter(a => a.active);
};
