/**
 * systems/dynamicFov.ts — Dynamic field-of-view camera system.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import type { GameState } from '../state';

export const updateDynamicFov = (dt: number, g: GameState): void => {
  if (!g?.dynamicFov) return;
  const fov = g.dynamicFov;
  const C = GAME_CONFIG.dynamicFov;

  if (fov.hitTimer > 0) {
    fov.hitTimer -= dt;
    fov.target = C.hitFov;
    fov.current = C.hitFov;
    return;
  }

  if (fov.bossDeathTimer > 0) {
    fov.bossDeathTimer -= dt;
    fov.target = C.bossDeathFov;
    fov.current += (fov.target - fov.current) * C.lerpSpeed * dt;
    return;
  }

  let targetFov: number = C.baseFov;

  const bossActive = !!(g.boss?.active && g.boss.hp > 0);
  const minibossActive = !!(g.miniboss?.active && g.miniboss.hp > 0);
  if (bossActive || minibossActive) {
    fov.bossActiveTime += dt;
    if (fov.bossActiveTime >= C.bossSettleTime) {
      targetFov = C.bossFov;
    }
  } else {
    fov.bossActiveTime = 0;
  }

  const hpRatio = g.player.maxHp > 0 ? g.player.hp / g.player.maxHp : 1;
  if (hpRatio < GAME_CONFIG.lowHpWarning.warningThreshold) {
    const urgency = Math.min(1, (GAME_CONFIG.lowHpWarning.warningThreshold - hpRatio) / GAME_CONFIG.lowHpWarning.warningThreshold);
    if (bossActive || minibossActive) {
      targetFov = C.bossFov - urgency * (C.bossFov - C.lowHpFov);
    } else {
      targetFov = C.baseFov - urgency * (C.baseFov - C.lowHpFov);
    }
  }

  fov.target = targetFov;
  fov.current += (fov.target - fov.current) * C.lerpSpeed * dt;
};

export const triggerFovHit = (g: GameState): void => {
  if (!g?.dynamicFov) return;
  g.dynamicFov.hitTimer = GAME_CONFIG.dynamicFov.hitDuration;
};

export const triggerFovBossDeath = (g: GameState): void => {
  if (!g?.dynamicFov) return;
  g.dynamicFov.bossDeathTimer = GAME_CONFIG.dynamicFov.bossDeathDuration;
};
