/**
 * Unit tests for scrap collection effect system.
 *
 * When scrap is collected, golden burst particles appear at the collection
 * point, a floating "+N" number rises and fades, and a sound plays.
 * Larger pickups also trigger a brief screen flash.
 *
 * Tests cover: config, effect creation, lifecycle, and edge cases.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';
import { triggerScrapCollection, updatePickups } from '../engine/systems/pickups';

/* ──────────────────────────────────────────────
 * Config: GAME_CONFIG.scrapCollection
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.scrapCollection', () => {
  it('has enabled flag', () => {
    expect('enabled' in GAME_CONFIG.scrapCollection).toBe(true);
  });

  it('has particleCount >= 0', () => {
    expect(GAME_CONFIG.scrapCollection.particleCount).toBeGreaterThanOrEqual(0);
  });

  it('has particleColor value', () => {
    expect(GAME_CONFIG.scrapCollection.particleColor).toBeDefined();
  });

  it('has floatLife value > 0', () => {
    expect(GAME_CONFIG.scrapCollection.floatLife).toBeGreaterThan(0);
  });

  it('has floatSpeed value > 0', () => {
    expect(GAME_CONFIG.scrapCollection.floatSpeed).toBeGreaterThan(0);
  });

  it('has floatColor value', () => {
    expect(GAME_CONFIG.scrapCollection.floatColor).toBeDefined();
  });

  it('has flashOpacity value between 0 and 1', () => {
    const op = GAME_CONFIG.scrapCollection.flashOpacity;
    expect(op).toBeGreaterThanOrEqual(0);
    expect(op).toBeLessThanOrEqual(1);
  });

  it('has flashDuration value > 0', () => {
    expect(GAME_CONFIG.scrapCollection.flashDuration).toBeGreaterThan(0);
  });

  it('has flashMinValue >= 0', () => {
    expect(GAME_CONFIG.scrapCollection.flashMinValue).toBeGreaterThanOrEqual(0);
  });

  it('has maxFloats value > 0', () => {
    expect(GAME_CONFIG.scrapCollection.maxFloats).toBeGreaterThan(0);
  });
});

/* ──────────────────────────────────────────────
 * triggerScrapCollection
 * ────────────────────────────────────────────── */
