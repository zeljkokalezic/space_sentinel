/**
 * minibossSetup.js — Mini-boss fight initialization and cleanup.
 *
 * Selects a mini-boss variant from MINIBOSS_ROSTER based on level,
 * spreads variant properties onto g.miniboss, and triggers intro effects.
 * Stats are scaled from the full boss: hpPercent HP, smaller radius, closer spawn.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { MINIBOSS_ROSTER } from '../constants/bosses';
import { createParticles } from './combat';
import { SoundManager } from './audio';

/**
 * Initialize a mini-boss fight.
 * @param {object} g — Game state
 * @param {number} level — Current player level
 */
export const setupMiniboss = (g, level) => {
  const C = GAME_CONFIG;

  // Select mini-boss variant (deterministic by level, cycles through roster)
  const variant = MINIBOSS_ROSTER[level % MINIBOSS_ROSTER.length];

  const fullBossHp = C.boss.baseHp + level * C.boss.hpPerLevel;
  const minibossHp = Math.floor(fullBossHp * variant.hpPercent);
  const spawnDist = 800;
  const angle = Math.random() * Math.PI * 2;

  g.miniboss = {
    ...g.miniboss,
    // Variant identity
    id: variant.id,
    name: variant.name,
    color: variant.color,
    innerColor: variant.innerColor,
    geometry: variant.geometry,
    attackPatterns: variant.attackPatterns,
    deathColors: variant.deathColors,
    guaranteedDrops: variant.guaranteedDrops,
    scrapReward: variant.scrapReward,

    // Core state
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
    radius: variant.radius,
    speed: variant.speed + level * variant.speedPerLevel,
    fireCooldown: C.boss.fireCooldown,
    spiralAngle: 0,
    shield: 0,
    maxShield: 0,
  };

  // Stop regular enemy spawning during mini-boss fight
  g.spawnCooldown = 999;

  // Intro announcement
  g.effects.push({
    type: 'boss_intro',
    text: variant.introText,
    life: 2.5,
    big: false,
  });
  g.effects.push({
    type: 'boss_intro',
    text: variant.name,
    life: 2.5,
    big: true,
  });

  // Visual effect for mini-boss spawn
  createParticles(g, g.miniboss.x, g.miniboss.y, variant.color || 0xf97316, 30);

  // Audio
  SoundManager.play('boss_spawn');
  SoundManager.play('boss_intro');
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
