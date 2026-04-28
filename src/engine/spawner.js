/**
 * spawner.js — Enemy spawning & mission generation.
 * Pure functions; no React imports.
 */

/**
 * Generates a mission descriptor for a given level and node type.
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

  if (nodeType === 'elite') {
    t = 'kill_elite';
    target = 3 + Math.floor(level / 3);
    title = `Destroy ${target} Elite Enemies`;
    reward = 100 + level * 30;
    return { type: t, target, current: 0, title, reward };
  }

  const types = ['kill', 'survive', 'collect'];
  t = types[Math.floor(Math.random() * types.length)];
  if (level === 1) t = 'kill';
  if (level === 2) t = 'collect';

  if (t === 'kill') {
    target = 10 + level * 5;
    title = `Destroy ${target} Enemies`;
    reward = 50 + level * 20;
  } else   if (t === 'collect') {
    target = 15 + level * 3;
    title = `Collect ${target} Scrap`;
    reward = 80 + level * 25;
  } else {
    target = 20 + level * 10;
    title = `Survive for ${target} Seconds`;
    reward = 80 + level * 15;
  }

  return { type: t, target, current: 0, title, reward };
};

/**
 * Spawns a single enemy into g.enemies, positioned in a ring around the player.
 * @param {object} g - Live game state object
 */
export const spawnEnemy = (g) => {
  const spawnRadius = 900 + Math.random() * 400;
  const angle = Math.random() * Math.PI * 2;
  const x = g.player.x + Math.cos(angle) * spawnRadius;
  const y = g.player.y + Math.sin(angle) * spawnRadius;

  const diffMult = 0.5 + (g.level * 0.15) + Math.pow(g.level, 1.6) * 0.04 + g.totalTime / 100;

  // Scale enemy type rarity dynamically (more elites later in run)
  const eliteBonus = Math.min(0.4, g.level * 0.02 + g.totalTime / 2000);
  const typeRoll = Math.random() + eliteBonus;

  let type = 'fighter', hp = 30 * diffMult, speed = 100 + Math.random() * 50, radius = 15, color = 0xef4444;
  let shield = 0, maxShield = 0, fireCooldown = 0;

  if      (typeRoll > 0.95) { type = 'missile_boat'; hp = 60 * diffMult; speed = 30 + Math.random() * 20;  radius = 22; color = 0xd946ef; fireCooldown = 3.0; }
  else if (typeRoll > 0.85) { type = 'shielded';     hp = 40 * diffMult; speed = 50 + Math.random() * 30;  radius = 18; color = 0x3b82f6; maxShield = 80 * diffMult; shield = maxShield; }
  else if (typeRoll > 0.70) { type = 'shooter';      hp = 40 * diffMult; speed = 70 + Math.random() * 30;  radius = 16; color = 0xa855f7; fireCooldown = 1.5; }
  else if (typeRoll > 0.60) { type = 'heavy';        hp = 100 * diffMult; speed = 40 + Math.random() * 30; radius = 25; color = 0xf97316; }
  else if (typeRoll > 0.40) { type = 'interceptor';  hp = 15 * diffMult; speed = 180 + Math.random() * 50; radius = 12; color = 0xeab308; }

  g.enemies.push({ id: Math.random(), x, y, hp, maxHp: hp, shield, maxShield, speed, radius, color, type, active: true, fireCooldown });
};
