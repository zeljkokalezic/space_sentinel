/**
 * combat.ts — Low-level combat utilities.
 * Pure functions; no React imports.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { SoundManager } from './audio';
import { getHostileTargets } from './targeting';
import type { HostileTarget } from './targeting';
import { createParticlesWithType } from './systems/particles';
import { spawnMiniInterceptors } from './spawner';
import { applyMissileKillSynergy, getActiveSynergies } from './weaponSynergies';
import { getExtraScrapPerKill } from './relicSystem';
import { spawnEffect, spawnParticle, spawnPickup, spawnPowerup, spawnProjectileEntity } from './pool';
import type { GameState } from './state';

/** @import { GameState } from './state' */

export { getViewportSize } from './viewport';

/**
 * Check if a directional shield on the enemy absorbs the hit.
 */
export const checkDirectionalShield = (
  e: { directionalShields?: number[]; y: number; x: number } | null | undefined,
  px: number,
  py: number,
  damage = 0,
): boolean => {
  if (!e?.directionalShields) return false;
  const angle = Math.atan2(py - e.y, px - e.x);
  const sides = e.directionalShields.length;
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
 */
export const isShieldBypassedByArmorPierce = (
  e: { _armorPierced?: { hitsLeft: number } } | null | undefined,
): boolean => {
  if (e?._armorPierced && e._armorPierced.hitsLeft > 0) {
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
export const getNearestEnemy = (
  x: number,
  y: number,
  enemies: Array<{ active: boolean; x: number; y: number }>,
): { x: number; y: number } | null => {
  let nearest = null;
  let minDist = Infinity;
  for (const e of enemies) {
    if (!e.active) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist < minDist) { minDist = dist; nearest = e; }
  }
  return nearest;
};

/**
 * Pushes a new projectile into g.projectiles.
 */
export const fireProjectile = (
  g: GameState,
  x: number,
  y: number,
  angle: number,
  speed: number,
  damage: number,
  type: string,
  pierceCount = 0,
  synergyFlags?: { armorPierce?: boolean; guided?: boolean; steerAngle?: number; shieldBypassHits?: number; color?: number } | null,
): void => {
  const C = GAME_CONFIG;
  let target: { x: number; y: number } | null = null;
  if (type === 'missile') {
    const active = getHostileTargets(g).map((t: HostileTarget) => t.ref as { x: number; y: number });
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
  } as Record<string, unknown>);
  if (!proj) return;

  if (synergyFlags) {
    if (synergyFlags.armorPierce) {
      proj.armorPierce = true;
      proj.shieldBypassHits = synergyFlags.shieldBypassHits ?? 3;
      if (synergyFlags.color) proj.color = synergyFlags.color;
    }
    if (synergyFlags.guided) {
      proj.guided = true;
      proj.steerAngle = synergyFlags.steerAngle ?? (Math.PI / 6);
    }
  }
};

/**
 * Spawns burst particles at (x, y) in the particle pool.
 */
export const createParticles = (
  g: GameState,
  x: number,
  y: number,
  color: number,
  count: number,
  type = 'spark',
): void => {
  createParticlesWithType(g, x, y, color, count, type);
};

/**
 * Shared enemy-kill handler used by both enemies.js and environmentalHazards.js.
 */
export const killEnemy = (
  g: GameState,
  e: Record<string, unknown>,
  completeMission?: () => void,
  killSource?: string,
): void => {
  if (!e.active) return;
  const C = GAME_CONFIG;

  e.active = false;

  if (e._hitByDeathPulses) { (e._hitByDeathPulses as Set<unknown>).clear(); delete e._hitByDeathPulses; }

  if (g.stats) g.stats.enemiesDestroyed++;

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

  if (e.eliteVariant === 'swarmLeader') {
    const ev = C.eliteVariants?.swarmLeader;
    if (ev && ev.spawnOnDeath) {
      spawnMiniInterceptors(g, e.x as number, e.y as number, ev.spawnOnDeath as number);
    }
  }

  createParticles(g, e.x as number, e.y as number, e.color as number, 15);

  if (g.combo) {
    const comboConfig = C.combo;
    g.combo.count++;
    g.combo.timer = comboConfig.timerDuration;
    let mult: number = comboConfig.milestones[0].mult;
    for (const m of comboConfig.milestones) {
      if (g.combo.count >= m.count) mult = m.mult;
    }
    g.combo.multiplier = mult;
    if (g.combo.count === 5 || g.combo.count === 10 || g.combo.count === 15) {
      SoundManager.play('combo_milestone');
      triggerComboMilestone(g, g.combo.count);
    }
  }

  if (Math.random() < C.powerups.dropChance) {
    const types = Object.keys(C.powerups.types);
    const type = types[Math.floor(Math.random() * types.length)];
    if (g.powerups) {
      spawnPowerup(g, {
        id: Math.random(),
        x: (e.x as number) + (Math.random() - 0.5) * 20,
        y: (e.y as number) + (Math.random() - 0.5) * 20,
        type,
        active: true,
        radius: 10,
        color: C.powerups.types[type as keyof typeof C.powerups.types].color,
      } as Record<string, unknown>);
    }
  }

  const val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
  const rampageMult = (g.adaptiveDifficulty?.rampageMode) ? 3 : 1;
  const extraScrap = getExtraScrapPerKill(g);
  spawnPickup(g, { id: Math.random(), x: e.x, y: e.y, value: (val as number) * rampageMult + extraScrap, active: true, radius: 6 } as Record<string, unknown>);

  const dpCfg = C.deathPulse;
  if (dpCfg?.eligibleTypes?.includes(e.type as 'heavy' | 'shielded' | 'missile_boat')) {
    triggerDeathPulse(g, e.x as number, e.y as number, e.type as string);
  }

  const activeSynergies = getActiveSynergies(g.levels);
  const chainTargets: object[] = killSource === 'missile' ? applyMissileKillSynergy(e, g, activeSynergies) as object[] : [];
  if (chainTargets.length > 0) {
    const pdDmg = (C.weapons.pointDefense.baseDamage + g.levels.pointDefense * C.weapons.pointDefense.damagePerLevel);
    for (const t of chainTargets) {
      const tAny = t as Record<string, unknown>;
      if (tAny.active !== true) continue;
      const angle = Math.atan2((tAny.y as number) - (e.y as number), (tAny.x as number) - (e.x as number));
      fireProjectile(g, e.x as number, e.y as number, angle, 600, pdDmg, 'chain_reaction', 0);
      if (g.effects) {
        spawnEffect(g, { type: 'laser', source: { x: e.x, y: e.y }, target: t, life: 0.15 } as Record<string, unknown>);
      }
    }
  }
};

/**
 * Trigger screen shake by adding intensity.
 */
export const triggerScreenShake = (
  g: { screenShake?: { active: boolean; intensity: number } },
  presetOrIntensity: string | number,
): void => {
  if (!g?.screenShake) return;
  const C = GAME_CONFIG.screenShake;
  let intensity = 0;
  if (typeof presetOrIntensity === 'string') {
    intensity = (C.presets as Record<string, number>)?.[presetOrIntensity] ?? 0;
  } else if (typeof presetOrIntensity === 'number') {
    intensity = presetOrIntensity;
  }
  g.screenShake.active = true;
  g.screenShake.intensity += intensity;
};

/**
 * Trigger hit stop (freeze frame).
 */
export const triggerHitStop = (
  g: { hitStop?: { remaining: number; active: boolean } },
  presetOrDuration: string | number,
): void => {
  if (!g?.hitStop) return;
  const C = GAME_CONFIG.hitStop;
  let duration = 0;
  if (typeof presetOrDuration === 'string') {
    duration = (C.presets as Record<string, number>)?.[presetOrDuration] ?? 0;
  } else if (typeof presetOrDuration === 'number') {
    duration = presetOrDuration;
  }
  if (duration > g.hitStop.remaining) {
    g.hitStop.remaining = duration;
  }
  g.hitStop.active = true;
};

let _deathPulseId = 0;

/**
 * Trigger a death pulse — an expanding shockwave ring.
 */
export const triggerDeathPulse = (
  g: GameState,
  x: number,
  y: number,
  enemyType: string,
): void => {
  if (!g?.deathPulses) return;
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

  triggerScreenShake(g, 'explosion');
  triggerHitStop(g, 'bigHit');
};

/**
 * Check if an entity's shield just broke and trigger effects.
 */
export const checkShieldBreak = (
  g: GameState,
  entity: { shield?: number; maxShield?: number } | null | undefined,
  x: number,
  y: number,
): void => {
  if (!g || !entity) return;
  if (typeof entity.maxShield !== 'number' || entity.maxShield <= 0 || (entity.shield ?? 0) > 0) return;

  const C = GAME_CONFIG.shieldBreak;

  for (let i = 0; i < C.particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 160;
    spawnParticle(g, {
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
    } as Record<string, unknown>);
  }

  if (g.effects) {
    spawnEffect(g, {
      type: 'shield_down',
      x, y,
      text: C.popupText,
      life: C.popupLife,
      color: C.popupColor,
    } as Record<string, unknown>);
  }

  triggerScreenShake(g, C.screenShakePreset);
  triggerHitStop(g, C.hitStopPreset);

  SoundManager.play('shield_break');
};

/**
 * Apply damage to an entity with shield-first absorption.
 */
export const applyDamageWithShield = (
  g: GameState,
  entity: { shield: number; maxShield: number; hp: number },
  damage: number,
  x: number,
  y: number,
  opts: { skipShield?: boolean } = {},
): { actualDmg: number; shieldAbsorbed: number } => {
  let actualDmg = damage;
  let shieldAbsorbed = 0;
  const shieldWasFull = entity.shield > 0 && entity.maxShield > 0;

  if (!opts.skipShield && entity.shield > 0) {
    shieldAbsorbed = Math.min(entity.shield, actualDmg);
    entity.shield -= shieldAbsorbed;
    actualDmg -= shieldAbsorbed;
  }
  entity.hp -= actualDmg;

  if (shieldWasFull && entity.shield <= 0) {
    checkShieldBreak(g, entity, x, y);
  }
  return { actualDmg, shieldAbsorbed };
};

/**
 * Trigger shield restoration celebration.
 */
export const triggerShieldRestoration = (g: GameState): void => {
  if (!g?.player) return;
  const C = GAME_CONFIG.shieldRestoration;

  if (g.effects) {
    spawnEffect(g, {
      type: 'shield_up',
      x: g.player.x,
      y: g.player.y - 40,
      text: 'SHIELD UP',
      life: C.popupLife,
      maxLife: C.popupLife,
      color: C.popupColor,
    } as Record<string, unknown>);
  }

  triggerScreenShake(g, C.screenShakePreset);
  triggerHitStop(g, C.hitStopPreset);

  if (g.screenFlash === undefined) {
    (g as unknown as Record<string, unknown>).screenFlash = { active: false, remaining: 0, color: '#ffffff' };
  }
  (g.screenFlash as unknown as Record<string, unknown>).active = true;
  (g.screenFlash as unknown as Record<string, unknown>).remaining = C.flashDuration;
  (g.screenFlash as unknown as Record<string, unknown>).alpha = C.flashAlpha;
  (g.screenFlash as unknown as Record<string, unknown>).color = C.flashColor;

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
      } as Record<string, unknown>);
    }
  }

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
    } as Record<string, unknown>);
  }

  SoundManager.play('shield_restore');
};

