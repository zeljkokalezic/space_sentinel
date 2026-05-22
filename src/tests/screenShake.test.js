/**
 * Unit tests for screen shake system.
 *
 * Tests cover: config, trigger, update (decay), and render offset.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getScreenShakeOffset } from '../engine/screenShake.js';
import { triggerScreenShake } from '../engine/combat.js';
import { updateScreenShake } from '../engine/systems/particles.js';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';

// Mock SoundManager to prevent audio errors in test environment
vi.mock('../engine/audio', () => ({
  SoundManager: { play: vi.fn() },
}));

/* ──────────────────────────────────────────────
 * Config: GAME_CONFIG.screenShake
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.screenShake', () => {
  it('has decay value', () => {
    expect(GAME_CONFIG.screenShake.decay).toBeGreaterThan(0);
  });

  it('has minThreshold value', () => {
    expect(GAME_CONFIG.screenShake.minThreshold).toBeGreaterThanOrEqual(0);
  });

  it('has presets object', () => {
    expect(GAME_CONFIG.screenShake.presets).toBeDefined();
    expect(typeof GAME_CONFIG.screenShake.presets).toBe('object');
  });

  it('has explosion preset with positive intensity', () => {
    expect(GAME_CONFIG.screenShake.presets.explosion).toBeGreaterThan(0);
  });

  it('has bigExplosion preset with positive intensity', () => {
    expect(GAME_CONFIG.screenShake.presets.bigExplosion).toBeGreaterThan(0);
  });

  it('has playerHit preset with positive intensity', () => {
    expect(GAME_CONFIG.screenShake.presets.playerHit).toBeGreaterThan(0);
  });

  it('bigExplosion is stronger than explosion', () => {
    expect(GAME_CONFIG.screenShake.presets.bigExplosion).toBeGreaterThan(
      GAME_CONFIG.screenShake.presets.explosion
    );
  });

  it('explosion is stronger than playerHit', () => {
    expect(GAME_CONFIG.screenShake.presets.explosion).toBeGreaterThan(
      GAME_CONFIG.screenShake.presets.playerHit
    );
  });
});

/* ──────────────────────────────────────────────
 * State: createGameState includes screenShake
 * ────────────────────────────────────────────── */
