/**
 * saveManager.test.js — Tests for save/load system.
 *
 * Tests createSaveData, saveGame, loadGame, applySaveData,
 * hasSave, deleteSave, getSaveInfo, autoSave, loadAutoSave.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSaveData,
  saveGame,
  loadGame,
  applySaveData,
  hasSave,
  deleteSave,
  getSaveInfo,
  autoSave,
  loadAutoSave,
} from '../engine/saveManager';
import { createTestState } from './helpers';
import { setupLocalStorageMock, clearLocalStorageMock } from './helpers';

beforeEach(() => {
  setupLocalStorageMock();
});

afterEach(() => {
  clearLocalStorageMock();
});

/* ──────────────────────────────────────────────
 * 1. createSaveData
 * ────────────────────────────────────────────── */
describe('createSaveData', () => {
  it('returns object with version 1', () => {
    const g = createTestState();
    const data = createSaveData(g);
    expect(data.version).toBe(1);
  });

  it('includes ISO timestamp', () => {
    const g = createTestState();
    const data = createSaveData(g);
    expect(data.timestamp).toBeDefined();
    expect(() => new Date(data.timestamp)).not.toThrow();
  });

  it('serializes player stats', () => {
    const g = createTestState();
    const data = createSaveData(g);
    expect(data.player).toEqual({
      hp: g.player.hp,
      maxHp: g.player.maxHp,
      shield: g.player.shield,
      maxShield: g.player.maxShield,
      speed: g.player.speed,
      magnetRadius: g.player.magnetRadius,
    });
  });

  it('serializes scrap and totalScrapEarned', () => {
    const g = createTestState({ scrap: 500, totalScrapEarned: 1200 });
    const data = createSaveData(g);
    expect(data.scrap).toBe(500);
    expect(data.totalScrapEarned).toBe(1200);
  });

  it('serializes level', () => {
    const g = createTestState({ level: 10 });
    const data = createSaveData(g);
    expect(data.level).toBe(10);
  });

  it('serializes levels (upgrades)', () => {
    const g = createTestState({ levels: { autocannon: 3, plasma: 2 } });
    const data = createSaveData(g);
    expect(data.levels).toEqual({ ...g.levels });
  });

  it('serializes map state', () => {
    const g = createTestState({ map: { nodes: [{ id: 1 }], edges: [] } });
    const data = createSaveData(g);
    expect(data.map).toEqual({ nodes: [{ id: 1 }], edges: [] });
  });

  it('serializes stats with defaults when not present', () => {
    const g = createTestState();
    g.stats = undefined;
    const data = createSaveData(g);
    expect(data.stats).toEqual({
      enemiesDestroyed: 0,
      totalScrap: 0,
      surviveMissions: 0,
      escortMissions: 0,
      defendMissions: 0,
      sabotageMissions: 0,
      bossesDefeated: 0,
      upgradesMaxed: 0,
    });
  });

  it('serializes existing stats', () => {
    const g = createTestState();
    g.stats = { enemiesDestroyed: 42, totalScrap: 5000 };
    const data = createSaveData(g);
    expect(data.stats).toEqual({ enemiesDestroyed: 42, totalScrap: 5000 });
  });

  it('converts achievements Set to array', () => {
    const g = createTestState();
    g.achievements = { unlocked: new Set(['first_blood', 'veteran']) };
    const data = createSaveData(g);
    expect(data.achievements).toEqual(['first_blood', 'veteran']);
  });

  it('empty achievements Set serializes as empty array', () => {
    const g = createTestState();
    g.achievements = { unlocked: new Set() };
    const data = createSaveData(g);
    expect(data.achievements).toEqual([]);
  });

  it('no achievements field defaults to empty array', () => {
    const g = createTestState();
    const data = createSaveData(g);
    expect(data.achievements).toEqual([]);
  });
});

/* ──────────────────────────────────────────────
 * 2. saveGame / loadGame roundtrip
 * ────────────────────────────────────────────── */
