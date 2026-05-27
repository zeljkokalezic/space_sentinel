/**
 * combat.js — Low-level combat utilities.
 * Pure functions; no React imports.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { SoundManager } from './audio';
import { getHostileTargets } from './targeting';
import { createParticlesWithType } from './systems/particles';
import { spawnMiniInterceptors } from './spawner';
import { applyMissileKillSynergy, getActiveSynergies } from './weaponSynergies';
import { getExtraScrapPerKill } from './relicSystem';
import { spawnEffect, spawnParticle, spawnPickup, spawnPowerup, spawnProjectileEntity } from './pool';

/**
 * Check if a directional shield on the enemy absorbs the hit.
 * Calculates which side the projectile hits based on the angle from
 * enemy center to projectile position, and depletes that shield side.
 *
 * @param {object} e — Enemy entity (must have directionalShields array)
 * @param {number} px — Projectile X position
 * @param {number} py — Projectile Y position
 * @returns {boolean} true if the hit was absorbed by a directional shield
 */
export const checkDirectionalShield = (e, px, py, damage = 0) => {
  if (!e || !e.directionalShields) return false;
  const angle = Math.atan2(py - e.y, px - e.x);
  const sides = e.directionalShields.length;
  // Normalize angle to [0, 2PI) and compute side index
  const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const sideIndex = Math.floor(normalizedAngle / (Math.PI * 2 / sides)) % sides;
  const shieldVal = e.directionalShields[sideIndex];
  if (shieldVal > 0) {
    e.directionalShields[sideIndex] = Math.max(0, shieldVal - damage);
    return true;
  }
  return false;
};

/**
 * Check if damage should bypass shield due to armor-pierce mark.
 * Decrements the counter if active.
 * @param {object} e — Enemy entity
 * @returns {boolean} true if shield should be bypassed this hit
 */
export const isShieldBypassedByArmorPierce = (e) => {
  if (e._armorPierced && e._armorPierced.hitsLeft > 0) {
    e._armorPierced.hitsLeft--;
    if (e._armorPierced.hitsLeft <= 0) {
      delete e._armorPierced;
    }
    return true;
  }
  return false;
};

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
 * @param {object} [synergyFlags] - Optional synergy flags: { armorPierce, guided, steerAngle, shieldBypassHits, color }
 */
export const fireProjectile = (g, x, y, angle, speed, damage, type, pierceCount = 0, synergyFlags) => {
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

  const proj = spawnProjectileEntity(g, {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: type === 'plasma' ? 12 : (type === 'missile' || type === 'enemy_missile' ? 8 : (type === 'enemy_cannon' ? 10 : 5)),
    damage, type, active: true,
    pierce: pierceCount,
    hitList: [],
    life: 0,
    target,
    isEnemy: type.startsWith('enemy'),
  });
  if (!proj) return;

  // Apply synergy flags
  if (synergyFlags && synergyFlags.armorPierce) {
    proj.armorPierce = true;
    proj.shieldBypassHits = synergyFlags.shieldBypassHits ?? 3;
    if (synergyFlags.color) proj.color = synergyFlags.color;
  }
  if (synergyFlags && synergyFlags.guided) {
    proj.guided = true;
    proj.steerAngle = synergyFlags.steerAngle ?? (Math.PI / 6);
  }

};

/**
 * Spawns burst particles at (x, y) in the particle pool.
 * Delegates to createParticlesWithType for unified quality/motion handling.
 *
 * @param {object} g      - Live game state object
 * @param {number} x      - World X position
 * @param {number} y      - World Y position
 * @param {number} color  - Hex colour integer
 * @param {number} count  - Number of particles to emit
 * @param {string} [type] - Particle type ('spark', 'smoke', 'trail', 'explosion')
 */
