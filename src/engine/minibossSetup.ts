/**
 * minibossSetup.ts — Mini-boss fight initialization and cleanup.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { MINIBOSS_ROSTER } from '../constants/bosses';
import { setupBossCore } from './bossSetup';
import type { GameState } from './state';

export const setupMiniboss = (g: GameState, level: number): void => {
  const C = GAME_CONFIG;
  setupBossCore(g, level, MINIBOSS_ROSTER as unknown as Record<string, unknown>[], {
    stateKey: 'miniboss',
    spawnDist: C.miniboss.spawnDistance,
    defaultColor: 0xf97316,
    hpCalc: (variant, lvl) => {
      const fullBossHp = C.boss.baseHp + lvl * C.boss.hpPerLevel;
      return {
        hp: Math.floor(fullBossHp * (variant.hpPercent as number)),
        radius: variant.radius as number,
        speed: (variant.speed as number) + lvl * (variant.speedPerLevel as number),
      };
    },
  });
};

export const resetMiniboss = (g: GameState): void => {
  (g as Record<string, unknown>).miniboss = {
    active: false, x: 0, y: 0, hp: 0, maxHp: 0,
    shield: 0, maxShield: 0,
    phase: 1, attackTimer: 0, chargeTimer: 0,
    chargeTarget: { x: 0, y: 0 }, isCharging: false,
    radius: 40, speed: 50, fireCooldown: 1.5, spiralAngle: 0,
    rage: false, rageAuraTimer: 0, rageEmberTimer: 0,
    voidZones: [], regenTimer: 0, regenActive: false,
    phaseShiftTimer: 0, decoy: null,
  };
};
