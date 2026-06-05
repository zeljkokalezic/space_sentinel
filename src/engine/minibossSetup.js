/**
 * minibossSetup.js — Mini-boss fight initialization and cleanup.
 *
 * Selects a mini-boss variant from MINIBOSS_ROSTER based on level,
 * spreads variant properties onto g.miniboss, and triggers intro effects.
 * Stats are scaled from the full boss: hpPercent HP, smaller radius, closer spawn.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { MINIBOSS_ROSTER } from '../constants/bosses';
import { setupBossCore } from './bossSetup';

/**
 * Initialize a mini-boss fight.
 * @param {object} g — Game state
 * @param {number} level — Current player level
 */
export const setupMiniboss = (g, level) => {
  const C = GAME_CONFIG;
  setupBossCore(g, level, MINIBOSS_ROSTER, {
    stateKey: 'miniboss',
    spawnDist: C.miniboss.spawnDistance,
    defaultColor: 0xf97316,
    hpCalc: (variant, level) => {
      const fullBossHp = C.boss.baseHp + level * C.boss.hpPerLevel;
      return {
        hp: Math.floor(fullBossHp * variant.hpPercent),
        radius: variant.radius,
        speed: variant.speed + level * variant.speedPerLevel,
      };
    },
  });
};

/**
 * Reset mini-boss state.
 * @param {object} g — Game state
 */
export const resetMiniboss = (g) => {
  g.miniboss = {
    active: false, x: 0, y: 0, hp: 0, maxHp: 0,
    phase: 1, attackTimer: 0, chargeTimer: 0,
    chargeTarget: { x: 0, y: 0 }, isCharging: false,
    radius: 40, speed: 50, fireCooldown: 1.5, spiralAngle: 0,
  };
};
