/**
 * saveManager.ts — Save/load system for persistent game progress.
 *
 * Saves game state to localStorage and provides save/load functionality.
 * Supports multiple save slots and auto-save on mission completion.
 */
import type { GameState, SectorState, EmergencyBeaconState } from './state';

const SAVE_KEY = 'space_sentinel_save';
const AUTO_SAVE_KEY = 'space_sentinel_autosave';
const SAVE_VERSION = 3;

interface SaveStats {
  enemiesDestroyed: number;
  totalScrap: number;
  surviveMissions: number;
  escortMissions: number;
  defendMissions: number;
  sabotageMissions: number;
  bossesDefeated: number;
  minibossesDefeated: number;
  upgradesMaxed: number;
}

/** Serializable save data structure. */
export interface SaveData {
  version: number;
  timestamp: string;
  player: {
    hp: number;
    maxHp: number;
    shield: number;
    maxShield: number;
    speed: number;
    magnetRadius: number;
  };
  scrap: number;
  totalScrapEarned: number;
  level: number;
  levels: Record<string, number>;
  map: unknown;
  stats: SaveStats;
  achievements: string[];
  shipSkin: number;
  unlockedSkins: boolean[] | undefined;
  sector: SectorState;
  relics: string[];
  relicSlotLimit: number;
  emergencyBeacon: EmergencyBeaconState;
}

type SaveSlot = 'main' | 'auto' | string;

/**
 * Create a save object from current game state.
 */
export function createSaveData(g: GameState): SaveData {
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
    stats: (g.stats as SaveStats) || {
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
 * @param slot - Save slot name ('main' or 'auto')
 */
export function saveGame(g: GameState, slot: SaveSlot = 'main'): boolean {
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
 * @param g - Game state to restore into
 * @param slot - Save slot name ('main' or 'auto')
 * @returns Whether load succeeded
 */
export function loadGame(g: GameState, slot: SaveSlot = 'main'): boolean {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const data = JSON.parse(raw) as Partial<SaveData>;
    applySaveData(g, data);
    return true;
  } catch {
    console.error('Failed to load game');
    return false;
  }
}

/**
 * Apply saved data to game state.
 */
export function applySaveData(g: GameState, data: Partial<SaveData>): void {
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
    g.map = data.map as GameState['map'];
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
 */
export function hasSave(slot: SaveSlot = 'main'): boolean {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  try {
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

/**
 * Delete a save.
 */
export function deleteSave(slot: SaveSlot = 'main'): void {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Lightweight save metadata returned by getSaveInfo. */
export interface SaveInfo {
  timestamp: string;
  level: number;
  scrap: number;
  slot: SaveSlot;
}

/**
 * Get save info (timestamp, level, etc.) without loading full state.
 */
export function getSaveInfo(slot: SaveSlot = 'main'): SaveInfo | null {
  const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      timestamp: data.timestamp as string,
      level: data.level as number,
      scrap: data.scrap as number,
      slot,
    };
  } catch {
    return null;
  }
}

/**
 * Auto-save on mission completion.
 */
export function autoSave(g: GameState): boolean {
  return saveGame(g, 'auto');
}

/**
 * Load auto-save if exists, otherwise return false.
 */
export function loadAutoSave(g: GameState): boolean {
  return loadGame(g, 'auto');
}

function normalizeSector(sector?: Partial<SectorState> | null, fallback: Partial<SectorState> = {}): SectorState {
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

function normalizeEmergencyBeacon(
  beacon?: Partial<EmergencyBeaconState> | null,
  fallback: Partial<EmergencyBeaconState> = {},
): EmergencyBeaconState {
  const source = beacon || {};
  return {
    purchased: source.purchased ?? fallback.purchased ?? false,
    activated: source.activated ?? fallback.activated ?? false,
    nodeId: source.nodeId ?? fallback.nodeId ?? null,
  };
}
