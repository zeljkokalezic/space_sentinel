/**
 * systems/particles.ts — Particle lifecycle and visual effects update.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { spawnParticle } from '../pool';
import type { GameState } from '../state';

const PARTICLE_TYPES: Record<string, { life: number; speedMin: number; speedMax: number; gravity: number; size: number; fade: string }> = {
  spark: { life: 0.6, speedMin: 50, speedMax: 200, gravity: 80, size: 2, fade: 'linear' },
  smoke: { life: 1.2, speedMin: 10, speedMax: 50, gravity: -20, size: 4, fade: 'slow' },
  trail: { life: 0.3, speedMin: 5, speedMax: 20, gravity: 0, size: 1.5, fade: 'fast' },
  explosion: { life: 0.8, speedMin: 30, speedMax: 150, gravity: 40, size: 3, fade: 'linear' },
};

export const updateParticles = (dt: number, g: GameState): void => {
  for (const p of (g.particles as Array<Record<string, unknown>>)) {
    if (!p.active) continue;
    p.life = (p.life as number) - dt;
    if ((p.life as number) <= 0) { p.active = false; continue; }

    p.x = (p.x as number) + (p.vx as number) * dt;
    p.y = (p.y as number) + (p.vy as number) * dt;
    if (p.vz) p.z = ((p.z as number) || 0) + (p.vz as number) * dt;

    const type = (p.type as string) || 'spark';
    const config = PARTICLE_TYPES[type];
    if (config) {
      if (config.gravity) p.vy = (p.vy as number) + config.gravity * dt;

      if (type === 'smoke') {
        p.vx = (p.vx as number) * (1 - 2 * dt);
        p.vy = (p.vy as number) * (1 - 2 * dt);
      } else if (type === 'trail') {
        p.vx = (p.vx as number) * (1 - 5 * dt);
        p.vy = (p.vy as number) * (1 - 5 * dt);
      }

      if (p.maxLife && (p.maxLife as number) > 0) {
        const lifeRatio = (p.life as number) / (p.maxLife as number);
        if (config.fade === 'fast') p.size = config.size * lifeRatio * lifeRatio;
        else if (config.fade === 'slow') p.size = config.size * (1 + (1 - lifeRatio) * 2);
        else p.size = config.size * lifeRatio;
      }
    }
  }
};

export const updateEffects = (dt: number, g: GameState): void => {
  const C = GAME_CONFIG.damageNumbers;
  for (const e of (g.effects as Array<Record<string, unknown>>)) {
    e.life = (e.life as number) - dt;
    if (e.type === 'dmg') {
      e.y = (e.y as number) + C.floatSpeed * dt;
      if (e.popTimer !== undefined) e.popTimer = (e.popTimer as number) + dt;
    }
    if (e.type === 'shield_down') e.y = (e.y as number) + 30 * dt;
    if (e.type === 'combo_milestone') e.bounceTimer = (e.bounceTimer as number) + dt;
  }

  const sf = g.screenFlash as unknown as Record<string, unknown> | undefined;
  if (sf?.active) {
    sf.remaining = (sf.remaining as number) - dt;
    if ((sf.remaining as number) <= 0) {
      sf.active = false;
      sf.remaining = 0;
    }
  }
};

export const createParticlesWithType = (
  g: GameState,
  x: number,
  y: number,
  color: number,
  count: number,
  type = 'spark',
): void => {
  const config = PARTICLE_TYPES[type] || PARTICLE_TYPES.spark;
  const settings = g.settings as unknown as Record<string, unknown> | undefined;
  const quality = settings?.particlesQuality as string | undefined;
  const qualityMult = quality === 'low' ? 0.35 : quality === 'medium' ? 0.65 : 1;
  const motionMult = settings?.reducedMotion ? 0.5 : 1;
  const actualCount = count > 0 ? Math.max(1, Math.round(count * qualityMult * (motionMult as number))) : 0;
  for (let i = 0; i < actualCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * (config.speedMax - config.speedMin) + config.speedMin;
    spawnParticle(g, {
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

export const updateScreenShake = (dt: number, g: GameState): void => {
  if (!g?.screenShake?.active) return;
  const ss = g.screenShake;
  const C = GAME_CONFIG.screenShake;
  ss.intensity -= C.decay * dt;
  if (ss.intensity <= 0) { ss.intensity = 0; ss.active = false; }
};

export const updateHitStop = (dt: number, g: GameState): boolean => {
  if (!g?.hitStop?.active) return false;
  const hs = g.hitStop;
  hs.remaining -= dt;
  if (hs.remaining <= 0) { hs.remaining = 0; hs.active = false; return false; }
  return true;
};

export const updatePlayerIFrames = (dt: number, g: GameState): void => {
  if (!g?.playerIFrames?.active) return;
  const iframes = g.playerIFrames;
  const C = GAME_CONFIG.playerIFrames;

  iframes.remaining -= dt;
  if (iframes.remaining <= 0) {
    iframes.remaining = 0; iframes.active = false;
    iframes.isInvincible = false; iframes.blinkTimer = 0;
    return;
  }

  const elapsed = C.duration - iframes.remaining;
  if (elapsed < C.gracePeriod) {
    iframes.isInvincible = true;
  } else {
    iframes.blinkTimer += dt;
    if (iframes.blinkTimer >= C.blinkPeriod) {
      iframes.blinkTimer -= C.blinkPeriod;
      iframes.isInvincible = !iframes.isInvincible;
    }
  }
};

export const updatePowerupAuras = (dt: number, g: GameState): void => {
  if (!g?.powerupAuras) return;
  const C = GAME_CONFIG.powerupAura;
  for (const aura of g.powerupAuras as Array<Record<string, unknown>>) {
    if (!aura.active) continue;
    aura.ringLife = (aura.ringLife as number) - dt;
    if ((aura.ringLife as number) <= 0) {
      aura.ringLife = 0;
    } else {
      aura.ringRadius = Math.min((aura.ringRadius as number) + C.expandSpeed * dt, aura.ringMaxRadius as number);
    }
    aura.textLife = (aura.textLife as number) - dt;
    if ((aura.textLife as number) > 0) {
      aura.textY = (aura.textY as number) + C.textFloatSpeed * dt;
    }
    if ((aura.ringLife as number) <= 0 && (aura.textLife as number) <= 0) {
      aura.active = false;
    }
  }
  g.powerupAuras = (g.powerupAuras as Array<Record<string, unknown>>).filter(a => a.active);
};
