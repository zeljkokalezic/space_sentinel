/**
 * Unit tests for AchievementPanel data flow.
 *
 * Tests the buildStats helper and filter logic that the panel relies on.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ACHIEVEMENTS,
  getAchievementProgress,
} from '../engine/achievements';

// Mock localStorage
const mockStorage = {};
vi.stubGlobal('localStorage', {
  getItem: (key) => mockStorage[key] ?? null,
  setItem: (key, value) => { mockStorage[key] = value; },
  removeItem: (key) => { delete mockStorage[key]; },
});

/**
 * Replicate the buildStats helper from AchievementPanel.jsx
 * so we can test it in isolation.
 */
function buildStats(g) {
  const s = g?.stats || {};
  return {
    enemiesDestroyed: s.enemiesDestroyed || 0,
    totalScrap: s.totalScrap || 0,
    surviveMissions: s.surviveMissions || 0,
    escortMissions: s.escortMissions || 0,
    defendMissions: s.defendMissions || 0,
    sabotageMissions: s.sabotageMissions || 0,
    bossesDefeated: s.bossesDefeated || 0,
    minibossesDefeated: s.minibossesDefeated || 0,
    upgradesMaxed: s.upgradesMaxed || 0,
    level: g?.level || 1,
  };
}

describe('achievementPanel', () => {
  beforeEach(() => {
    mockStorage['space_sentinel_achievements'] = '[]';
  });

  describe('buildStats', () => {
    it('returns all zeros for undefined game state', () => {
      const stats = buildStats(undefined);
      expect(stats.enemiesDestroyed).toBe(0);
      expect(stats.totalScrap).toBe(0);
      expect(stats.level).toBe(1);
    });

    it('returns all zeros for game state without stats', () => {
      const g = { level: 5 };
      const stats = buildStats(g);
      expect(stats.enemiesDestroyed).toBe(0);
      expect(stats.level).toBe(5);
    });

    it('returns partial stats correctly', () => {
      const g = {
        level: 10,
        stats: {
          enemiesDestroyed: 50,
          totalScrap: 500,
          bossesDefeated: 1,
        },
      };
      const stats = buildStats(g);
      expect(stats.enemiesDestroyed).toBe(50);
      expect(stats.totalScrap).toBe(500);
      expect(stats.bossesDefeated).toBe(1);
      expect(stats.surviveMissions).toBe(0); // missing field defaults to 0
      expect(stats.level).toBe(10);
    });

    it('returns full stats correctly', () => {
      const g = {
        level: 20,
        stats: {
          enemiesDestroyed: 300,
          totalScrap: 5000,
          surviveMissions: 5,
          escortMissions: 8,
          defendMissions: 3,
          sabotageMissions: 2,
          bossesDefeated: 2,
          minibossesDefeated: 4,
          upgradesMaxed: 5,
        },
      };
      const stats = buildStats(g);
      expect(stats).toEqual({
        enemiesDestroyed: 300,
        totalScrap: 5000,
        surviveMissions: 5,
        escortMissions: 8,
        defendMissions: 3,
        sabotageMissions: 2,
        bossesDefeated: 2,
        minibossesDefeated: 4,
        upgradesMaxed: 5,
        level: 20,
      });
    });
  });

  describe('getAchievementProgress for panel', () => {
    it('returns progress for all achievements with empty stats', () => {
      const unlocked = new Set();
      const stats = buildStats(undefined);
      const progress = getAchievementProgress(unlocked, stats);
      expect(progress.length).toBe(ACHIEVEMENTS.length);
      // All should be locked (0 progress) except level-based ones
      const level10 = progress.find(p => p.id === 'level_10');
      expect(level10.progress).toBe(0.1); // level 1 / 10
      expect(level10.unlocked).toBe(false);
    });

    it('shows correct unlocked count', () => {
      const unlocked = new Set(['first_blood', 'veteran', 'survivor']);
      const stats = buildStats({
        level: 5,
        stats: {
          enemiesDestroyed: 150,
          totalScrap: 1200,
          surviveMissions: 1,
          escortMissions: 0,
          defendMissions: 0,
          sabotageMissions: 0,
          bossesDefeated: 0,
          upgradesMaxed: 0,
        },
      });
      const progress = getAchievementProgress(unlocked, stats);
      const unlockedCount = progress.filter(p => p.unlocked).length;
      expect(unlockedCount).toBe(3);
    });

    it('filter: in_progress returns partial achievements', () => {
      const unlocked = new Set(['first_blood']);
      const stats = buildStats({
        level: 5,
        stats: {
          enemiesDestroyed: 50,
          totalScrap: 500,
          surviveMissions: 0,
          escortMissions: 0,
          defendMissions: 0,
          sabotageMissions: 0,
          bossesDefeated: 0,
          upgradesMaxed: 0,
        },
      });
      const progress = getAchievementProgress(unlocked, stats);
      const inProgress = progress.filter(p => !p.unlocked && p.progress > 0);
      expect(inProgress.length).toBeGreaterThan(0);
      // veteran should be in progress (50/100)
      expect(inProgress.find(p => p.id === 'veteran')).toBeDefined();
    });

    it('filter: locked returns zero-progress achievements', () => {
      const unlocked = new Set();
      const stats = buildStats({
        level: 1,
        stats: {
          enemiesDestroyed: 0,
          totalScrap: 0,
          surviveMissions: 0,
          escortMissions: 0,
          defendMissions: 0,
          sabotageMissions: 0,
          bossesDefeated: 0,
          upgradesMaxed: 0,
        },
      });
      const progress = getAchievementProgress(unlocked, stats);
      const locked = progress.filter(p => !p.unlocked && p.progress === 0);
      expect(locked.length).toBeGreaterThan(0);
      // scavenger should be locked (0 scrap)
      expect(locked.find(p => p.id === 'scavenger')).toBeDefined();
    });

    it('percentage calculation matches expected values', () => {
      const unlocked = new Set();
      const stats = buildStats({
        level: 7,
        stats: {
          enemiesDestroyed: 250,
          totalScrap: 3000,
          surviveMissions: 0,
          escortMissions: 3,
          defendMissions: 0,
          sabotageMissions: 0,
          bossesDefeated: 0,
          upgradesMaxed: 0,
        },
      });
      const progress = getAchievementProgress(unlocked, stats);

      const veteran = progress.find(p => p.id === 'veteran');
      expect(Math.round(veteran.progress * 100)).toBe(100); // 250/100 capped at 1

      const scavenger = progress.find(p => p.id === 'scavenger');
      expect(Math.round(scavenger.progress * 100)).toBe(100); // 3000/1000 capped

      const escortExpert = progress.find(p => p.id === 'escort_expert');
      expect(Math.round(escortExpert.progress * 100)).toBe(60); // 3/5

      const level10 = progress.find(p => p.id === 'level_10');
      expect(Math.round(level10.progress * 100)).toBe(70); // 7/10
    });
  });

  describe('panel summary', () => {
    it('shows correct total count', () => {
      expect(ACHIEVEMENTS.length).toBe(13);
    });

    it('percentage of unlocked achievements calculates correctly', () => {
      const unlocked = new Set(['first_blood', 'veteran', 'slayer']);
      const pct = Math.round((unlocked.size / ACHIEVEMENTS.length) * 100);
      expect(pct).toBe(23); // 3/13 = 23.07%
    });
  });
});