describe('triggerScrapCollection', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      particles: [],
      effects: [],
      scrapFloats: [],
    });
    vi.clearAllMocks();
  });

  it('creates floating number effect', () => {
    triggerScrapCollection(g, 100, 200, 5);

    expect(g.scrapFloats.length).toBe(1);
    expect(g.scrapFloats[0].x).toBe(100);
    expect(g.scrapFloats[0].y).toBe(200);
    expect(g.scrapFloats[0].text).toBe('+5');
    expect(g.scrapFloats[0].active).toBe(true);
  });

  it('spawns burst particles', () => {
    g.particles = [];
    triggerScrapCollection(g, 0, 0, 1);

    const expected = GAME_CONFIG.scrapCollection.particleCount;
    expect(g.particles.length).toBe(expected);
    for (const p of g.particles) {
      expect(p.x).toBe(0);
      expect(p.y).toBe(0);
      expect(p.color).toBe(GAME_CONFIG.scrapCollection.particleColor);
    }
  });

  it('sets float life from config', () => {
    triggerScrapCollection(g, 0, 0, 1);
    expect(g.scrapFloats[0].life).toBe(GAME_CONFIG.scrapCollection.floatLife);
    expect(g.scrapFloats[0].maxLife).toBe(GAME_CONFIG.scrapCollection.floatLife);
  });

  it('sets float color from config', () => {
    triggerScrapCollection(g, 0, 0, 1);
    expect(g.scrapFloats[0].color).toBe(GAME_CONFIG.scrapCollection.floatColor);
  });

  it('respects maxFloats limit — drops oldest when full', () => {
    const max = GAME_CONFIG.scrapCollection.maxFloats;
    for (let i = 0; i < max + 3; i++) {
      triggerScrapCollection(g, i * 100, i * 100, 1);
    }

    expect(g.scrapFloats.length).toBe(max);
    expect(g.scrapFloats[0].x).toBe(3 * 100); // oldest remaining after 3 overflows
  });

  it('triggers screen flash for large pickups', () => {
    g.screenFlash = undefined;
    const minVal = GAME_CONFIG.scrapCollection.flashMinValue;
    triggerScrapCollection(g, 0, 0, minVal);

    expect(g.screenFlash).toBeDefined();
    expect(g.screenFlash.active).toBe(true);
    expect(g.screenFlash.opacity).toBe(GAME_CONFIG.scrapCollection.flashOpacity);
  });

  it('does NOT trigger screen flash for small pickups', () => {
    g.screenFlash = undefined;
    const minVal = GAME_CONFIG.scrapCollection.flashMinValue;
    triggerScrapCollection(g, 0, 0, minVal - 1);

    expect(g.screenFlash).toBeUndefined();
  });

  it('handles null game state gracefully', () => {
    expect(() => triggerScrapCollection(null, 0, 0, 1)).not.toThrow();
  });

  it('handles missing particles array', () => {
    delete g.particles;
    expect(() => triggerScrapCollection(g, 0, 0, 1)).not.toThrow();
  });

  it('handles missing effects array', () => {
    delete g.effects;
    expect(() => triggerScrapCollection(g, 0, 0, 1)).not.toThrow();
  });

  it('handles disabled config', () => {
    // Temporarily disable
    const orig = GAME_CONFIG.scrapCollection.enabled;
    GAME_CONFIG.scrapCollection.enabled = false;
    triggerScrapCollection(g, 0, 0, 1);
    GAME_CONFIG.scrapCollection.enabled = orig;

    expect(g.scrapFloats.length).toBe(0);
    expect(g.particles.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * Scrap float lifecycle via updatePickups
 * ────────────────────────────────────────────── */
describe('scrap float lifecycle', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      particles: [],
      effects: [],
      scrapFloats: [],
      pickups: [],
    });
  });

  it('floats upward over time', () => {
    g.scrapFloats.push({
      x: 0, y: 0,
      text: '+1',
      life: 1.0,
      maxLife: 1.0,
      color: '#fbbf24',
      active: true,
    });

    updatePickups(0.1, g, () => {});

    // Y should decrease (float upward)
    const expectedDelta = GAME_CONFIG.scrapCollection.floatSpeed * 0.1;
    expect(g.scrapFloats[0].y).toBeCloseTo(-expectedDelta, 1);
  });

  it('deactivates when life expires', () => {
    g.scrapFloats.push({
      x: 0, y: 0,
      text: '+1',
      life: 0.2,
      maxLife: 0.2,
      color: '#fbbf24',
      active: true,
    });

    updatePickups(0.3, g, () => {});

    expect(g.scrapFloats[0].active).toBe(false);
    expect(g.scrapFloats[0].life).toBe(0);
  });

  it('skips inactive floats', () => {
    g.scrapFloats.push({
      x: 0, y: 100,
      text: '+1',
      life: 0.5,
      maxLife: 0.5,
      color: '#fbbf24',
      active: false,
    });

    updatePickups(0.1, g, () => {});

    expect(g.scrapFloats[0].y).toBe(100); // unchanged
    expect(g.scrapFloats[0].life).toBe(0.5); // unchanged
  });

  it('handles missing scrapFloats array', () => {
    delete g.scrapFloats;
    expect(() => updatePickups(0.016, g, () => {})).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * Screen flash lifecycle
 * ────────────────────────────────────────────── */
describe('screen flash lifecycle', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      particles: [],
      effects: [],
      scrapFloats: [],
      pickups: [],
    });
  });

  it('decays remaining time', () => {
    g.screenFlash = {
      active: true,
      remaining: 0.2,
      opacity: 0.06,
    };

    updatePickups(0.1, g, () => {});

    expect(g.screenFlash.remaining).toBeCloseTo(0.1, 2);
  });

  it('deactivates when remaining reaches 0', () => {
    g.screenFlash = {
      active: true,
      remaining: 0.1,
      opacity: 0.06,
    };

    updatePickups(0.15, g, () => {});

    expect(g.screenFlash.active).toBe(false);
    expect(g.screenFlash.remaining).toBe(0);
  });

  it('handles missing screenFlash', () => {
    g.screenFlash = undefined;
    expect(() => updatePickups(0.016, g, () => {})).not.toThrow();
  });
});
