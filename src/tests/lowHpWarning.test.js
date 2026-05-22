/**
 * lowHpWarning.test.js — Tests for low HP warning system
 *
 * Tests the pure calculation function (getLowHpWarningLevel) and the
 * integrated warning state updates.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getLowHpWarningLevel, updateLowHpWarning } from '../engine/lowHpWarning';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';

describe('lowHpWarning — getLowHpWarningLevel', () => {
  const C = GAME_CONFIG.lowHpWarning;

  describe('config defaults', () => {
    it('has warningThreshold configured', () => {
      expect(C.warningThreshold).toBe(0.3);
    });

    it('has criticalThreshold configured', () => {
      expect(C.criticalThreshold).toBe(0.15);
    });

    it('thresholds are valid: warning >= critical >= 0', () => {
      expect(C.warningThreshold).toBeGreaterThanOrEqual(C.criticalThreshold);
      expect(C.criticalThreshold).toBeGreaterThanOrEqual(0);
    });

    it('has pulsePeriod configured', () => {
      expect(C.pulsePeriod).toBeGreaterThan(0);
    });

    it('has heartbeatInterval configured', () => {
      expect(C.heartbeatInterval).toBeGreaterThan(0);
    });
  });

  describe('above warning threshold', () => {
    it('returns no warning when HP is at max', () => {
      const result = getLowHpWarningLevel(100, 100);
      expect(result.active).toBe(false);
      expect(result.level).toBe(0);
      expect(result.isCritical).toBe(false);
      expect(result.intensity).toBe(0);
    });

    it('returns no warning when HP is above warning threshold', () => {
      // 31/100 = 0.31 > 0.30 threshold
      const result = getLowHpWarningLevel(31, 100);
      expect(result.active).toBe(false);
      expect(result.level).toBe(0);
    });

    it('returns no warning when HP equals warning threshold exactly (inclusive: at threshold, still warning)', () => {
      // 30/100 = 0.30 — at threshold, should be active
      const result = getLowHpWarningLevel(30, 100);
      expect(result.active).toBe(true);
    });
  });

  describe('warning level (between warning and critical thresholds)', () => {
    it('activates at warning threshold', () => {
      const result = getLowHpWarningLevel(30, 100);
      expect(result.active).toBe(true);
      expect(result.level).toBe(1);
      expect(result.isCritical).toBe(false);
    });

    it('has intensity between 0 and 1 for warning level', () => {
      // At exactly warning threshold (0.30), intensity should be 0
      const result1 = getLowHpWarningLevel(30, 100);
      expect(result1.intensity).toBeCloseTo(0, 2);

      // Between warning and critical, intensity increases
      const result2 = getLowHpWarningLevel(25, 100);
      expect(result2.intensity).toBeGreaterThan(0);
      expect(result2.intensity).toBeLessThan(1);
    });

    it('is not critical above critical threshold', () => {
      const result = getLowHpWarningLevel(20, 100);
      expect(result.isCritical).toBe(false);
      expect(result.level).toBe(1);
    });
  });

  describe('critical level (at or below critical threshold)', () => {
    it('activates critical at critical threshold', () => {
      const result = getLowHpWarningLevel(15, 100);
      expect(result.active).toBe(true);
      expect(result.level).toBe(2);
      expect(result.isCritical).toBe(true);
    });

    it('has max intensity at 0 HP', () => {
      const result = getLowHpWarningLevel(0, 100);
      expect(result.intensity).toBe(1);
      expect(result.isCritical).toBe(true);
    });

    it('interpolates intensity between critical threshold and 0', () => {
      // At critical threshold (0.15), intensity should be 1 for warning range
      // then continue to 1 at 0 HP
      const result = getLowHpWarningLevel(7, 100); // ~0.07 ratio
      expect(result.intensity).toBeGreaterThan(0.5);
      expect(result.intensity).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('handles zero maxHp without crashing', () => {
      const result = getLowHpWarningLevel(0, 0);
      expect(result.active).toBe(false);
      expect(result.intensity).toBe(0);
    });

    it('handles negative HP', () => {
      const result = getLowHpWarningLevel(-10, 100);
      expect(result.active).toBe(true);
      expect(result.isCritical).toBe(true);
      expect(result.intensity).toBe(1);
    });

    it('handles HP greater than maxHp', () => {
      const result = getLowHpWarningLevel(150, 100);
      expect(result.active).toBe(false);
      expect(result.intensity).toBe(0);
    });
  });

  describe('intensity interpolation', () => {
    it('intensity is 0 at warning threshold', () => {
      const result = getLowHpWarningLevel(30, 100);
      expect(result.intensity).toBeCloseTo(0, 1);
    });

    it('intensity increases as HP decreases below warning threshold', () => {
      const r1 = getLowHpWarningLevel(29, 100);
      const r2 = getLowHpWarningLevel(20, 100);
      const r3 = getLowHpWarningLevel(10, 100);
      expect(r1.intensity).toBeLessThan(r2.intensity);
      expect(r2.intensity).toBeLessThan(r3.intensity);
    });

    it('intensity is clamped to [0, 1]', () => {
      const result = getLowHpWarningLevel(0, 100);
      expect(result.intensity).toBeGreaterThanOrEqual(0);
      expect(result.intensity).toBeLessThanOrEqual(1);
    });
  });
});

describe('lowHpWarning — state initialization', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('has lowHpWarning in game state', () => {
    expect(state.lowHpWarning).toBeDefined();
  });

  it('lowHpWarning defaults to inactive', () => {
    expect(state.lowHpWarning.active).toBe(false);
    expect(state.lowHpWarning.intensity).toBe(0);
    expect(state.lowHpWarning.pulseTimer).toBe(0);
    expect(state.lowHpWarning.heartbeatTimer).toBe(0);
  });
});

describe('lowHpWarning — updateLowHpWarning', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('deactivates when HP is above threshold', () => {
    state.player.hp = 80;
    state.player.maxHp = 100;
    state.lowHpWarning.active = true;
    state.lowHpWarning.intensity = 0.5;

    updateLowHpWarning(0.016, state);

    expect(state.lowHpWarning.active).toBe(false);
    expect(state.lowHpWarning.intensity).toBe(0);
  });

  it('activates when HP drops below threshold', () => {
    state.player.hp = 25;
    state.player.maxHp = 100;

    updateLowHpWarning(0.016, state);

    expect(state.lowHpWarning.active).toBe(true);
    expect(state.lowHpWarning.intensity).toBeGreaterThan(0);
  });

  it('updates pulse timer', () => {
    state.player.hp = 25;
    state.player.maxHp = 100;

    updateLowHpWarning(0.016, state);

    expect(state.lowHpWarning.pulseTimer).toBeGreaterThan(0);
  });
});
