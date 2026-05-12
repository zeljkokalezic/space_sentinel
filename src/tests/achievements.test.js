/**
 * Unit tests for achievement system.
 *
 * Tests achievement checking, progress tracking, and persistence.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ACHIEVEMENTS,
  checkAchievements,
  getAchievement,
  getAchievementProgress,
  loadAchievements,
  saveAchievements,
} from '../engine/achievements';

// Mock localStorage
const mockStorage = {};
vi.stubGlobal('localStorage', {
  getItem: (key) => mockStorage[key] ?? null,
  setItem: (key, value) => { mockStorage[key] = value; },
  removeItem: (key) => { delete mockStorage[key]; },
});

describe('achievements', () => {
  beforeEach(() => {
    mockStorage['space_sentinel_achievements'] = '[]';
  });

  describe('loadAchievements', () => {
    it('returns empty set when nothing saved', () => {
      mockStorage['space_sentinel_achievements'] = '[]';
      const result = loadAchievements();
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('loads saved achievements', () => {
      mockStorage['space_sentinel_achievements'] = JSON.stringify(['first_blood', 'veteran']);
      const result = loadAchievements();
      expect(result.has('first_blood')).toBe(true);
      expect(result.has('veteran')).toBe(true);
      expect(result.has('scavenger')).toBe(false);
    });

    it('handles missing localStorage gracefully', () => {
      delete mockStorage['space_sentinel_achievements'];
      const result = loadAchievements();
      expect(result.size).toBe(0);
    });
  });

  describe('saveAchievements', () => {
    it('saves achievements to localStorage', () => {
      const set = new Set(['first_blood', 'scavenger']);
      saveAchievements(set);
      const stored = JSON.parse(mockStorage['space_sentinel_achievements']);
      expect(stored).toContain('first_blood');
      expect(stored).toContain('scavenger');
    });
  });

  describe('checkAchievements', () => {
    it('returns empty when no achievements met', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 0,
        totalScrap: 0,
        surviveMissions: 0,
        escortMissions: 0,
        defendMissions: 0,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 1,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toHaveLength(0);
    });

    it('unlocks first_blood when 1 enemy destroyed', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 1,
        totalScrap: 0,
        surviveMissions: 0,
        escortMissions: 0,
        defendMissions: 0,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 1,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('first_blood');
    });

    it('unlocks veteran at 100 enemies', () => {
      const unlocked = new Set(['first_blood']);
      const stats = {
        enemiesDestroyed: 100,
        totalScrap: 500,
        surviveMissions: 0,
        escortMissions: 0,
        defendMissions: 0,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 5,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('veteran');
    });

    it('unlocks scavenger at 1000 scrap', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 50,
        totalScrap: 1000,
        surviveMissions: 0,
        escortMissions: 0,
        defendMissions: 0,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 3,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('scavenger');
    });

    it('unlocks survivor on survive mission complete', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 10,
        totalScrap: 200,
        surviveMissions: 1,
        escortMissions: 0,
        defendMissions: 0,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 3,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('survivor');
    });

    it('unlocks escort_expert at 5 escort missions', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 50,
        totalScrap: 500,
        surviveMissions: 2,
        escortMissions: 5,
        defendMissions: 0,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 10,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('escort_expert');
    });

    it('unlocks defender on defend mission complete', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 20,
        totalScrap: 300,
        surviveMissions: 0,
        escortMissions: 0,
        defendMissions: 1,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 4,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('defender');
    });

    it('unlocks saboteur on sabotage mission complete', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 15,
        totalScrap: 250,
        surviveMissions: 0,
        escortMissions: 0,
        defendMissions: 0,
        sabotageMissions: 1,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 3,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('saboteur');
    });

    it('unlocks boss_slayer on boss defeat', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 200,
        totalScrap: 2000,
        surviveMissions: 3,
        escortMissions: 5,
        defendMissions: 2,
        sabotageMissions: 1,
        bossesDefeated: 1,
        upgradesMaxed: 0,
        level: 15,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('boss_slayer');
    });

    it('unlocks level_10 at level 10', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 100,
        totalScrap: 1500,
        surviveMissions: 2,
        escortMissions: 3,
        defendMissions: 1,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 10,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('level_10');
    });

    it('unlocks level_25 at level 25', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 300,
        totalScrap: 5000,
        surviveMissions: 5,
        escortMissions: 8,
        defendMissions: 3,
        sabotageMissions: 2,
        bossesDefeated: 1,
        upgradesMaxed: 0,
        level: 25,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('level_25');
    });

    it('unlocks upgrade_master when all 9 upgrades maxed', () => {
      const unlocked = new Set();
      const stats = {
        enemiesDestroyed: 500,
        totalScrap: 10000,
        surviveMissions: 5,
        escortMissions: 10,
        defendMissions: 5,
        sabotageMissions: 3,
        bossesDefeated: 2,
        upgradesMaxed: 9,
        level: 30,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).toContain('upgrade_master');
    });

    it('does not re-unlock already unlocked achievements', () => {
      const unlocked = new Set(['first_blood', 'veteran']);
      const stats = {
        enemiesDestroyed: 500,
        totalScrap: 10000,
        surviveMissions: 5,
        escortMissions: 10,
        defendMissions: 5,
        sabotageMissions: 3,
        bossesDefeated: 2,
        upgradesMaxed: 9,
        level: 30,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.newlyUnlocked).not.toContain('first_blood');
      expect(result.newlyUnlocked).not.toContain('veteran');
    });

    it('returns progress for all achievements', () => {
      const unlocked = new Set(['first_blood']);
      const stats = {
        enemiesDestroyed: 50,
        totalScrap: 500,
        surviveMissions: 1,
        escortMissions: 2,
        defendMissions: 0,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 5,
      };
      const result = checkAchievements(unlocked, stats);
      expect(result.progress.length).toBeGreaterThan(0);
      // Check some progress values
      const veteranProgress = result.progress.find(p => p.id === 'veteran');
      expect(veteranProgress.progress).toBe(0.5); // 50/100
      expect(veteranProgress.unlocked).toBe(false);
    });
  });

  describe('getAchievement', () => {
    it('returns achievement by id', () => {
      const achievement = getAchievement('first_blood');
      expect(achievement).not.toBeNull();
      expect(achievement.title).toBe('First Blood');
    });

    it('returns null for unknown id', () => {
      const achievement = getAchievement('nonexistent');
      expect(achievement).toBeNull();
    });
  });

  describe('getAchievementProgress', () => {
    it('returns progress for all achievements', () => {
      const unlocked = new Set(['first_blood']);
      const stats = {
        enemiesDestroyed: 50,
        totalScrap: 500,
        surviveMissions: 1,
        escortMissions: 2,
        defendMissions: 0,
        sabotageMissions: 0,
        bossesDefeated: 0,
        upgradesMaxed: 0,
        level: 5,
      };
      const progress = getAchievementProgress(unlocked, stats);
      expect(progress.length).toBe(ACHIEVEMENTS.length);
      expect(progress[0].unlocked).toBe(true); // first_blood is unlocked
    });
  });

  describe('ACHIEVEMENTS definitions', () => {
    it('has all expected achievements', () => {
      const ids = ACHIEVEMENTS.map(a => a.id);
      expect(ids).toContain('first_blood');
      expect(ids).toContain('veteran');
      expect(ids).toContain('slayer');
      expect(ids).toContain('scavenger');
      expect(ids).toContain('millionaire');
      expect(ids).toContain('survivor');
      expect(ids).toContain('escort_expert');
      expect(ids).toContain('defender');
      expect(ids).toContain('saboteur');
      expect(ids).toContain('boss_slayer');
      expect(ids).toContain('level_10');
      expect(ids).toContain('level_25');
      expect(ids).toContain('upgrade_master');
    });

    it('each achievement has required fields', () => {
      for (const a of ACHIEVEMENTS) {
        expect(a.id).toBeDefined();
        expect(a.title).toBeDefined();
        expect(a.description).toBeDefined();
        expect(a.icon).toBeDefined();
        expect(typeof a.check).toBe('function');
        expect(typeof a.progress).toBe('function');
      }
    });
  });
});
