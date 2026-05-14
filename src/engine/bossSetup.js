/**
 * bossSetup.js — Boss fight initialization and cleanup.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { createParticles } from './combat';

/**
 * Initialize a boss fight.
 * @param {object} g — Game state
 * @param {number} level — Current player level
 */
export const setupBoss = (g, level) => {
  const C = GAME_CONFIG;
  const bossHp = C.boss.baseHp + level * C.boss.hpPerLevel;
  const spawnDist = 1200;
  const angle = Math.random() * Math.PI * 2;

  g.boss = {
    ...g.boss,
    active: true,
    x: g.player.x + Math.cos(angle) * spawnDist,
    y: g.player.y + Math.sin(angle) * spawnDist,
    hp: bossHp,
    maxHp: bossHp,
    phase: 1,
    attackTimer: 2, // Initial delay before first attack
    chargeTimer: C.boss.chargeCooldown,
    chargeTarget: { x: 0, y: 0 },
    isCharging: false,
    radius: C.boss.radius,
    speed: C.boss.baseSpeed + level * C.boss.speedPerLevel,
    fireCooldown: C.boss.fireCooldown,
    spiralAngle: 0,
  };

  // Stop regular enemy spawning during boss fight
  g.spawnCooldown = 999;

  // Visual effect for boss spawn
  createParticles(g, g.boss.x, g.boss.y, '#dc2626', 30);
};

/**
 * Reset boss state.
 * @param {object} g — Game state
 */
export const resetBoss = (g) => {
  g.boss = {
    active: false,
    x: 0, y: 0,
    hp: 0, maxHp: 0,
    phase: 1,
    attackTimer: 0,
    chargeTimer: 0,
    chargeTarget: { x: 0, y: 0 },
    isCharging: false,
    radius: 60,
    speed: 60,
    fireCooldown: 1.5,
    spiralAngle: 0,
  };
};
