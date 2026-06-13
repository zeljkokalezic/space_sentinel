/**
 * sabotageSetup.ts — Reusable sabotage mission initialization.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import type { GameState } from './state';

export const setupSabotage = (g: GameState, level: number): void => {
  const C = GAME_CONFIG;
  const cfg = C.sabotage;

  const count = Math.min(
    cfg.maxStructures,
    cfg.baseStructures + Math.floor(level / 2) * cfg.structuresPer2Levels
  );

  const structures: Array<Record<string, unknown>> = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
    const dist = cfg.spawnSpreadMin + Math.random() * (cfg.spawnSpreadMax - cfg.spawnSpreadMin);

    structures.push({
      x: g.player.x + Math.cos(angle) * dist,
      y: g.player.y + Math.sin(angle) * dist,
      hp: cfg.structureHp + level * cfg.hpPerLevel,
      maxHp: cfg.structureHp + level * cfg.hpPerLevel,
      radius: cfg.structureRadius,
      fireCooldown: cfg.fireCooldown,
      active: true,
    });
  }

  g.sabotage.active = true;
  g.sabotage.structures = structures as Array<{ x: number; y: number; hp: number; maxHp: number; radius: number; fireCooldown: number; active: boolean }>;
};

export const resetSabotage = (g: GameState): void => {
  g.sabotage.active = false;
  g.sabotage.structures = [];
};
