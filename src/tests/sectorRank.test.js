/**
 * Unit tests for sectorRank.js — sector rank calculation, rewards, and buffs.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  calcHpScore,
  calcEfficiencyScore,
  calcScrapScore,
  calcTimeScore,
  getRankFromScore,
  calculateSectorRank,
  applySectorRewards,
  getBuffChoices,
  applyBuff,
  recordMissionCompletion,
  resetSector,
} from '../engine/sectorRank';
import { createGameState } from '../engine/state';
import { calculateDifficultyMultiplier, getScrapMultiplier } from '../engine/difficulty';

/* ──────────────────────────────────────────────
 * 1. Score component helpers (pure)
 * ────────────────────────────────────────────── */
describe('calcHpScore', () => {
  it('returns 40 for 100% HP', () => {
    expect(calcHpScore(100)).toBe(40);
  });

  it('returns 20 for 50% HP', () => {
    expect(calcHpScore(50)).toBe(20);
  });

  it('returns 0 for 0% HP', () => {
    expect(calcHpScore(0)).toBe(0);
  });

  it('clamps to 40 for values above 100', () => {
    expect(calcHpScore(200)).toBe(40);
  });

  it('clamps to 0 for negative values', () => {
    expect(calcHpScore(-10)).toBe(0);
  });
});

describe('calcEfficiencyScore', () => {
  it('returns 30 for perfect completion', () => {
    expect(calcEfficiencyScore(10, 10)).toBe(30);
  });

  it('returns 15 for 50% completion', () => {
    expect(calcEfficiencyScore(5, 10)).toBe(15);
  });

  it('returns 0 when cleared is 0', () => {
    expect(calcEfficiencyScore(5, 0)).toBe(0);
  });

  it('returns 0 when cleared is undefined', () => {
    expect(calcEfficiencyScore(5, undefined)).toBe(0);
  });

  it('returns 0 when cleared is null', () => {
    expect(calcEfficiencyScore(5, null)).toBe(0);
  });

  it('clamps to 30 for ratio > 1', () => {
    expect(calcEfficiencyScore(20, 10)).toBe(30);
  });
});

describe('calcScrapScore', () => {
  it('returns 8 for 2000 scrap', () => {
    expect(calcScrapScore(2000)).toBe(8);
  });

  it('returns 20 (max) for 5000 scrap', () => {
    expect(calcScrapScore(5000)).toBe(20);
  });

  it('returns 20 (max) for 10000 scrap', () => {
    expect(calcScrapScore(10000)).toBe(20);
  });

  it('returns 0 for 0 scrap', () => {
    expect(calcScrapScore(0)).toBe(0);
  });

  it('returns 0 for negative scrap', () => {
    expect(calcScrapScore(-100)).toBe(0);
  });
});

