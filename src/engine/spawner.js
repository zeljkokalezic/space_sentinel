/**
 * spawner.js — Enemy and mission generation.
 * Pure functions; no React imports.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { calculateDifficultyMultiplier } from './difficulty';
import { SoundManager } from './audio';

/**
 * Wave pattern definitions for structured enemy spawning.
 */
const WAVE_PATTERNS = {
  // Standard random spawn
  random: {
    count: 1,
    interval: 1.0,
  },
  // Burst: spawn multiple enemies at once
  burst: {
    count: 3,
    interval: 3.0,
  },
  // Circle: spawn enemies in a circle formation
  circle: {
    count: 5,
    interval: 4.0,
    formation: 'circle',
  },
  // V-formation: spawn enemies in a V pattern
  vFormation: {
    count: 4,
    interval: 3.5,
    formation: 'v',
  },
  // Swarm: spawn many fast enemies
  swarm: {
    count: 6,
    interval: 5.0,
    enemyType: 'interceptor',
  },
};

/**
 * Get the current wave pattern based on game time and level.
 * @param {number} level - Current level
 * @param {number} totalTime - Total mission time
 * @returns {string} Wave pattern name
 */
function getWavePattern(level, totalTime) {
  // Early game: mostly random
  if (totalTime < 30) return 'random';

  // Mid game: introduce patterns
  if (totalTime < 90) {
    const patterns = ['random', 'burst', 'circle'];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  // Late game: all patterns
  const patterns = ['random', 'burst', 'circle', 'vFormation', 'swarm'];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

/**
 * Spawn enemies in a specific pattern.
 * @param {object} g - Game state
 * @param {string} pattern - Wave pattern name
 * @param {number} level - Current level
 */
function spawnWavePattern(g, pattern) {
  const waveConfig = WAVE_PATTERNS[pattern] || WAVE_PATTERNS.random;
  const C = GAME_CONFIG;
  const diffMult = calculateDifficultyMultiplier(g.level, g.totalTime);

  for (let i = 0; i < waveConfig.count; i++) {
    let x, y;

    if (waveConfig.formation === 'circle') {
      // Circle formation
      const angle = (i / waveConfig.count) * Math.PI * 2;
      const radius = C.enemies.spawnRadiusMin + (C.enemies.spawnRadiusMax - C.enemies.spawnRadiusMin) / 2;
      x = g.player.x + Math.cos(angle) * radius;
      y = g.player.y + Math.sin(angle) * radius;
    } else if (waveConfig.formation === 'v') {
      // V formation
      const baseAngle = Math.random() * Math.PI * 2;
      const spread = 0.3;
      const angle = baseAngle + (i - waveConfig.count / 2) * spread;
      const radius = C.enemies.spawnRadiusMin + i * 30;
      x = g.player.x + Math.cos(angle) * radius;
      y = g.player.y + Math.sin(angle) * radius;
    } else {
      // Random spawn
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = C.enemies.spawnRadiusMin + Math.random() * (C.enemies.spawnRadiusMax - C.enemies.spawnRadiusMin);
      x = g.player.x + Math.cos(angle) * spawnRadius;
      y = g.player.y + Math.sin(angle) * spawnRadius;
    }

    // Determine enemy type
    const eliteBonus = Math.min(C.enemies.eliteBonusMax, g.level * C.enemies.eliteBonusBase + g.totalTime * C.enemies.eliteBonusTimeFactor);
    const typeRoll = Math.random() + eliteBonus;

    let type, hp, speed, radius, color, shield, maxShield, fireCooldown;

    if (waveConfig.enemyType) {
      // Forced type for swarm
      type = waveConfig.enemyType;
      hp = 15 * diffMult;
      speed = 180 + Math.random() * 50;
      radius = 12;
      color = 0xeab308;
      shield = 0;
      maxShield = 0;
      fireCooldown = 0;
    } else if (typeRoll > 0.95) {
      type = 'missile_boat'; hp = 60 * diffMult; speed = 30 + Math.random() * 20;  radius = 22; color = 0xd946ef; fireCooldown = 3.0; shield = 0; maxShield = 0;
    } else if (typeRoll > 0.85) {
      type = 'shielded';     hp = 40 * diffMult; speed = 50 + Math.random() * 30;  radius = 18; color = 0x3b82f6; maxShield = 80 * diffMult; shield = maxShield; fireCooldown = 0;
    } else if (typeRoll > 0.70) {
      type = 'shooter';      hp = 40 * diffMult; speed = 70 + Math.random() * 30;  radius = 16; color = 0xa855f7; fireCooldown = 1.5; shield = 0; maxShield = 0;
    } else if (typeRoll > 0.60) {
      type = 'heavy';        hp = 100 * diffMult; speed = 40 + Math.random() * 30; radius = 25; color = 0xf97316; fireCooldown = 0; shield = 0; maxShield = 0;
    } else if (typeRoll > 0.40) {
      type = 'interceptor';  hp = 15 * diffMult; speed = 180 + Math.random() * 50; radius = 12; color = 0xeab308; fireCooldown = 0; shield = 0; maxShield = 0;
    } else {
      type = 'fighter';      hp = 30 * diffMult; speed = 100 + Math.random() * 50; radius = 15; color = 0xef4444; fireCooldown = 0; shield = 0; maxShield = 0;
    }

    g.enemies.push({ id: Math.random(), x, y, hp, maxHp: hp, shield, maxShield, speed, radius, color, type, active: true, fireCooldown });
  }
}

/**
 * Generate a mission descriptor.
 * @param {number} level    - Current player level
 * @param {string} nodeType - 'boss' | 'elite' | 'kill' | 'collect' | 'survive'
 * @returns {{ type, target, current, title, reward }}
 */
export const generateMission = (level, nodeType) => {
  let t = 'kill';
  let target, title, reward;

  if (nodeType === 'boss') {
    t = 'kill_boss';
    target = 1;
    title = `Destroy the Sentinel Core`;
    reward = 500;
    return { type: t, target, current: 0, title, reward };
  }

  if (nodeType === 'miniboss') {
    t = 'kill_miniboss';
    target = 1;
    title = `Destroy the Mini-Boss`;
    reward = GAME_CONFIG.miniboss.scrapReward + level * 20;
    return { type: t, target, current: 0, title, reward };
  }

  if (nodeType === 'elite') {
    t = 'kill_elite';
    target = 3 + Math.floor(level / 3);
    title = `Destroy ${target} Elite Enemies`;
    reward = 100 + level * 30;
    return { type: t, target, current: 0, title, reward };
  }

  // If nodeType explicitly specifies a mission type, use it directly.
  // Only randomise when nodeType is 'combat' (normal map generation).
  if (['kill', 'collect', 'survive', 'escort', 'defend', 'sabotage'].includes(nodeType)) {
    t = nodeType;
  } else {
    const types = ['kill', 'survive', 'collect', 'escort', 'defend', 'sabotage'];
    t = types[Math.floor(Math.random() * types.length)];
    if (level === 1) t = 'kill';
    if (level === 2) t = 'collect';
  }

  if (t === 'kill') {
    target = 10 + level * 5;
    title = `Destroy ${target} Enemies`;
    reward = 50 + level * 20;
  } else if (t === 'collect') {
    target = 15 + level * 3;
    title = `Collect ${target} Scrap`;
    reward = 80 + level * 25;
  } else if (t === 'survive') {
    target = 20 + level * 10;
    title = `Survive for ${target} Seconds`;
    reward = 80 + level * 15;
  } else if (t === 'defend') {
    target = 30 + level * 10;
    title = `Defend the Beacon for ${target} Seconds`;
    reward = 100 + level * 30;
    return { type: t, target, current: 0, title, reward };
  } else if (t === 'sabotage') {
    const cfg = GAME_CONFIG.sabotage;
    target = Math.min(cfg.maxStructures, cfg.baseStructures + Math.floor(level / 2) * cfg.structuresPer2Levels);
    title = `Destroy ${target} Enemy Structures`;
    reward = 120 + level * 35;
    return { type: t, target, current: 0, title, reward };
  } else {
    // Escort mission — protect a drone as it travels to a destination
    title = 'Escort the Drone to Safety';
    reward = 120 + level * 35;
    target = 0; // Distance-based, not a fixed number
    return { type: t, target, current: 0, title, reward };
  }

  return { type: t, target, current: 0, title, reward };
};

/**
 * Spawns enemies using wave patterns based on game time.
 * Tracks cumulative enemies spawned and triggers wave announcements.
 * @param {object} g - Live game state object
 */
export function spawnEnemy(g) {
  // Skip spawning if wave announcement is active
  if (g.waveAnnounce && g.waveAnnounce.active) return;

  const pattern = getWavePattern(g.level, g.totalTime);
  spawnWavePattern(g, pattern);

  // Track wave progress (only if waveAnnounce state exists)
  if (g.waveAnnounce) {
    const waveConfig = WAVE_PATTERNS[pattern] || WAVE_PATTERNS.random;
    g.enemiesSpawnedThisWave += waveConfig.count;

    // Check if wave threshold reached
    const enemiesPerWave = GAME_CONFIG.waveAnnouncer.enemiesPerWave;
    if (g.enemiesSpawnedThisWave >= enemiesPerWave) {
      g.waveCount++;
      g.enemiesSpawnedThisWave = 0;

      // Skip announcement for first wave (waveCount === 1)
      if (g.waveCount > 1) {
        g.waveAnnounce.active = true;
        g.waveAnnounce.wave = g.waveCount;
        g.waveAnnounce.timer = GAME_CONFIG.waveAnnouncer.announcementDuration;
        SoundManager.play('wave_announce');
      }
    }
  }
};

/**
 * Export wave patterns for testing.
 */
export { WAVE_PATTERNS, getWavePattern, spawnWavePattern };