describe('saveGame and loadGame', () => {
  it('saveGame returns true on success', () => {
    const g = createTestState();
    const result = saveGame(g, 'main');
    expect(result).toBe(true);
  });

  it('saveGame stores data in localStorage', () => {
    const g = createTestState({ scrap: 999, level: 7 });
    saveGame(g, 'main');
    const raw = localStorage.getItem('space_sentinel_save');
    expect(raw).toBeDefined();
    const data = JSON.parse(raw);
    expect(data.scrap).toBe(999);
    expect(data.level).toBe(7);
  });

  it('loadGame returns true when save exists', () => {
    const g1 = createTestState({ scrap: 500, level: 5 });
    saveGame(g1, 'main');

    const g2 = createTestState();
    const result = loadGame(g2, 'main');
    expect(result).toBe(true);
  });

  it('loadGame restores scrap', () => {
    const g1 = createTestState({ scrap: 500 });
    saveGame(g1, 'main');

    const g2 = createTestState({ scrap: 0 });
    loadGame(g2, 'main');
    expect(g2.scrap).toBe(500);
  });

  it('loadGame restores level', () => {
    const g1 = createTestState({ level: 15 });
    saveGame(g1, 'main');

    const g2 = createTestState({ level: 1 });
    loadGame(g2, 'main');
    expect(g2.level).toBe(15);
  });

  it('loadGame restores player stats', () => {
    const g1 = createTestState({
      player: { hp: 200, maxHp: 350, shield: 50, maxShield: 60, speed: 150, magnetRadius: 200 },
    });
    saveGame(g1, 'main');

    const g2 = createTestState();
    loadGame(g2, 'main');
    expect(g2.player.hp).toBe(200);
    expect(g2.player.maxHp).toBe(350);
    expect(g2.player.shield).toBe(50);
    expect(g2.player.maxShield).toBe(60);
    expect(g2.player.speed).toBe(150);
    expect(g2.player.magnetRadius).toBe(200);
  });

  it('loadGame restores upgrades', () => {
    const g1 = createTestState({ levels: { autocannon: 5, plasma: 3 } });
    saveGame(g1, 'main');

    const g2 = createTestState();
    loadGame(g2, 'main');
    expect(g2.levels.autocannon).toBe(5);
    expect(g2.levels.plasma).toBe(3);
  });

  it('loadGame returns false when no save exists', () => {
    const g = createTestState();
    const result = loadGame(g, 'main');
    expect(result).toBe(false);
  });

  it('auto slot uses different key', () => {
    const g1 = createTestState({ scrap: 777 });
    saveGame(g1, 'auto');

    const raw = localStorage.getItem('space_sentinel_autosave');
    expect(raw).toBeDefined();
    const data = JSON.parse(raw);
    expect(data.scrap).toBe(777);
  });

  it('main and auto slots are independent', () => {
    const g1 = createTestState({ scrap: 100 });
    saveGame(g1, 'main');

    const g2 = createTestState({ scrap: 200 });
    saveGame(g2, 'auto');

    const g3 = createTestState({ scrap: 0 });
    loadGame(g3, 'main');
    expect(g3.scrap).toBe(100);

    const g4 = createTestState({ scrap: 0 });
    loadGame(g4, 'auto');
    expect(g4.scrap).toBe(200);
  });
});

/* ──────────────────────────────────────────────
 * 3. applySaveData
 * ────────────────────────────────────────────── */