/**
 * Trigger player invincibility frames (i-frames).
 */
export const triggerPlayerIFrames = (g: GameState): void => {
  if (!g?.playerIFrames) return;
  if (g.playerIFrames.active) return;
  const C = GAME_CONFIG.playerIFrames;

  g.playerIFrames.active = true;
  g.playerIFrames.remaining = C.duration;
  g.playerIFrames.isInvincible = true;
  g.playerIFrames.blinkTimer = 0;
};

/**
 * Trigger combo milestone celebration.
 */
export const triggerComboMilestone = (g: GameState, count: number): void => {
  if (!g?.effects) return;
  const C = GAME_CONFIG.comboCelebration;

  const color = (C.colors as Record<string, string>)[count] || (C.colors as Record<string, string>)[5];

  spawnEffect(g, {
    type: 'combo_milestone',
    count,
    color,
    life: C.popupLife,
    maxLife: C.popupLife,
    bounceTimer: 0,
  } as Record<string, unknown>);

  if (g.screenFlash === undefined) {
    (g as Record<string, unknown>).screenFlash = { active: false, remaining: 0, color: '#ffffff' };
  }
  g.screenFlash.active = true;
  g.screenFlash.remaining = C.flashDuration;
  g.screenFlash.color = color;

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
      } as Record<string, unknown>);
    }
  }
};

