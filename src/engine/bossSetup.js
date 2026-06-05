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
import { spawnEffect } from './pool';

/**
 * Shared boss/miniboss setup logic.
 * @param {object} g — Game state
 * @param {number} level — Current level
 * @param {Array} roster — Boss or miniboss roster
 * @param {object} config — { stateKey, spawnDist, hpCalc, defaultColor }
 * @returns {object} The created boss/miniboss state
 */
export const setupBossCore = (g, level, roster, config) => {
  const C = GAME_CONFIG;
  const variantIdx = g.devVariantIndex != null ? g.devVariantIndex : level % roster.length;
  const variant = roster[variantIdx];
  const { hp, radius, speed } = config.hpCalc(variant, level, C);
  const angle = Math.random() * Math.PI * 2;

  const state = {
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
    x: g.player.x + Math.cos(angle) * config.spawnDist,
    y: g.player.y + Math.sin(angle) * config.spawnDist,
    hp,
    maxHp: hp,
    phase: 1,
    attackTimer: 2,
    chargeTimer: C.boss.chargeCooldown,
    chargeTarget: { x: 0, y: 0 },
    isCharging: false,
    radius,
    speed,
    fireCooldown: C.boss.fireCooldown,
    spiralAngle: 0,
    shield: 0,
    maxShield: 0,
  };

  g[config.stateKey] = { ...g[config.stateKey], ...state };
  g.spawnCooldown = 999;

  // Intro announcement
  spawnEffect(g, { type: 'boss_intro', text: variant.introText, life: 2.5, big: false });
  spawnEffect(g, { type: 'boss_intro', text: variant.name, life: 2.5, big: true });

  // Visual + audio
  createParticles(g, state.x, state.y, variant.color || config.defaultColor, 30);
  SoundManager.play('boss_spawn');
  SoundManager.play('boss_intro');

  return g[config.stateKey];
};

/**
 * Initialize a boss fight.
 * @param {object} g — Game state
 * @param {number} level — Current player level
 */
export const setupBoss = (g, level) => {
  setupBossCore(g, level, BOSS_ROSTER, {
    stateKey: 'boss',
    spawnDist: GAME_CONFIG.boss.spawnDistance,
    defaultColor: 0xdc2626,
    hpCalc: (variant, level) => ({
      hp: variant.baseHp + level * variant.hpPerLevel,
      radius: variant.radius,
      speed: variant.speed + level * variant.speedPerLevel,
    }),
  });
};

/**
 * Reset boss state.
 * @param {object} g — Game state
 */
export const resetBoss = (g) => {
  g.boss = {
    active: false, x: 0, y: 0, hp: 0, maxHp: 0,
    phase: 1, attackTimer: 0, chargeTimer: 0,
    chargeTarget: { x: 0, y: 0 }, isCharging: false,
    radius: 60, speed: 60, fireCooldown: 1.5, spiralAngle: 0,
  };
};
