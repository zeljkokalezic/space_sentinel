/**
 * combat.js — Low-level combat utilities.
 * Pure functions; no React imports.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { SoundManager } from './audio';
import { getHostileTargets } from './targeting';

/**
 * Returns the nearest active enemy to (x, y), or null if none exist.
 */
export const getNearestEnemy = (x, y, enemies) => {
  let nearest = null;
  let minDist = Infinity;
  for (let e of enemies) {
    if (!e.active) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist < minDist) { minDist = dist; nearest = e; }
  }
  return nearest;
};

/**
 * Pushes a new projectile into g.projectiles.
 * @param {object} g        - Live game state object
 * @param {number} x        - World X origin
 * @param {number} y        - World Y origin
 * @param {number} angle    - Launch angle (radians)
 * @param {number} speed    - Launch speed (world units/s)
 * @param {number} damage   - Damage on hit
 * @param {string} type     - 'autocannon' | 'plasma' | 'missile' | 'enemy_bullet' | 'enemy_missile'
 * @param {number} pierceCount - How many enemies the projectile can pierce through
 */
export const fireProjectile = (g, x, y, angle, speed, damage, type, pierceCount = 0) => {
  const C = GAME_CONFIG;
  let target = null;
  if (type === 'missile') {
    const active = getHostileTargets(g).map(t => t.ref);
    if (active.length > 0) {
      target = active[Math.floor(Math.random() * active.length)];
    }
  } else if (type === 'enemy_missile') {
    target = g.player;
  }

  g.projectiles.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: type === 'plasma' ? 12 : (type === 'missile' || type === 'enemy_missile' ? 8 : 5),
    damage, type, active: true,
    pierce: pierceCount,
    hitList: [],
    life: 0,
    target,
    isEnemy: type.startsWith('enemy'),
  });
};

/**
 * Spawns burst particles at (x, y) in the particle pool.
 * @param {object} g      - Live game state object
 * @param {number} x      - World X position
 * @param {number} y      - World Y position
 * @param {number} color  - Hex colour integer
 * @param {number} count  - Number of particles to emit
 */
export const createParticles = (g, x, y, color, count) => {
  const C = GAME_CONFIG;
  const quality = g.settings?.particlesQuality;
  const qualityMult = quality === 'low' ? 0.35 : quality === 'medium' ? 0.65 : 1;
  const motionMult = g.settings?.reducedMotion ? 0.5 : 1;
  const actualCount = Math.max(0, Math.round(count * qualityMult * motionMult));
  for (let i = 0; i < actualCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * (C.particles.speedMax - C.particles.speedMin) + C.particles.speedMin;
    g.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: (Math.random() - 0.5) * speed,
      life: C.particles.life, maxLife: C.particles.life, color, active: true,
    });
  }
};

/**
 * Shared enemy-kill handler used by both enemies.js and environmentalHazards.js.
 * Handles: deactivation, stats, mission tracking, particles, combo, power-up drops, scrap pickups.
 *
 * @param {object} g              - Live game state
 * @param {object} e              - Enemy being killed
 * @param {function} [completeMission] - Optional callback to complete the current mission
 */
export const killEnemy = (g, e, completeMission) => {
  if (!e.active) return;
  const C = GAME_CONFIG;

  e.active = false;

  // Stats
  if (g.stats) g.stats.enemiesDestroyed++;

  // Mission progress
  if (g.mission) {
    if (g.mission.type === 'kill') {
      g.mission.current++;
      if (!g.mission.completed && completeMission && g.mission.current >= g.mission.target) {
        completeMission();
      }
    } else if (g.mission.type === 'kill_elite' && (e.type === 'missile_boat' || e.type === 'shielded' || e.type === 'heavy')) {
      g.mission.current++;
      if (!g.mission.completed && completeMission && g.mission.current >= g.mission.target) {
        completeMission();
      }
    }
  }

  // Death particles
  createParticles(g, e.x, e.y, e.color, 15);

  // Combo increment
  if (g.combo) {
    const comboConfig = C.combo;
    g.combo.count++;
    g.combo.timer = comboConfig.timerDuration;
    let mult = comboConfig.milestones[0].mult;
    for (const m of comboConfig.milestones) {
      if (g.combo.count >= m.count) mult = m.mult;
    }
    g.combo.multiplier = mult;
    if (g.combo.count === 5 || g.combo.count === 10 || g.combo.count === 15) {
      SoundManager.play('combo_milestone');
    }
  }

  // Power-up drop
  if (Math.random() < C.powerups.dropChance) {
    const types = Object.keys(C.powerups.types);
    const type = types[Math.floor(Math.random() * types.length)];
    if (g.powerups) {
      g.powerups.push({
        id: Math.random(),
        x: e.x + (Math.random() - 0.5) * 20,
        y: e.y + (Math.random() - 0.5) * 20,
        type,
        active: true,
        radius: 10,
        color: C.powerups.types[type].color,
      });
    }
  }

  // Scrap pickup
  const val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
  g.pickups.push({ id: Math.random(), x: e.x, y: e.y, value: val, active: true, radius: 6 });

  // Death pulse for eligible enemy types
  if (C.deathPulse && C.deathPulse.eligibleTypes && C.deathPulse.eligibleTypes.includes(e.type)) {
    triggerDeathPulse(g, e.x, e.y, e.type);
  }
};