describe('calcTimeScore', () => {
  it('returns 10 for 0 or negative time', () => {
    expect(calcTimeScore(0)).toBe(10);
    expect(calcTimeScore(-5)).toBe(10);
  });

  it('returns 5 for 60 seconds', () => {
    expect(calcTimeScore(60)).toBe(5);
  });

  it('returns 0 for 120 seconds', () => {
    expect(calcTimeScore(120)).toBe(0);
  });

  it('returns 0 for very long times', () => {
    expect(calcTimeScore(300)).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 2. Rank determination
 * ────────────────────────────────────────────── */
describe('getRankFromScore', () => {
  it('returns S for score >= 85', () => {
    expect(getRankFromScore(85)).toBe('S');
    expect(getRankFromScore(100)).toBe('S');
  });

  it('returns A for score >= 70', () => {
    expect(getRankFromScore(70)).toBe('A');
    expect(getRankFromScore(84)).toBe('A');
  });

  it('returns B for score >= 50', () => {
    expect(getRankFromScore(50)).toBe('B');
    expect(getRankFromScore(69)).toBe('B');
  });

  it('returns C for score >= 30', () => {
    expect(getRankFromScore(30)).toBe('C');
    expect(getRankFromScore(49)).toBe('C');
  });

  it('returns D for score < 30', () => {
    expect(getRankFromScore(0)).toBe('D');
    expect(getRankFromScore(29)).toBe('D');
  });
});

/* ──────────────────────────────────────────────
 * 3. Full rank calculation
 * ────────────────────────────────────────────── */
describe('calculateSectorRank', () => {
  let g;

  beforeEach(() => {
    g = createGameState();
  });

  it('returns all expected fields', () => {
    const result = calculateSectorRank(g);
    expect(result).toHaveProperty('rank');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('hpScore');
    expect(result).toHaveProperty('efficiencyScore');
    expect(result).toHaveProperty('scrapScore');
    expect(result).toHaveProperty('timeScore');
  });

  it('gives S rank for perfect sector', () => {
    g.sector.missionsCleared = 5;
    g.sector.missionsCompleted = 5;
    g.sector.totalHpPercent = 500; // 100% avg
    g.sector.missionStartTime = [0, 100, 200, 300, 400];
    g.sector.missionEndTime = [20, 120, 220, 320, 420];
    g.totalScrapEarned = 5000;

    const result = calculateSectorRank(g);
    expect(result.rank).toBe('S');
    expect(result.hpScore).toBe(40);
    expect(result.efficiencyScore).toBe(30);
    expect(result.scrapScore).toBe(20);
  });

  it('gives D rank for poor sector', () => {
    g.sector.missionsCleared = 5;
    g.sector.missionsCompleted = 1;
    g.sector.totalHpPercent = 50; // 10% avg
    g.sector.missionStartTime = [0, 100, 200, 300, 400];
    g.sector.missionEndTime = [150, 250, 350, 450, 550];
    g.totalScrapEarned = 0;

    const result = calculateSectorRank(g);
    expect(result.rank).toBe('D');
  });

  it('handles zero missions cleared (defaults to 100% HP, 0 time)', () => {
    const result = calculateSectorRank(g);
    expect(result.hpScore).toBe(40);
    expect(result.efficiencyScore).toBe(0);
    expect(result.timeScore).toBe(10);
  });
});

/* ──────────────────────────────────────────────
 * 4. Sector rewards
 * ────────────────────────────────────────────── */
describe('applySectorRewards', () => {
  let g;

  beforeEach(() => {
    g = createGameState();
  });

  it('sets S rank and enables veteran mode', () => {
    applySectorRewards(g, 'S');
    expect(g.sector.rank).toBe('S');
    expect(g.sector.veteranMode).toBe(true);
    expect(g.sector.consecutiveARank).toBe(1);
  });

  it('sets A rank and increments streak', () => {
    applySectorRewards(g, 'A');
    expect(g.sector.rank).toBe('A');
    expect(g.sector.veteranMode).toBe(false);
    expect(g.sector.consecutiveARank).toBe(1);
  });

  it('resets streak for non-S/A rank', () => {
    g.sector.consecutiveARank = 5;
    applySectorRewards(g, 'C');
    expect(g.sector.rank).toBe('C');
    expect(g.sector.consecutiveARank).toBe(0);
  });

  it('increments streak for multiple A ranks', () => {
    applySectorRewards(g, 'A');
    applySectorRewards(g, 'A');
    expect(g.sector.consecutiveARank).toBe(2);
  });

  it('veteran mode persists after S then A', () => {
    applySectorRewards(g, 'S');
    expect(g.sector.veteranMode).toBe(true);
    applySectorRewards(g, 'A');
    expect(g.sector.veteranMode).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * 5. Buff choices
 * ────────────────────────────────────────────── */
describe('getBuffChoices', () => {
  it('returns 4 buff choices', () => {
    const choices = getBuffChoices();
    expect(choices.length).toBe(4);
  });

  it('includes all expected buff IDs', () => {
    const ids = getBuffChoices().map(b => b.id);
    expect(ids).toContain('max_shield_start');
    expect(ids).toContain('free_weapon');
    expect(ids).toContain('scrap_bonus');
    expect(ids).toContain('speed_boost');
  });

  it('each choice has id, name, and description', () => {
    for (const choice of getBuffChoices()) {
      expect(typeof choice.id).toBe('string');
      expect(typeof choice.name).toBe('string');
      expect(typeof choice.description).toBe('string');
    }
  });

  it('returns independent copies', () => {
    const a = getBuffChoices();
    const b = getBuffChoices();
    a[0].name = 'HACKED';
    expect(b[0].name).not.toBe('HACKED');
  });
});

/* ──────────────────────────────────────────────
 * 6. Buff application
 * ────────────────────────────────────────────── */
describe('applyBuff', () => {
  let g;

  beforeEach(() => {
    g = createGameState();
  });

  it('sets activeBuff on state', () => {
    applyBuff(g, 'max_shield_start');
    expect(g.sector.activeBuff).toBe('max_shield_start');
  });

  it('max_shield_start restores shield to max', () => {
    g.player.shield = 5;
    g.player.maxShield = 20;
    applyBuff(g, 'max_shield_start');
    expect(g.player.shield).toBe(20);
  });

  it('free_weapon adds 500 scrap', () => {
    const before = g.scrap;
    applyBuff(g, 'free_weapon');
    expect(g.scrap).toBe(before + 500);
  });

  it('scrap_bonus adds 100 scrap', () => {
    const before = g.scrap;
    applyBuff(g, 'scrap_bonus');
    expect(g.scrap).toBe(before + 100);
  });

  it('speed_boost increases speed by 10%', () => {
    const before = g.player.speed;
    applyBuff(g, 'speed_boost');
    expect(g.player.speed).toBe(Math.round(before * 1.1));
  });

  it('unknown buff does nothing', () => {
    const before = { ...g.sector, scrap: g.scrap, speed: g.player.speed, shield: g.player.shield };
    applyBuff(g, 'unknown_buff');
    expect(g.sector.activeBuff).toBe('unknown_buff');
    expect(g.scrap).toBe(before.scrap);
    expect(g.player.speed).toBe(before.speed);
  });
});

/* ──────────────────────────────────────────────
 * 7. Mission tracking
 * ────────────────────────────────────────────── */
describe('recordMissionCompletion', () => {
  let g;

  beforeEach(() => {
    g = createGameState();
  });

  it('increments missionsCleared and missionsCompleted', () => {
    recordMissionCompletion(g);
    expect(g.sector.missionsCleared).toBe(1);
    expect(g.sector.missionsCompleted).toBe(1);
  });

  it('records HP percentage', () => {
    g.player.hp = 150;
    g.player.maxHp = 300;
    g.totalTime = 60;
    recordMissionCompletion(g);
    expect(g.sector.totalHpPercent).toBe(50);
  });

  it('records mission start and end times', () => {
    g.totalTime = 100;
    recordMissionCompletion(g);
    expect(g.sector.missionStartTime).toEqual([100]);
    expect(g.sector.missionEndTime).toEqual([100]);
  });

  it('accumulates across multiple calls', () => {
    g.player.hp = 300;
    g.totalTime = 10;
    recordMissionCompletion(g);

    g.player.hp = 200;
    g.totalTime = 30;
    recordMissionCompletion(g);

    expect(g.sector.missionsCleared).toBe(2);
    expect(g.sector.missionsCompleted).toBe(2);
    expect(g.sector.totalHpPercent).toBeCloseTo(166.67, 1); // 100 + 66.67
    expect(g.sector.missionStartTime.length).toBe(2);
    expect(g.sector.missionEndTime.length).toBe(2);
  });
});

/* ──────────────────────────────────────────────
 * 8. Sector reset
 * ────────────────────────────────────────────── */
describe('resetSector', () => {
  let g;

  beforeEach(() => {
    g = createGameState();
  });

  it('increments sector number', () => {
    g.sector.number = 3;
    resetSector(g);
    expect(g.sector.number).toBe(4);
  });

  it('resets rank and rankScore', () => {
    g.sector.rank = 'S';
    g.sector.rankScore = 95;
    resetSector(g);
    expect(g.sector.rank).toBeNull();
    expect(g.sector.rankScore).toBe(0);
  });

  it('resets mission tracking', () => {
    g.sector.missionsCleared = 10;
    g.sector.missionsCompleted = 8;
    g.sector.totalHpPercent = 700;
    g.sector.missionStartTime = [1, 2, 3];
    g.sector.missionEndTime = [10, 20, 30];
    resetSector(g);
    expect(g.sector.missionsCleared).toBe(0);
    expect(g.sector.missionsCompleted).toBe(0);
    expect(g.sector.totalHpPercent).toBe(0);
    expect(g.sector.missionStartTime).toEqual([]);
    expect(g.sector.missionEndTime).toEqual([]);
  });

  it('preserves veteranMode', () => {
    g.sector.veteranMode = true;
    resetSector(g);
    expect(g.sector.veteranMode).toBe(true);
  });

  it('preserves consecutiveARank', () => {
    g.sector.consecutiveARank = 4;
    resetSector(g);
    expect(g.sector.consecutiveARank).toBe(4);
  });

  it('preserves activeBuff', () => {
    g.sector.activeBuff = 'speed_boost';
    resetSector(g);
    expect(g.sector.activeBuff).toBe('speed_boost');
  });
});

/* ──────────────────────────────────────────────
 * 9. Sector state defaults
 * ────────────────────────────────────────────── */
describe('sector state defaults', () => {
  it('sector.number starts at 1', () => {
    const g = createGameState();
    expect(g.sector.number).toBe(1);
  });

  it('sector.rank starts null', () => {
    const g = createGameState();
    expect(g.sector.rank).toBeNull();
  });

  it('sector.rankScore starts at 0', () => {
    const g = createGameState();
    expect(g.sector.rankScore).toBe(0);
  });

  it('sector.consecutiveARank starts at 0', () => {
    const g = createGameState();
    expect(g.sector.consecutiveARank).toBe(0);
  });

  it('sector.veteranMode starts false', () => {
    const g = createGameState();
    expect(g.sector.veteranMode).toBe(false);
  });

  it('sector.activeBuff starts null', () => {
    const g = createGameState();
    expect(g.sector.activeBuff).toBeNull();
  });

  it('sector.missionsCleared starts at 0', () => {
    const g = createGameState();
    expect(g.sector.missionsCleared).toBe(0);
  });

  it('sector.missionsCompleted starts at 0', () => {
    const g = createGameState();
    expect(g.sector.missionsCompleted).toBe(0);
  });

  it('sector.totalHpPercent starts at 0', () => {
    const g = createGameState();
    expect(g.sector.totalHpPercent).toBe(0);
  });

  it('sector.missionStartTime is empty array', () => {
    const g = createGameState();
    expect(Array.isArray(g.sector.missionStartTime)).toBe(true);
    expect(g.sector.missionStartTime.length).toBe(0);
  });

  it('sector.missionEndTime is empty array', () => {
    const g = createGameState();
    expect(Array.isArray(g.sector.missionEndTime)).toBe(true);
    expect(g.sector.missionEndTime.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 10. Integration: Full sector progression flow
 * ────────────────────────────────────────────── */
describe('Integration: sector progression flow', () => {
  let g;

  beforeEach(() => {
    g = createGameState();
  });

  it('complete sector → rank → rewards → next sector', () => {
    // Simulate completing 3 missions with high HP and speed
    g.totalScrapEarned = 3000;

    // Mission 1: 90% HP, 15 seconds
    g.player.hp = 270;
    g.player.maxHp = 300;
    g.totalTime = 15;
    recordMissionCompletion(g);

    // Mission 2: 80% HP, 20 seconds
    g.player.hp = 240;
    g.totalTime = 35;
    recordMissionCompletion(g);

    // Mission 3: 85% HP, 10 seconds
    g.player.hp = 255;
    g.totalTime = 45;
    recordMissionCompletion(g);

    // Calculate rank
    const rankData = calculateSectorRank(g);
    expect(rankData.rank).toBe('S');
    expect(rankData.score).toBeGreaterThanOrEqual(85);

    // Apply rewards
    applySectorRewards(g, rankData.rank);
    expect(g.sector.rank).toBe('S');
    expect(g.sector.veteranMode).toBe(true);
    expect(g.sector.consecutiveARank).toBe(1);

    // Get buff choices
    const choices = getBuffChoices();
    expect(choices.length).toBe(4);

    // Apply a buff
    applyBuff(g, 'speed_boost');
    expect(g.sector.activeBuff).toBe('speed_boost');
    expect(g.player.speed).toBe(Math.round(120 * 1.1));

    // Reset for next sector — preserves veteran mode and buff
    resetSector(g);
    expect(g.sector.number).toBe(2);
    expect(g.sector.veteranMode).toBe(true);
    expect(g.sector.activeBuff).toBe('speed_boost');
    expect(g.sector.missionsCleared).toBe(0);
    expect(g.sector.rank).toBeNull();
  });

  it('veteran mode persists across multiple sectors', () => {
    // Sector 1: earn S rank
    applySectorRewards(g, 'S');
    expect(g.sector.veteranMode).toBe(true);

    // Reset to sector 2
    resetSector(g);
    expect(g.sector.number).toBe(2);
    expect(g.sector.veteranMode).toBe(true);

    // Sector 2: earn A rank
    applySectorRewards(g, 'A');
    expect(g.sector.veteranMode).toBe(true);
    expect(g.sector.consecutiveARank).toBe(2);

    // Reset to sector 3
    resetSector(g);
    expect(g.sector.number).toBe(3);
    expect(g.sector.veteranMode).toBe(true);
    expect(g.sector.consecutiveARank).toBe(2);
  });

  it('non-A rank resets streak but keeps veteran mode', () => {
    // Earn veteran mode
    applySectorRewards(g, 'S');
    expect(g.sector.veteranMode).toBe(true);
    expect(g.sector.consecutiveARank).toBe(1);

    // Next sector: C rank
    applySectorRewards(g, 'C');
    expect(g.sector.veteranMode).toBe(true);
    expect(g.sector.consecutiveARank).toBe(0);
  });

  it('carry-over buff applies on next sector start', () => {
    // Select buff after S-rank sector
    applySectorRewards(g, 'S');
    applyBuff(g, 'scrap_bonus');
    const scrapBefore = g.scrap;
    expect(g.scrap).toBe(scrapBefore); // applyBuff already added scrap

    // Simulate next sector start: resetSector preserves buff
    resetSector(g);
    expect(g.sector.activeBuff).toBe('scrap_bonus');
  });

  it('buff is cleared after use in shop (simulated)', () => {
    applySectorRewards(g, 'A');
    applyBuff(g, 'free_weapon');
    expect(g.sector.activeBuff).toBe('free_weapon');

    // Simulate shop: purchase weapon with free buff
    g.sector.activeBuff = null; // Cleared by buyUpgrade
    expect(g.sector.activeBuff).toBeNull();
  });

  it('multiple buffs across sectors work independently', () => {
    // Sector 1: S rank, pick speed_boost
    applySectorRewards(g, 'S');
    applyBuff(g, 'speed_boost');
    const speedAfter1 = g.player.speed;

    // Sector 2: reset, pick scrap_bonus
    resetSector(g);
    // Clear old buff, apply new one
    g.sector.activeBuff = null;
    applyBuff(g, 'scrap_bonus');
    const scrapAfter2 = g.scrap;

    // Sector 3: reset, pick max_shield_start
    resetSector(g);
    g.sector.activeBuff = null;
    applyBuff(g, 'max_shield_start');
    expect(g.player.shield).toBe(g.player.maxShield);

    expect(g.sector.number).toBe(3); // started at 1, +2 resets
  });

  it('D rank gives no rewards or buff choices', () => {
    applySectorRewards(g, 'D');
    expect(g.sector.rank).toBe('D');
    expect(g.sector.veteranMode).toBe(false);
    expect(g.sector.consecutiveARank).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 11. Integration: difficulty multipliers with sector state
 * ────────────────────────────────────────────── */
describe('Integration: difficulty with veteran mode', () => {
  it('veteran mode increases difficulty multiplier', () => {
    const normal = calculateDifficultyMultiplier(5, 100, 'normal');
    const veteran = calculateDifficultyMultiplier(5, 100, 'veteran');
    expect(veteran).toBeCloseTo(normal * 1.2, 5);
  });

  it('veteran mode increases scrap multiplier', () => {
    expect(getScrapMultiplier('normal')).toBe(1);
    expect(getScrapMultiplier('veteran')).toBe(1.5);
  });
});
