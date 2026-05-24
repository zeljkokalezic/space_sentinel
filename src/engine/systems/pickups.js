/**
 * systems/pickups.js — Scrap pickup magnet attraction and collection.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { SoundManager } from '../audio';

/**
 * Create a scrap collection effect at the given position.
 * Spawns golden burst particles, a floating "+N" number, and plays a sound.
 *
 * @param {object} g - Game state
 * @param {number} x - World X position
 * @param {number} y - World Y position
 * @param {number} value - Scrap value collected
 */
export function triggerScrapCollection(g, x, y, value) {
  if (!g) return;
  const C = GAME_CONFIG.scrapCollection;
  if (!C || !C.enabled) return;

  // Golden burst particles
  if (g.particles && C.particleCount > 0) {
    for (let i = 0; i < C.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = C.particleSpeedMin + Math.random() * (C.particleSpeedMax - C.particleSpeedMin);
      g.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 0,
        life: C.particleLife,
        maxLife: C.particleLife,
        color: C.particleColor,
        active: true,
        type: 'spark',
        size: 3,
      });
    }
  }

  // Floating "+N" number effect
  if (g.effects) {
    if (!g.scrapFloats) g.scrapFloats = [];
    if (g.scrapFloats.length >= C.maxFloats) {
      g.scrapFloats.shift();
    }
    g.scrapFloats.push({
      x, y,
      text: `+${value}`,
      life: C.floatLife,
      maxLife: C.floatLife,
      color: C.floatColor,
      active: true,
    });
  }

  // Screen flash for larger pickups
  if (value >= C.flashMinValue && g.screenFlash === undefined) {
    g.screenFlash = { active: true, remaining: C.flashDuration, opacity: C.flashOpacity };
  }

  // Audio feedback
  SoundManager.play('scrap_collect');
}

/**

 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {function} completeMission — Mission completion callback
 */
export const updatePickups = (dt, g, completeMission) => {
  const C = GAME_CONFIG;
  // ── Combo timer decay ──
  if (g.combo && g.combo.timer > 0) {
    g.combo.timer -= dt;
    if (g.combo.timer <= 0) {
      g.combo.count = 0;
      g.combo.multiplier = 1;
      g.combo.timer = 0;
    }
  }
  const currentMagnet = g.player.magnetRadius + (g.levels.magnet - 1) * C.magnet.radiusPerLevel;
  for (let p of g.pickups) {
    if (!p.active) continue;
    const dist = Math.hypot(p.x - g.player.x, p.y - g.player.y);
    if (dist < currentMagnet) {
      const angle = Math.atan2(g.player.y - p.y, g.player.x - p.x);
      p.x += Math.cos(angle) * C.magnet.pullSpeed * dt;
      p.y += Math.sin(angle) * C.magnet.pullSpeed * dt;
      if (Math.hypot(p.x - g.player.x, p.y - g.player.y) < g.player.radius + p.radius) {
        const mult = g.combo?.multiplier ?? 1;
        const value = Math.floor(p.value * mult);
        g.scrap += value;
        g.totalScrapEarned += value;
        if (g.stats) g.stats.totalScrap += value;
        p.active = false;
        // Trigger scrap collection effect
        triggerScrapCollection(g, p.x, p.y, value);
        if (g.mission && g.mission.type === 'collect') {
          g.mission.current += p.value;
          if (g.mission.current >= g.mission.target) completeMission();
        }
      }
    }
  }

  // Update scrap float effects
  if (g.scrapFloats) {
    for (const sf of g.scrapFloats) {
      if (!sf.active) continue;
      sf.life -= dt;
      if (sf.life <= 0) {
        sf.life = 0;
        sf.active = false;
        continue;
      }
      // Float upward
      sf.y -= C.scrapCollection.floatSpeed * dt;
    }
  }
}