/**
 * Spawn an enhanced damage number effect at a world position.
 */
export const spawnDamageNumber = (
  g: GameState,
  x: number,
  y: number,
  damage: number,
  opts: { hitType?: string; shieldDamage?: number; isCrit?: boolean; life?: number } = {},
): void => {
  if (!g?.effects) return;
  const C = GAME_CONFIG.damageNumbers;
  const { hitType = 'hull', shieldDamage, isCrit, life } = opts;

  const bigHit = isCrit || damage >= C.critThreshold;

  let color: string;
  if (hitType === 'playerHit') {
    color = C.playerHitColor;
  } else if (hitType === 'shield') {
    color = C.shieldColor;
  } else if (bigHit) {
    color = C.critColor;
  } else {
    color = C.hullColor;
  }

  let fontSizeMult = 1;
  if (bigHit) fontSizeMult = C.critFontSizeMult;
  else if (hitType === 'shield') fontSizeMult = C.shieldFontSizeMult;

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
    popTimer: 0,
  } as Record<string, unknown>);

  if (shieldDamage != null && shieldDamage > 0) {
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
    } as Record<string, unknown>);
  }
};

/**
 * Trigger power-up pickup aura effect.
 */
export const triggerPowerupAura = (
  g: GameState,
  type: string,
  color: string,
  x: number,
  y: number,
): void => {
  if (!g || !GAME_CONFIG.powerupAura) return;
  const C = GAME_CONFIG.powerupAura;
  if (!C.enabled) return;

  if (!g.powerupAuras) g.powerupAuras = [];
  if (g.powerupAuras.length >= C.maxAuras) {
    const removed = g.powerupAuras.shift() as Record<string, unknown> | undefined;
    if (removed) removed.active = false;
  }

  const buffCfg = GAME_CONFIG.powerups?.types?.[type as keyof typeof GAME_CONFIG.powerups.types];
  const icon = buffCfg?.icon || '✦';
  const name = type.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

  g.powerupAuras.push({
    active: true,
    x, y,
    color,
    type,
    icon,
    name,
    ringRadius: 0,
    ringMaxRadius: C.maxRadius,
    ringLife: C.ringDuration,
    ringMaxLife: C.ringDuration,
    textY: y,
    textLife: C.textDuration,
    textMaxLife: C.textDuration,
  });
};