/**
 * Trigger screen shake by adding intensity.
 * Accepts either a preset name ('explosion', 'bigExplosion', 'playerHit')
 * or a raw numeric intensity value.
 *
 * @param {object} g — Live game state
 * @param {string|number} presetOrIntensity — Preset name or numeric intensity
 */
export const triggerScreenShake = (g, presetOrIntensity) => {
  if (!g || !g.screenShake) return;
  const C = GAME_CONFIG.screenShake;
  let intensity = 0;
  if (typeof presetOrIntensity === 'string') {
    intensity = C.presets?.[presetOrIntensity] ?? 0;
  } else if (typeof presetOrIntensity === 'number') {
    intensity = presetOrIntensity;
  }
  g.screenShake.active = true;
  g.screenShake.intensity += intensity;
};

/**
 * Trigger hit stop (freeze frame) by setting duration.
 * Uses max of current remaining and new duration to prevent shorter
 * triggers from interrupting longer ones.
 * Accepts either a preset name ('hit', 'bigHit', 'bossHit', 'bossDeath', 'playerHit')
 * or a raw numeric duration in seconds.
 *
 * @param {object} g — Live game state
 * @param {string|number} presetOrDuration — Preset name or duration in seconds
 */
export const triggerHitStop = (g, presetOrDuration) => {
  if (!g || !g.hitStop) return;
  const C = GAME_CONFIG.hitStop;
  let duration = 0;
  if (typeof presetOrDuration === 'string') {
    duration = C.presets?.[presetOrDuration] ?? 0;
  } else if (typeof presetOrDuration === 'number') {
    duration = presetOrDuration;
  }
  if (duration > g.hitStop.remaining) {
    g.hitStop.remaining = duration;
  }
  g.hitStop.active = true;
};

/**
 * Trigger a death pulse — an expanding shockwave ring that damages
 * nearby enemies and the player. Called when eligible enemy types die.
 *
 * @param {object} g — Live game state
 * @param {number} x — World X position
 * @param {number} y — World Y position
 * @param {string} enemyType — The type of enemy that died (used for visual reference)
 */
export const triggerDeathPulse = (g, x, y, enemyType) => {
  if (!g || !g.deathPulses) return;
  const C = GAME_CONFIG.deathPulse;

  const damage = C.baseDamage + ((g.level ?? 1) - 1) * C.damagePerLevel;
  const maxRadius = C.baseRadius + ((g.level ?? 1) - 1) * C.radiusPerLevel;

  g.deathPulses.push({
    x, y,
    radius: 0,
    maxRadius,
    damage,
    life: C.ringDuration,
    maxLife: C.ringDuration,
    color: C.ringColor,
    active: true,
    enemyType,
    hasDamagedPlayer: false,
  });

  // Screen shake + hit stop for dramatic effect
  triggerScreenShake(g, 'explosion');
  triggerHitStop(g, 'bigHit');
};

/**
 * Check if an entity's shield just broke (dropped from >0 to <=0)
 * and trigger the shield break effect if so.
 *
 * Call this AFTER reducing an entity's shield value.
 * The caller is responsible for tracking whether the shield has
 * already broken (e.g. by not calling when shield was already 0).
 *
 * @param {object} g — Live game state
 * @param {object} entity — Entity whose shield was reduced (has .shield and .maxShield)
 * @param {number} x — World X position for effects
 * @param {number} y — World Y position for effects
 */
export const checkShieldBreak = (g, entity, x, y) => {
  if (!g || !entity) return;

  // Only trigger if entity had a shield (maxShield > 0) and it's now depleted
  if (typeof entity.maxShield !== 'number' || entity.maxShield <= 0 || entity.shield > 0) return;

  const C = GAME_CONFIG.shieldBreak;

  // Shatter particles — electric blue shield energy dissipating
  for (let i = 0; i < C.particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 160;
    (g.particles || []).push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: (Math.random() - 0.5) * speed * 0.5,
      life: 0.8,
      maxLife: 0.8,
      color: C.particleColor,
      active: true,
      type: 'spark',
      size: 3,
    });
  }

  // "SHIELD DOWN" popup effect
  if (g.effects) {
    g.effects.push({
      type: 'shield_down',
      x, y,
      text: C.popupText,
      life: C.popupLife,
      color: C.popupColor,
    });
  }

  // Screen shake + hit stop for dramatic effect
  triggerScreenShake(g, C.screenShakePreset);
  triggerHitStop(g, C.hitStopPreset);

  // Audio feedback
  SoundManager.play('shield_break');
};

/**
 * Trigger player invincibility frames (i-frames).
 * Activates a brief invulnerability period after the player takes damage,
 * with visual blinking to indicate the invulnerability window.
 *
 * @param {object} g — Live game state
 */
export const triggerPlayerIFrames = (g) => {
  if (!g || !g.playerIFrames) return;
  const C = GAME_CONFIG.playerIFrames;

  g.playerIFrames.active = true;
  g.playerIFrames.remaining = C.duration;
  g.playerIFrames.isInvincible = true;
  g.playerIFrames.blinkTimer = 0;
};
