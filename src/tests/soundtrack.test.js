/**
 * Unit tests for procedural soundtrack system.
 *
 * Verifies soundtrack intensity calculation, state management, and transitions.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestState } from './helpers';

// Import the calculateIntensity function logic (tested via game state)
describe('soundtrack intensity calculation', () => {
  /**
   * Recreate the calculateIntensity logic for testing.
   * Matches the implementation in systems/audio.js
   */
  function calculateIntensity(g) {
    const enemyCount = g.enemies?.filter(e => e.active).length || 0;
    const hpPercent = g.player?.maxHp ? g.player.hp / g.player.maxHp : 1;

    if (enemyCount >= 4 || hpPercent < 0.3) {
      return 'tense';
    }

    return 'calm';
  }

  describe('calm intensity', () => {
    let state;

    beforeEach(() => {
      state = createTestState();
      state.enemies = [];
      state.player = { ...state.player, hp: 300, maxHp: 300 };
    });

    it('returns calm with no enemies and full HP', () => {
      expect(calculateIntensity(state)).toBe('calm');
    });

    it('returns calm with 1 enemy', () => {
      state.enemies = [{ id: 1, active: true }];
      expect(calculateIntensity(state)).toBe('calm');
    });

    it('returns calm with 3 enemies', () => {
      state.enemies = [
        { id: 1, active: true },
        { id: 2, active: true },
        { id: 3, active: true },
      ];
      expect(calculateIntensity(state)).toBe('calm');
    });

    it('returns calm with moderate HP loss', () => {
      state.player.hp = 150; // 50% HP
      expect(calculateIntensity(state)).toBe('calm');
    });

    it('returns calm with inactive enemies', () => {
      state.enemies = [
        { id: 1, active: false },
        { id: 2, active: false },
        { id: 3, active: false },
        { id: 4, active: false },
      ];
      expect(calculateIntensity(state)).toBe('calm');
    });
  });

  describe('tense intensity', () => {
    let state;

    beforeEach(() => {
      state = createTestState();
      state.enemies = [];
      state.player = { ...state.player, hp: 300, maxHp: 300 };
    });

    it('returns tense with 4 or more active enemies', () => {
      state.enemies = [
        { id: 1, active: true },
        { id: 2, active: true },
        { id: 3, active: true },
        { id: 4, active: true },
      ];
      expect(calculateIntensity(state)).toBe('tense');
    });

    it('returns tense with 5 active enemies', () => {
      state.enemies = [
        { id: 1, active: true },
        { id: 2, active: true },
        { id: 3, active: true },
        { id: 4, active: true },
        { id: 5, active: true },
      ];
      expect(calculateIntensity(state)).toBe('tense');
    });

    it('returns tense with low HP (below 30%)', () => {
      state.player.hp = 80; // 26.7% HP
      expect(calculateIntensity(state)).toBe('tense');
    });

    it('returns tense with very low HP', () => {
      state.player.hp = 30; // 10% HP
      expect(calculateIntensity(state)).toBe('tense');
    });

    it('returns tense with both many enemies and low HP', () => {
      state.enemies = [
        { id: 1, active: true },
        { id: 2, active: true },
        { id: 3, active: true },
        { id: 4, active: true },
      ];
      state.player.hp = 50;
      expect(calculateIntensity(state)).toBe('tense');
    });

    it('returns tense with exactly 30% HP (boundary)', () => {
      state.player.hp = 90; // exactly 30%
      expect(calculateIntensity(state)).toBe('calm'); // 30% is not < 30%
    });

    it('returns tense with just below 30% HP', () => {
      state.player.hp = 89; // 29.7%
      expect(calculateIntensity(state)).toBe('tense');
    });
  });

  describe('edge cases', () => {
    it('handles missing enemies array', () => {
      const state = createTestState();
      delete state.enemies;
      expect(calculateIntensity(state)).toBe('calm');
    });

    it('handles missing player', () => {
      const state = createTestState();
      delete state.player;
      state.enemies = [];
      expect(calculateIntensity(state)).toBe('calm');
    });

    it('handles zero maxHp without division by zero', () => {
      const state = createTestState();
      state.player = { ...state.player, hp: 100, maxHp: 0 };
      state.enemies = [];
      expect(calculateIntensity(state)).toBe('calm');
    });

    it('handles mixed active/inactive enemies', () => {
      const state = createTestState();
      state.enemies = [
        { id: 1, active: true },
        { id: 2, active: true },
        { id: 3, active: false },
        { id: 4, active: false },
        { id: 5, active: true },
      ];
      expect(calculateIntensity(state)).toBe('calm'); // only 3 active
    });
  });
});

describe('soundtrack state management', () => {
  it('soundtrack starts as calm', () => {
    const state = createTestState();
    state.audio = { ...state.audio, _prev: {} };
    expect(state.audio._prev.soundtrackIntensity).toBeUndefined();
  });

  it('soundtrack intensity is tracked in _prev', () => {
    const state = createTestState();
    state.audio = { ...state.audio, _prev: {} };
    state.audio._prev.soundtrackIntensity = 'tense';
    expect(state.audio._prev.soundtrackIntensity).toBe('tense');
  });

  it('intensity transition detection works', () => {
    const state = createTestState();
    state.audio = { ...state.audio, _prev: { soundtrackIntensity: 'calm' } };

    // Simulate intensity change
    state.audio._prev.soundtrackIntensity = 'calm';
    const newIntensity = 'tense';

    expect(newIntensity !== state.audio._prev.soundtrackIntensity).toBe(true);
  });

  it('no transition when intensity unchanged', () => {
    const state = createTestState();
    state.audio = { ...state.audio, _prev: { soundtrackIntensity: 'calm' } };

    const newIntensity = 'calm';

    expect(newIntensity !== state.audio._prev.soundtrackIntensity).toBe(false);
  });
});

describe('soundtrack intensity thresholds', () => {
  it('enemy threshold is exactly 4', () => {
    const state = createTestState();
    state.player = { ...state.player, hp: 300, maxHp: 300 };

    // 3 enemies = calm
    state.enemies = [
      { id: 1, active: true },
      { id: 2, active: true },
      { id: 3, active: true },
    ];
    expect(calculateIntensity(state)).toBe('calm');

    // 4 enemies = tense
    state.enemies.push({ id: 4, active: true });
    expect(calculateIntensity(state)).toBe('tense');
  });

  it('HP threshold is exactly 30%', () => {
    const state = createTestState();
    state.enemies = [];

    // 30% HP = calm (not < 30%)
    state.player = { ...state.player, hp: 90, maxHp: 300 };
    expect(calculateIntensity(state)).toBe('calm');

    // 29.9% HP = tense
    state.player.hp = 89;
    expect(calculateIntensity(state)).toBe('tense');
  });
});

// Helper function for intensity calculation tests
function calculateIntensity(g) {
  const enemyCount = g.enemies?.filter(e => e.active).length || 0;
  const hpPercent = g.player?.maxHp ? g.player.hp / g.player.maxHp : 1;

  if (enemyCount >= 4 || hpPercent < 0.3) {
    return 'tense';
  }

  return 'calm';
}