describe('createGameState screenShake', () => {
  let state;
  beforeEach(() => {
    state = createTestState();
  });

  it('has screenShake object', () => {
    expect(state.screenShake).toBeDefined();
  });

  it('screenShake defaults to inactive with zero intensity', () => {
    expect(state.screenShake.active).toBe(false);
    expect(state.screenShake.intensity).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * triggerScreenShake (from combat.js)
 * ────────────────────────────────────────────── */
describe('triggerScreenShake', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('activates shake with preset name', () => {
    triggerScreenShake(state, 'explosion');
    expect(state.screenShake.active).toBe(true);
    expect(state.screenShake.intensity).toBe(GAME_CONFIG.screenShake.presets.explosion);
  });

  it('activates shake with custom numeric value', () => {
    triggerScreenShake(state, 42);
    expect(state.screenShake.active).toBe(true);
    expect(state.screenShake.intensity).toBe(42);
  });

  it('accumulates intensity from multiple triggers', () => {
    triggerScreenShake(state, 'explosion');
    triggerScreenShake(state, 'playerHit');
    expect(state.screenShake.active).toBe(true);
    expect(state.screenShake.intensity).toBe(
      GAME_CONFIG.screenShake.presets.explosion + GAME_CONFIG.screenShake.presets.playerHit
    );
  });

  it('activates shake if previously inactive', () => {
    state.screenShake.active = false;
    state.screenShake.intensity = 0;
    triggerScreenShake(state, 'playerHit');
    expect(state.screenShake.active).toBe(true);
  });

  it('keeps shake active if already active', () => {
    state.screenShake.active = true;
    state.screenShake.intensity = 5;
    triggerScreenShake(state, 'explosion');
    expect(state.screenShake.active).toBe(true);
    expect(state.screenShake.intensity).toBe(5 + GAME_CONFIG.screenShake.presets.explosion);
  });

  it('handles unknown preset name gracefully (treats as 0)', () => {
    triggerScreenShake(state, 'nonexistent');
    expect(state.screenShake.active).toBe(true);
    expect(state.screenShake.intensity).toBe(0);
  });

  it('handles null/undefined state gracefully', () => {
    expect(() => triggerScreenShake(null, 'explosion')).not.toThrow();
    expect(() => triggerScreenShake(undefined, 'explosion')).not.toThrow();
  });

  it('handles missing screenShake property gracefully', () => {
    const stateNoShake = createTestState();
    delete stateNoShake.screenShake;
    expect(() => triggerScreenShake(stateNoShake, 'explosion')).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * updateScreenShake (from systems/particles.js)
 * ────────────────────────────────────────────── */
describe('updateScreenShake', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
    state.screenShake = { active: true, intensity: 20 };
  });

  it('decays intensity over time', () => {
    const initialIntensity = state.screenShake.intensity;
    updateScreenShake(0.1, state);
    expect(state.screenShake.intensity).toBeLessThan(initialIntensity);
  });

  it('deactivates when intensity drops below threshold', () => {
    state.screenShake.intensity = GAME_CONFIG.screenShake.minThreshold - 1;
    updateScreenShake(0.016, state);
    expect(state.screenShake.active).toBe(false);
    expect(state.screenShake.intensity).toBe(0);
  });

  it('stays active when intensity is above threshold after decay', () => {
    state.screenShake.intensity = GAME_CONFIG.screenShake.presets.explosion;
    updateScreenShake(0.016, state);
    expect(state.screenShake.active).toBe(true);
  });

  it('clamps intensity at zero (never negative)', () => {
    state.screenShake.intensity = 1;
    // Large dt to force below zero
    updateScreenShake(10, state);
    expect(state.screenShake.intensity).toBeGreaterThanOrEqual(0);
  });

  it('skips decay when inactive', () => {
    state.screenShake.active = false;
    state.screenShake.intensity = 0;
    updateScreenShake(0.1, state);
    expect(state.screenShake.active).toBe(false);
    expect(state.screenShake.intensity).toBe(0);
  });

  it('handles missing screenShake gracefully', () => {
    const stateNoShake = createTestState();
    delete stateNoShake.screenShake;
    expect(() => updateScreenShake(0.016, stateNoShake)).not.toThrow();
  });

  it('handles null state gracefully', () => {
    expect(() => updateScreenShake(0.016, null)).not.toThrow();
  });

  it('decay rate matches config', () => {
    state.screenShake.intensity = 20;
    const dt = 0.1;
    updateScreenShake(dt, state);
    const expected = Math.max(0, 20 - GAME_CONFIG.screenShake.decay * dt);
    expect(state.screenShake.intensity).toBeCloseTo(expected, 5);
  });
});

/* ──────────────────────────────────────────────
 * getScreenShakeOffset (pure function)
 * ────────────────────────────────────────────── */
describe('getScreenShakeOffset', () => {
  it('returns {x: 0, y: 0} for zero intensity', () => {
    const offset = getScreenShakeOffset(0, 0);
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(0);
  });

  it('returns {x: 0, y: 0} for negative intensity', () => {
    const offset = getScreenShakeOffset(-5, 0);
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(0);
  });

  it('returns non-zero offset for positive intensity', () => {
    const offset = getScreenShakeOffset(10, 0.5);
    // The offset should be bounded by intensity
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(10);
    // At least one axis should have some offset
    expect(Math.abs(offset.x) + Math.abs(offset.y)).toBeGreaterThan(0);
  });

  it('returns offset proportional to intensity', () => {
    const t = 0.5;
    const small = getScreenShakeOffset(2, t);
    const large = getScreenShakeOffset(20, t);
    // Large intensity should produce larger offsets
    const smallMag = Math.hypot(small.x, small.y);
    const largeMag = Math.hypot(large.x, large.y);
    expect(largeMag).toBeGreaterThanOrEqual(smallMag);
  });

  it('produces different offsets over time', () => {
    // Generate samples at different time values; expect variety
    const results = new Set();
    for (let t = 0; t < 5; t += 0.1) {
      const o = getScreenShakeOffset(10, t);
      results.add(`${Math.round(o.x)},${Math.round(o.y)}`);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it('produces smooth oscillation (not jumpy)', () => {
    const t = 1.0;
    const dt = 0.016; // ~60fps
    const o1 = getScreenShakeOffset(10, t);
    const o2 = getScreenShakeOffset(10, t + dt);
    // Consecutive frames should not jump more than the intensity
    const jump = Math.hypot(o2.x - o1.x, o2.y - o1.y);
    expect(jump).toBeLessThan(10);
  });

  it('offset magnitude is bounded by intensity', () => {
    const intensity = 15;
    for (let t = 0; t < 10; t += 0.1) {
      const o = getScreenShakeOffset(intensity, t);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(intensity);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(intensity);
    }
  });

  it('handles very large intensity', () => {
    const o = getScreenShakeOffset(1000, 2);
    expect(Math.abs(o.x)).toBeLessThanOrEqual(1000);
    expect(Math.abs(o.y)).toBeLessThanOrEqual(1000);
  });
});
