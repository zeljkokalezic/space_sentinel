/**
 * saveManager.js — Save/load system for persistent game progress.
 *
 * Saves game state to localStorage and provides save/load functionality.
 * Supports multiple save slots and auto-save on mission completion.
 */

const SAVE_KEY = 'space_sentinel_save';
const AUTO_SAVE_KEY = 'space_sentinel_autosave';
const SAVE_VERSION = 3;

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
 * @property {number} shipSkin - Active ship skin index
 * @property {boolean[]} unlockedSkins - Purchased ship skins
 * @property {Object} sector - Persistent sector progression
 * @property {string[]} relics - Collected relic IDs
 * @property {number} relicSlotLimit - Maximum relic slots
 * @property {Object} emergencyBeacon - One-use respawn beacon state
 */

/**
 * Create a save object from current game state.
 * @param {object} g - Game state
 * @returns {SaveData}
 */
export function createSaveData(g) {
  return {
    version: SAVE_VERSION,
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
    shipSkin: g.shipSkin ?? 0,
    unlockedSkins: Array.isArray(g.unlockedSkins) ? [...g.unlockedSkins] : undefined,
    sector: normalizeSector(g.sector),
    relics: Array.isArray(g.relics) ? [...g.relics] : [],
    relicSlotLimit: typeof g.relicSlotLimit === 'number' ? g.relicSlotLimit : 5,
    emergencyBeacon: normalizeEmergencyBeacon(g.emergencyBeacon),
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

  if (data.sector) {
    g.sector = normalizeSector(data.sector, g.sector);
  }

  if (Array.isArray(data.relics)) {
    g.relics = [...data.relics];
  }

  if (typeof data.relicSlotLimit === 'number') {
    g.relicSlotLimit = data.relicSlotLimit;
  }

  if (data.emergencyBeacon) {
    g.emergencyBeacon = normalizeEmergencyBeacon(data.emergencyBeacon, g.emergencyBeacon);
  }

  // Achievements
  if (data.achievements) {
    g.achievements = g.achievements || { unlocked: new Set(), notifications: [] };
    g.achievements.unlocked = new Set(data.achievements);
  }

  if (typeof data.shipSkin === 'number') {
    g.shipSkin = data.shipSkin;
  }

  if (Array.isArray(data.unlockedSkins)) {
    g.unlockedSkins = [...data.unlockedSkins];
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

function normalizeSector(sector, fallback = {}) {
  const source = sector || {};
  return {
    number: source.number ?? fallback.number ?? 1,
    rank: source.rank ?? fallback.rank ?? null,
    rankScore: source.rankScore ?? fallback.rankScore ?? 0,
    consecutiveARank: source.consecutiveARank ?? fallback.consecutiveARank ?? 0,
    veteranMode: source.veteranMode ?? fallback.veteranMode ?? false,
    activeBuff: source.activeBuff ?? fallback.activeBuff ?? null,
    missionsCleared: source.missionsCleared ?? fallback.missionsCleared ?? 0,
    missionsCompleted: source.missionsCompleted ?? fallback.missionsCompleted ?? 0,
    totalHpPercent: source.totalHpPercent ?? fallback.totalHpPercent ?? 0,
    missionStartTime: Array.isArray(source.missionStartTime)
      ? [...source.missionStartTime]
      : (Array.isArray(fallback.missionStartTime) ? [...fallback.missionStartTime] : []),
    missionEndTime: Array.isArray(source.missionEndTime)
      ? [...source.missionEndTime]
      : (Array.isArray(fallback.missionEndTime) ? [...fallback.missionEndTime] : []),
  };
}

function normalizeEmergencyBeacon(beacon, fallback = {}) {
  const source = beacon || {};
  return {
    purchased: source.purchased ?? fallback.purchased ?? false,
    activated: source.activated ?? fallback.activated ?? false,
    nodeId: source.nodeId ?? fallback.nodeId ?? null,
  };
}
