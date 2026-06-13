/**
 * systems/attackWarnings.ts — Enemy attack telegraphing system.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import type { GameState } from '../state';

let _warningId = 0;

export const spawnAttackWarning = (
  g: GameState,
  x: number,
  y: number,
  duration: number,
  radius: number,
  fireCallback: () => void,
): void => {
  if (!g?.attackWarnings) return;
  const C = GAME_CONFIG.attackWarning;

  g.attackWarnings.push({
    id: ++_warningId,
    x, y, radius,
    life: duration,
    maxLife: duration,
    color: C.color,
    active: true,
    fireCallback,
  });
};

export const getWarningConfig = (enemyType: string): { duration: number; radius: number } => {
  const C = GAME_CONFIG.attackWarning;
  const typeConfig = (C.types as Record<string, { duration?: number; radius?: number }>)?.[enemyType];
  if (typeConfig) {
    return {
      duration: typeConfig.duration ?? C.duration,
      radius: typeConfig.radius ?? C.radius,
    };
  }
  return { duration: C.duration, radius: C.radius };
};

export const updateAttackWarnings = (dt: number, g: GameState): void => {
  if (!g?.attackWarnings) return;

  for (const w of g.attackWarnings) {
    if (!w.active) continue;
    w.life -= dt;
    if (w.life <= 0) {
      w.active = false;
      if (w.fireCallback) w.fireCallback();
    }
  }

  g.attackWarnings = g.attackWarnings.filter(w => w.active);
};