describe('applySaveData', () => {
  it('applies player stats', () => {
    const g = createTestState();
    applySaveData(g, {
      player: { hp: 100, maxHp: 200, shield: 10, maxShield: 20, speed: 130, magnetRadius: 160 },
    });
    expect(g.player.hp).toBe(100);
    expect(g.player.maxHp).toBe(200);
  });

  it('skips player stats if not provided', () => {
    const g = createTestState({ player: { hp: 300 } });
    applySaveData(g, {});
    expect(g.player.hp).toBe(300);
  });

  it('applies scrap with fallback', () => {
    const g = createTestState({ scrap: 0 });
    applySaveData(g, { scrap: 500 });
    expect(g.scrap).toBe(500);
  });

  it('keeps existing scrap if not in data', () => {
    const g = createTestState({ scrap: 300 });
    applySaveData(g, {});
    expect(g.scrap).toBe(300);
  });

  it('merges upgrades into existing levels', () => {
    const g = createTestState({ levels: { autocannon: 1, plasma: 0, missiles: 0 } });
    applySaveData(g, { levels: { autocannon: 5, plasma: 3 } });
    expect(g.levels.autocannon).toBe(5);
    expect(g.levels.plasma).toBe(3);
    expect(g.levels.missiles).toBe(0); // preserved
  });

  it('restores map state', () => {
    const g = createTestState();
    applySaveData(g, { map: { nodes: [{ id: 1 }], edges: [] } });
    expect(g.map.nodes.length).toBe(1);
  });

  it('restores stats', () => {
    const g = createTestState();
    applySaveData(g, { stats: { enemiesDestroyed: 100 } });
    expect(g.stats.enemiesDestroyed).toBe(100);
  });

  it('restores achievements as Set', () => {
    const g = createTestState();
    applySaveData(g, { achievements: ['first_blood', 'veteran'] });
    expect(g.achievements.unlocked).toBeInstanceOf(Set);
    expect(g.achievements.unlocked.has('first_blood')).toBe(true);
    expect(g.achievements.unlocked.has('veteran')).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * 4. hasSave / deleteSave
 * ────────────────────────────────────────────── */
describe('hasSave and deleteSave', () => {
  it('hasSave returns false when no save', () => {
    expect(hasSave('main')).toBe(false);
  });

  it('hasSave returns true after save', () => {
    const g = createTestState();
    saveGame(g, 'main');
    expect(hasSave('main')).toBe(true);
  });

  it('deleteSave removes the save', () => {
    const g = createTestState();
    saveGame(g, 'main');
    expect(hasSave('main')).toBe(true);

    deleteSave('main');
    expect(hasSave('main')).toBe(false);
  });

  it('deleteSave does not affect other slots', () => {
    const g = createTestState();
    saveGame(g, 'main');
    saveGame(g, 'auto');

    deleteSave('main');
    expect(hasSave('main')).toBe(false);
    expect(hasSave('auto')).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * 5. getSaveInfo
 * ────────────────────────────────────────────── */
describe('getSaveInfo', () => {
  it('returns null when no save', () => {
    expect(getSaveInfo('main')).toBeNull();
  });

  it('returns partial info after save', () => {
    const g = createTestState({ scrap: 500, level: 10 });
    saveGame(g, 'main');

    const info = getSaveInfo('main');
    expect(info.level).toBe(10);
    expect(info.scrap).toBe(500);
    expect(info.timestamp).toBeDefined();
    expect(info.slot).toBe('main');
  });
});

/* ──────────────────────────────────────────────
 * 6. autoSave / loadAutoSave
 * ────────────────────────────────────────────── */
describe('autoSave and loadAutoSave', () => {
  it('autoSave saves to auto slot', () => {
    const g = createTestState({ scrap: 800 });
    autoSave(g);
    expect(hasSave('auto')).toBe(true);
  });

  it('loadAutoSave loads from auto slot', () => {
    const g1 = createTestState({ scrap: 800 });
    autoSave(g1);

    const g2 = createTestState({ scrap: 0 });
    const result = loadAutoSave(g2);
    expect(result).toBe(true);
    expect(g2.scrap).toBe(800);
  });

  it('loadAutoSave returns false when no auto save', () => {
    const g = createTestState();
    const result = loadAutoSave(g);
    expect(result).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 7. Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  it('loadGame handles corrupted JSON gracefully', () => {
    localStorage.setItem('space_sentinel_save', 'not valid json {{{');
    const g = createTestState();
    const result = loadGame(g, 'main');
    expect(result).toBe(false);
  });

  it('saveGame returns false on localStorage error', () => {
    // Simulate quota exceeded by making setItem throw
    const original = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('quota'); };
    const g = createTestState();
    const result = saveGame(g, 'main');
    expect(result).toBe(false);
    localStorage.setItem = original;
  });
});
