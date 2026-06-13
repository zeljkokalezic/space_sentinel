/**
 * systems/pickups.ts — Scrap pickup magnet attraction and collection.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { SoundManager } from '../audio';
import { getScrapMult } from '../relicSystem';
import { spawnParticle } from '../pool';
import type { GameState } from '../state';

export function triggerScrapCollection(g: GameState, x: number, y: number, value: number): void {
  if (!g) return;
  const C = GAME_CONFIG.scrapCollection;
  if (!C?.enabled) return;

  if (g.particles && C.particleCount > 0) {
    for (let i = 0; i < C.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = C.particleSpeedMin + Math.random() * (C.particleSpeedMax - C.particleSpeedMin);
      spawnParticle(g, {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 0, life: C.particleLife, maxLife: C.particleLife,
        color: C.particleColor, active: true, type: 'spark', size: 3,
      });
    }
  }

  if (g.effects) {
    if (!g.scrapFloats) g.scrapFloats = [];
    if (g.scrapFloats.length >= C.maxFloats) g.scrapFloats.shift();
    g.scrapFloats.push({
      x, y, text: `+${value}`, life: C.floatLife, maxLife: C.floatLife,
      color: C.floatColor, active: true,
    });
  }

  if (value >= C.flashMinValue) {
    if (!g.screenFlash) {
      (g as Record<string, unknown>).screenFlash = { active: false, remaining: 0, color: '#ffffff' };
    }
    const sf = g.screenFlash as unknown as Record<string, unknown>;
    sf.active = true;
    sf.remaining = C.flashDuration;
    sf.opacity = C.flashOpacity;
    sf.alpha = C.flashOpacity;
  }

  SoundManager.play('scrap_collect');
}

export const updatePickups = (dt: number, g: GameState, completeMission: () => void): void => {
  const C = GAME_CONFIG;
  if (g.combo?.timer > 0) {
    g.combo.timer -= dt;
    if (g.combo.timer <= 0) {
      g.combo.count = 0;
      g.combo.multiplier = 1;
      g.combo.timer = 0;
    }
  }

  const currentMagnet = g.player.magnetRadius + (g.levels.magnet - 1) * C.magnet.radiusPerLevel;
  for (const p of (g.pickups as Array<Record<string, unknown>>)) {
    if (!p.active) continue;
    const dist = Math.hypot((p.x as number) - g.player.x, (p.y as number) - g.player.y);
    if (dist < currentMagnet) {
      const angle = Math.atan2(g.player.y - (p.y as number), g.player.x - (p.x as number));
      p.x = (p.x as number) + Math.cos(angle) * C.magnet.pullSpeed * dt;
      p.y = (p.y as number) + Math.sin(angle) * C.magnet.pullSpeed * dt;
      if (Math.hypot((p.x as number) - g.player.x, (p.y as number) - g.player.y) < g.player.radius + (p.radius as number)) {
        const mult = g.combo?.multiplier ?? 1;
        const relicScrapMult = getScrapMult(g);
        const value = Math.floor((p.value as number) * mult * relicScrapMult);
        g.scrap += value;
        g.totalScrapEarned += value;
        if (g.stats) g.stats.totalScrap += value;
        p.active = false;
        triggerScrapCollection(g, p.x as number, p.y as number, value);
        if (g.mission?.type === 'collect') {
          g.mission.current += p.value as number;
          if (g.mission.current >= g.mission.target) completeMission();
        }
      }
    }
  }

  if (g.scrapFloats) {
    for (const sf of g.scrapFloats) {
      if (!sf.active) continue;
      sf.life -= dt;
      if (sf.life <= 0) { sf.life = 0; sf.active = false; continue; }
      sf.y -= C.scrapCollection.floatSpeed * dt;
    }
  }
}
