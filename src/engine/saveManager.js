/**
 * saveManager.js — Save/load system for persistent game progress.
 *
 * Saves game state to localStorage and provides save/load functionality.
 * Supports multiple save slots and auto-save on mission completion.
 */

const SAVE_KEY = 'space_sentinel_save';
const AUTO_SAVE_KEY = 'space_sentinel_autosave';

/**
 * Serializable save data structure.
 * @typedef {Object} SaveData
 * @property {number} version - Save format version
 * @property {string} timestamp - ISO timestamp
 * @property {Object} player - Player stats
 * @property {number} player.hp
 * @property {number} player.maxHp
 * @property {number} player.shield
 * @property {number} player.maxShield
 * @property {number} player.speed
 * @property {number} player.magnetRadius
 * @property {number} scrap - Current scrap
 * @property {number} totalScrapEarned - Lifetime scrap
 * @property {number} level - Player level
 * @property {Object} levels - Upgrade levels
 * @property {Object} map - Map state
 * @property {Object} stats - Persistent stats
 * @property {Set<string>} achievements - Unlocked achievement IDs
 */

/**
 * Create a save object from current game state.
 * @param {object} g - Game state
 * @returns {SaveData}
 */
export function createSaveData(g) {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    player: {
      hp: g.player.hp,
      maxHp: g.player.maxHp,
      shield: g.player.shield,
      maxShield: g.player.maxShield,
      speed: g.player.speed,
      magnetRadius: g.player.magnetRadius,
    },
    scrap: g.scrap,
    totalScrapEarned: g.totalScrapEarned,
    level: g.level,
    levels: { ...g.levels },
    map: g.map,
    stats: g.stats || {
      enemiesDestroyed: 0,
      totalScrap: 0,
      surviveMissions: 0,
      escortMissions: 0,
      defendMissions: 0,
      sabotageMissions: 0,
      bossesDefeated: 0,
      minibossesDefeated: 0,
      upgradesMaxed: 0,
    },
    achievements: g.achievements?.unlocked ? [...g.achievements.unlocked] : [],
  };
}

/**
 * Save game state to localStorage.
 * @param {object} g - Game state
 * @param {string} slot - Save slot name ('main' or 'auto')
 */
export function saveGame(g, slot = 'main') {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  const data = createSaveData(g);
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    console.error('Failed to save game');
    return false;
  }
}

/**
 * Load game state from localStorage.
 * @param {object} g - Game state to restore into
 * @param {string} slot - Save slot name ('main' or 'auto')
 * @returns {boolean} Whether load succeeded
 */
export function loadGame(g, slot = 'main') {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    applySaveData(g, data);
    return true;
  } catch {
    console.error('Failed to load game');
    return false;
  }
}

/**
 * Apply saved data to game state.
 * @param {object} g - Game state
 * @param {SaveData} data - Saved data
 */
export function applySaveData(g, data) {
  // Player stats
  if (data.player) {
    g.player.hp = data.player.hp;
    g.player.maxHp = data.player.maxHp;
    g.player.shield = data.player.shield;
    g.player.maxShield = data.player.maxShield;
    g.player.speed = data.player.speed;
    g.player.magnetRadius = data.player.magnetRadius;
  }

  // Currency and progress
  g.scrap = data.scrap ?? g.scrap;
  g.totalScrapEarned = data.totalScrapEarned ?? g.totalScrapEarned;
  g.level = data.level ?? g.level;

  // Upgrades
  if (data.levels) {
    g.levels = { ...g.levels, ...data.levels };
  }

  // Map state
  if (data.map) {
    g.map = data.map;
  }

  // Stats
  if (data.stats) {
    g.stats = data.stats;
  }

  // Achievements
  if (data.achievements) {
    g.achievements = g.achievements || { unlocked: new Set(), notifications: [] };
    g.achievements.unlocked = new Set(data.achievements);
  }
}

/**
 * Check if a save exists.
 * @param {string} slot - Save slot name
 * @returns {boolean}
 */
export function hasSave(slot = 'main') {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  try {
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

/**
 * Delete a save.
 * @param {string} slot - Save slot name
 */
export function deleteSave(slot = 'main') {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Get save info (timestamp, level, etc.) without loading full state.
 * @param {string} slot - Save slot name
 * @returns {object|null}
 */
export function getSaveInfo(slot = 'main') {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      timestamp: data.timestamp,
      level: data.level,
      scrap: data.scrap,
      slot,
    };
  } catch {
    return null;
  }
}

/**
 * Auto-save on mission completion.
 * @param {object} g - Game state
 */
export function autoSave(g) {
  saveGame(g, 'auto');
}

/**
 * Load auto-save if exists, otherwise return false.
 * @param {object} g - Game state
 * @returns {boolean}
 */
export function loadAutoSave(g) {
  return loadGame(g, 'auto');
}
