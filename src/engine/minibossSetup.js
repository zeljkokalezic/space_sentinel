/**
 * minibossSetup.js — Mini-boss fight initialization and cleanup.
 * Scaled-down version of bossSetup.js with 40% HP, 50% damage.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { createParticles } from './combat';

/**
 * Initialize a mini-boss fight.
 * Stats are scaled from the full boss: 40% HP, smaller radius, closer spawn.
 * @param {object} g — Game state
 * @param {number} level — Current player level
 */
export const setupMiniboss = (g, level) => {
  const C = GAME_CONFIG;
  const fullBossHp = C.boss.baseHp + level * C.boss.hpPerLevel;
  const minibossHp = Math.floor(fullBossHp * C.miniboss.hpPercent);
  const spawnDist = 800;
  const angle = Math.random() * Math.PI * 2;

  g.miniboss = {
    ...g.miniboss,
    active: true,
    x: g.player.x + Math.cos(angle) * spawnDist,
    y: g.player.y + Math.sin(angle) * spawnDist,
    hp: minibossHp,
    maxHp: minibossHp,
    phase: 1,
    attackTimer: 2,
    chargeTimer: C.boss.chargeCooldown,
    chargeTarget: { x: 0, y: 0 },
    isCharging: false,
    radius: C.miniboss.radius,
    speed: C.miniboss.baseSpeed + level * C.miniboss.speedPerLevel,
    fireCooldown: C.boss.fireCooldown,
    spiralAngle: 0,
    shield: 0,
    maxShield: 0,
  };

  // Stop regular enemy spawning during mini-boss fight
  g.spawnCooldown = 999;

  // Visual effect for mini-boss spawn (orange)
  createParticles(g, g.miniboss.x, g.miniboss.y, '#f97316', 30);
};

/**
 * Reset mini-boss state.
 * @param {object} g — Game state
 */
export const resetMiniboss = (g) => {
  g.miniboss = {
    active: false,
    x: 0, y: 0,
    hp: 0, maxHp: 0,
    phase: 1,
    attackTimer: 0,
    chargeTimer: 0,
    chargeTarget: { x: 0, y: 0 },
    isCharging: false,
    radius: 40,
    speed: 50,
    fireCooldown: 1.5,
    spiralAngle: 0,
  };
};
