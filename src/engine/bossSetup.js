/**
 * bossSetup.js — Boss fight initialization and cleanup.
 *
 * Selects a boss variant from BOSS_ROSTER based on level,
 * spreads variant properties onto g.boss, and triggers intro effects.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { BOSS_ROSTER } from '../constants/bosses';
import { createParticles } from './combat';
import { SoundManager } from './audio';

/**
 * Initialize a boss fight.
 * @param {object} g — Game state
 * @param {number} level — Current player level
 */
export const setupBoss = (g, level) => {
  const C = GAME_CONFIG;

  // Select boss variant (dev override or deterministic by level, cycles through roster)
  const variantIdx = g.devVariantIndex != null ? g.devVariantIndex : level % BOSS_ROSTER.length;
  const variant = BOSS_ROSTER[variantIdx];

  const bossHp = variant.baseHp + level * variant.hpPerLevel;
  const spawnDist = 1200;
  const angle = Math.random() * Math.PI * 2;

  g.boss = {
    ...g.boss,
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
    hp: bossHp,
    maxHp: bossHp,
    phase: 1,
    attackTimer: 2, // Initial delay before first attack
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

  // Stop regular enemy spawning during boss fight
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

  // Visual effect for boss spawn
  createParticles(g, g.boss.x, g.boss.y, variant.color || 0xdc2626, 30);

  // Audio
  SoundManager.play('boss_spawn');
  SoundManager.play('boss_intro');
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