export const createParticles = (g, x, y, color, count, type = 'spark') => {
  createParticlesWithType(g, x, y, color, count, type);
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

  // Clean up death pulse tracking set to prevent memory leak
  if (e._hitByDeathPulses) { e._hitByDeathPulses.clear(); delete e._hitByDeathPulses; }

  // Stats
  if (g.stats) g.stats.enemiesDestroyed++;

  // Mission progress
  if (g.mission) {
    if (g.mission.type === 'kill') {
      g.mission.current++;
      if (!g.mission.completed && completeMission && g.mission.current >= g.mission.target) {
        completeMission();
      }
    } else if (g.mission.type === 'kill_elite' && (e.type === 'missile_boat' || e.type === 'shielded' || e.type === 'heavy' || e.eliteVariant)) {
      g.mission.current++;
      if (!g.mission.completed && completeMission && g.mission.current >= g.mission.target) {
        completeMission();
      }
    }
  }

  // Swarm Leader: spawn mini-interceptors on death
  if (e.eliteVariant === 'swarmLeader') {
    const ev = C.eliteVariants?.swarmLeader;
    if (ev && ev.spawnOnDeath) {
      spawnMiniInterceptors(g, e.x, e.y, ev.spawnOnDeath);
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
      // Trigger milestone celebration effect
      triggerComboMilestone(g, g.combo.count);
    }
  }

  // Power-up drop
  if (Math.random() < C.powerups.dropChance) {
    const types = Object.keys(C.powerups.types);
    const type = types[Math.floor(Math.random() * types.length)];
    if (g.powerups) {
      spawnPowerup(g, {
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

  // Scrap pickup (3x in rampage mode, +Salvager bonus)
  const val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
  const rampageMult = (g.adaptiveDifficulty?.rampageMode) ? 3 : 1;
  const extraScrap = getExtraScrapPerKill(g);
  spawnPickup(g, { id: Math.random(), x: e.x, y: e.y, value: val * rampageMult + extraScrap, active: true, radius: 6 });

  // Death pulse for eligible enemy types
  if (C.deathPulse && C.deathPulse.eligibleTypes && C.deathPulse.eligibleTypes.includes(e.type)) {
    triggerDeathPulse(g, e.x, e.y, e.type);
  }

  // Chain Reaction synergy: missile kills trigger point defense at nearby enemies
  const activeSynergies = getActiveSynergies(g.levels);
  const chainTargets = applyMissileKillSynergy(e, g, activeSynergies);
  if (chainTargets.length > 0) {
    const pdDmg = (C.weapons.pointDefense.baseDamage + g.levels.pointDefense * C.weapons.pointDefense.damagePerLevel);
    for (const t of chainTargets) {
      if (!t.active) continue;
      const angle = Math.atan2(t.y - e.y, t.x - e.x);
      fireProjectile(g, e.x, e.y, angle, 600, pdDmg, 'chain_reaction', 0);
      // Visual laser effect
      if (g.effects) {
        spawnEffect(g, { type: 'laser', source: { x: e.x, y: e.y }, target: t, life: 0.15 });
      }
    }
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
 * Death pulse counter for unique IDs.
 */
let _deathPulseId = 0;

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
    id: ++_deathPulseId,
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
    spawnEffect(g, {
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
 * Trigger shield restoration celebration — visual and audio fanfare
 * when the player's shield fully regenerates from depleted state.
 *
 * @param {object} g — Live game state
 */
export const triggerShieldRestoration = (g) => {
  if (!g || !g.player) return;
  const C = GAME_CONFIG.shieldRestoration;

  // "SHIELD UP" popup effect (world-space, above player)
  if (g.effects) {
    spawnEffect(g, {
      type: 'shield_up',
      x: g.player.x,
      y: g.player.y - 40,
      text: 'SHIELD UP',
      life: C.popupLife,
      maxLife: C.popupLife,
      color: C.popupColor,
    });
  }

  // Screen shake + hit stop
  triggerScreenShake(g, C.screenShakePreset);
  triggerHitStop(g, C.hitStopPreset);

  // Screen flash effect
  if (g.screenFlash === undefined) {
    g.screenFlash = { active: false, remaining: 0, color: '#ffffff' };
  }
  g.screenFlash.active = true;
  g.screenFlash.remaining = C.flashDuration;
  g.screenFlash.alpha = C.flashAlpha;
  g.screenFlash.color = C.flashColor;

  // Particle burst around player (electric blue shield energy)
  if (g.particles) {
    for (let i = 0; i < C.particleCount; i++) {
      const angle = (Math.PI * 2 / C.particleCount) * i + (Math.random() - 0.5) * 0.3;
      const speed = C.particleSpeedMin + Math.random() * (C.particleSpeedMax - C.particleSpeedMin);
      spawnParticle(g, {
        x: g.player.x,
        y: g.player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: (Math.random() - 0.5) * 30,
        life: C.particleLife,
        maxLife: C.particleLife,
        color: C.particleColor,
        active: true,
        type: 'spark',
        size: 3,
      });
    }
  }

  // Expanding shield ring effect
  if (g.effects) {
    spawnEffect(g, {
      type: 'shield_ring',
      x: g.player.x,
      y: g.player.y,
      radius: 0,
      maxRadius: C.ringMaxRadius,
      life: C.ringDuration,
      maxLife: C.ringDuration,
      color: C.ringColor,
    });
  }

  // Audio feedback
  SoundManager.play('shield_restore');
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
  if (g.playerIFrames.active) return; // Already active, don't reset timer
  const C = GAME_CONFIG.playerIFrames;

  g.playerIFrames.active = true;
  g.playerIFrames.remaining = C.duration;
  g.playerIFrames.isInvincible = true;
  g.playerIFrames.blinkTimer = 0;
};

/**
 * Trigger combo milestone celebration — visual fanfare when the player
 * reaches a combo milestone (5, 10, 15 kills). Creates a popup effect,
 * screen flash, combo counter bounce, and particle burst.
 *
 * @param {object} g — Live game state
 * @param {number} count — The combo count that triggered the milestone
 */
export const triggerComboMilestone = (g, count) => {
  if (!g || !g.effects) return;
  const C = GAME_CONFIG.comboCelebration;

  // Determine color for this milestone tier
  const color = C.colors[count] || C.colors[5];

  // Milestone popup effect (screen-space, centered)
  spawnEffect(g, {
    type: 'combo_milestone',
    count,
    color,
    life: C.popupLife,
    maxLife: C.popupLife,
    // Bounce animation timer
    bounceTimer: 0,
  });

  // Screen flash effect
  if (g.screenFlash === undefined) {
    g.screenFlash = { active: false, remaining: 0, color: '#ffffff' };
  }
  g.screenFlash.active = true;
  g.screenFlash.remaining = C.flashDuration;
  g.screenFlash.color = color;

  // Particle burst at player position (world-space celebration)
  if (g.particles) {
    for (let i = 0; i < C.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      spawnParticle(g, {
        x: g.player.x,
        y: g.player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        color: parseInt(color.replace('#', '0x')),
        active: true,
        type: 'spark',
        size: 3 + Math.random() * 3,
      });
    }
  }
};

/**
 * Spawn an enhanced damage number effect at a world position.
 * Determines visual style (color, size, pop animation) based on
 * damage amount, hit type, and whether shield absorbed the damage.
 *
 * @param {object} g — Live game state
 * @param {number} x — World X position
 * @param {number} y — World Y position
 * @param {number} damage — Damage value displayed (will be ceiled)
 * @param {object} [opts] — Options
 * @param {string} [opts.hitType] — 'hull' | 'shield' | 'playerHit' (default: 'hull')
 * @param {number} [opts.shieldDamage] — Amount absorbed by shield (triggers secondary shield number)
 * @param {boolean} [opts.isCrit] — Force crit styling regardless of damage amount
 * @param {number} [opts.life] — Override lifetime
 */
export const spawnDamageNumber = (g, x, y, damage, opts = {}) => {
  if (!g || !g.effects) return;
  const C = GAME_CONFIG.damageNumbers;
  const { hitType = 'hull', shieldDamage, isCrit, life } = opts;

  // Determine if this is a "big" hit (crit styling)
  const bigHit = isCrit || damage >= C.critThreshold;

  // Determine color
  let color;
  if (hitType === 'playerHit') {
    color = C.playerHitColor;
  } else if (hitType === 'shield') {
    color = C.shieldColor;
  } else if (bigHit) {
    color = C.critColor;
  } else {
    color = C.hullColor;
  }

  // Determine font size multiplier
  let fontSizeMult = 1;
  if (bigHit) fontSizeMult = C.critFontSizeMult;
  else if (hitType === 'shield') fontSizeMult = C.shieldFontSizeMult;

  // Random horizontal offset for visual variety
  const offsetX = (Math.random() - 0.5) * 12;
  const offsetY = (Math.random() - 0.5) * 6;

  spawnEffect(g, {
    type: 'dmg',
    x: x + offsetX,
    y: y + offsetY,
    text: Math.ceil(damage).toString(),
    life: life ?? C.lifetime,
    maxLife: life ?? C.lifetime,
    color,
    fontSizeMult,
    hitType,
    // Pop animation: starts at 0.5x, peaks at popScale, settles to 1x
    popTimer: 0,
  });

  // If shield absorbed some damage, spawn a secondary shield damage number
  if (shieldDamage > 0) {
    spawnEffect(g, {
      type: 'dmg',
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 10 - 5,
      text: Math.ceil(shieldDamage).toString(),
      life: C.lifetime * 0.8,
      maxLife: C.lifetime * 0.8,
      color: C.shieldColor,
      fontSizeMult: C.shieldFontSizeMult,
      hitType: 'shield',
      popTimer: 0,
    });
  }
};

/**
 * Trigger power-up pickup aura effect — expanding energy ring + floating buff name.
 * Creates a satisfying visual "pop" that confirms the power-up collection and
 * shows which buff was activated.
 *
 * @param {object} g — Live game state
 * @param {string} type — Power-up type (e.g. 'rapidFire', 'shieldBoost')
 * @param {string} color — Hex color string for the aura ring
 * @param {number} x — World X position (player position)
 * @param {number} y — World Y position (player position)
 */
export const triggerPowerupAura = (g, type, color, x, y) => {
  if (!g || !GAME_CONFIG.powerupAura) return;
  const C = GAME_CONFIG.powerupAura;
  if (!C.enabled) return;

  // Enforce max concurrent auras
  if (!g.powerupAuras) g.powerupAuras = [];
  if (g.powerupAuras.length >= C.maxAuras) {
    // Remove oldest
    const removed = g.powerupAuras.shift();
    if (removed) removed.active = false;
  }

  // Get buff config for display text
  const buffCfg = GAME_CONFIG.powerups?.types?.[type];
  const icon = buffCfg?.icon || '✦';
  const name = type.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  g.powerupAuras.push({
    active: true,
    x, y,
    color,
    type,
    icon,
    name,
    // Ring state
    ringRadius: 0,
    ringMaxRadius: C.maxRadius,
    ringLife: C.ringDuration,
    ringMaxLife: C.ringDuration,
    // Text state
    textY: y,
    textLife: C.textDuration,
    textMaxLife: C.textDuration,
  });
};
