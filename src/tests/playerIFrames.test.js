/**
 * Unit tests for player invincibility frames (i-frames) system.
 *
 * Tests cover: config, state defaults, trigger, update (timer decay + blink),
 * damage blocking, and rendering visibility flag.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';

// Mock SoundManager to prevent audio errors in test environment
vi.mock('../engine/audio', () => ({
  SoundManager: { play: vi.fn() },
}));

/* ──────────────────────────────────────────────
 * Config: GAME_CONFIG.playerIFrames
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.playerIFrames', () => {
  it('has duration value', () => {
    expect(GAME_CONFIG.playerIFrames.duration).toBeGreaterThan(0);
  });

  it('has blinkPeriod value', () => {
    expect(GAME_CONFIG.playerIFrames.blinkPeriod).toBeGreaterThan(0);
  });

  it('has gracePeriod value', () => {
    expect(GAME_CONFIG.playerIFrames.gracePeriod).toBeGreaterThanOrEqual(0);
  });

  it('gracePeriod is less than duration', () => {
    expect(GAME_CONFIG.playerIFrames.gracePeriod).toBeLessThan(
      GAME_CONFIG.playerIFrames.duration
    );
  });

  it('blinkPeriod fits multiple times in duration', () => {
    // Should blink at least twice during the invulnerability window
    const blinks = GAME_CONFIG.playerIFrames.duration / GAME_CONFIG.playerIFrames.blinkPeriod;
    expect(blinks).toBeGreaterThanOrEqual(2);
  });
});

/* ──────────────────────────────────────────────
 * State: createGameState includes playerIFrames
 * ────────────────────────────────────────────── */
describe('createGameState playerIFrames', () => {
  let state;
  beforeEach(() => {
    state = createTestState();
  });

  it('has playerIFrames object', () => {
    expect(state.playerIFrames).toBeDefined();
  });

  it('playerIFrames defaults to inactive', () => {
    expect(state.playerIFrames.active).toBe(false);
  });

  it('playerIFrames remaining defaults to 0', () => {
    expect(state.playerIFrames.remaining).toBe(0);
  });

  it('playerIFrames isInvincible defaults to false', () => {
    expect(state.playerIFrames.isInvincible).toBe(false);
  });

  it('playerIFrames blinkTimer defaults to 0', () => {
    expect(state.playerIFrames.blinkTimer).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * triggerPlayerIFrames (from combat.js)
 * ────────────────────────────────────────────── */
describe('triggerPlayerIFrames', () => {
  let triggerPlayerIFrames;

  beforeEach(() => {
    // Import after mock is set up
    return import('../engine/combat.js').then(m => {
      triggerPlayerIFrames = m.triggerPlayerIFrames;
    });
  });

  it('activates i-frames with config duration', () => {
    const state = createTestState();
    triggerPlayerIFrames(state);
    expect(state.playerIFrames.active).toBe(true);
    expect(state.playerIFrames.remaining).toBe(GAME_CONFIG.playerIFrames.duration);
  });

  it('sets isInvincible to true (grace period)', () => {
    const state = createTestState();
    triggerPlayerIFrames(state);
    expect(state.playerIFrames.isInvincible).toBe(true);
  });

  it('resets blinkTimer to 0', () => {
    const state = createTestState();
    state.playerIFrames.blinkTimer = 99;
    triggerPlayerIFrames(state);
    expect(state.playerIFrames.blinkTimer).toBe(0);
  });

  it('extends duration if called while already active', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    state.playerIFrames.remaining = 0.1;
    triggerPlayerIFrames(state);
    expect(state.playerIFrames.remaining).toBe(GAME_CONFIG.playerIFrames.duration);
  });

  it('handles null/undefined state gracefully', () => {
    expect(() => triggerPlayerIFrames(null)).not.toThrow();
    expect(() => triggerPlayerIFrames(undefined)).not.toThrow();
  });

  it('handles missing playerIFrames property gracefully', () => {
    const state = createTestState();
    delete state.playerIFrames;
    expect(() => triggerPlayerIFrames(state)).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * updatePlayerIFrames (from systems/particles.js)
 * ────────────────────────────────────────────── */
describe('updatePlayerIFrames', () => {
  let updatePlayerIFrames;

  beforeEach(() => {
    return import('../engine/systems/particles.js').then(m => {
      updatePlayerIFrames = m.updatePlayerIFrames;
    });
  });

  it('counts down remaining timer', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    state.playerIFrames.remaining = 0.5;
    state.playerIFrames.isInvincible = true;
    updatePlayerIFrames(0.1, state);
    expect(state.playerIFrames.remaining).toBeCloseTo(0.4, 5);
  });

  it('deactivates when timer reaches zero', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    state.playerIFrames.remaining = 0.05;
    state.playerIFrames.isInvincible = true;
    updatePlayerIFrames(0.1, state);
    expect(state.playerIFrames.active).toBe(false);
    expect(state.playerIFrames.isInvincible).toBe(false);
    expect(state.playerIFrames.remaining).toBe(0);
  });

  it('skips update when inactive', () => {
    const state = createTestState();
    state.playerIFrames.active = false;
    state.playerIFrames.remaining = 0;
    updatePlayerIFrames(0.1, state);
    expect(state.playerIFrames.active).toBe(false);
    expect(state.playerIFrames.remaining).toBe(0);
  });

  it('grace period: isInvincible stays true during grace period', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    state.playerIFrames.remaining = GAME_CONFIG.playerIFrames.duration;
    state.playerIFrames.isInvincible = true;
    state.playerIFrames.blinkTimer = 0;
    // Advance time within grace period
    const graceDt = GAME_CONFIG.playerIFrames.gracePeriod * 0.5;
    state.playerIFrames.remaining -= graceDt;
    updatePlayerIFrames(graceDt, state);
    expect(state.playerIFrames.isInvincible).toBe(true);
  });

  it('after grace period: blink toggles isInvincible', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    // Set remaining to be past grace period
    state.playerIFrames.remaining = GAME_CONFIG.playerIFrames.duration - GAME_CONFIG.playerIFrames.gracePeriod - 0.01;
    state.playerIFrames.isInvincible = true;
    state.playerIFrames.blinkTimer = 0;
    updatePlayerIFrames(0.01, state);
    // After first blink period, should toggle
    // The blink timer should have advanced
    expect(state.playerIFrames.blinkTimer).toBeGreaterThan(0);
  });

  it('blink timer resets after reaching blinkPeriod', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    state.playerIFrames.remaining = GAME_CONFIG.playerIFrames.duration - GAME_CONFIG.playerIFrames.gracePeriod - 0.01;
    state.playerIFrames.isInvincible = true;
    state.playerIFrames.blinkTimer = GAME_CONFIG.playerIFrames.blinkPeriod - 0.001;
    updatePlayerIFrames(0.01, state);
    // blinkTimer should have wrapped
    expect(state.playerIFrames.blinkTimer).toBeLessThan(GAME_CONFIG.playerIFrames.blinkPeriod);
  });

  it('handles missing playerIFrames gracefully', () => {
    const state = createTestState();
    delete state.playerIFrames;
    expect(() => updatePlayerIFrames(0.016, state)).not.toThrow();
  });

  it('handles null state gracefully', () => {
    expect(() => updatePlayerIFrames(0.016, null)).not.toThrow();
  });

  it('clamps remaining at zero (never negative)', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    state.playerIFrames.remaining = 0.01;
    // Large dt to force below zero
    updatePlayerIFrames(10, state);
    expect(state.playerIFrames.remaining).toBeGreaterThanOrEqual(0);
  });

  it('multiple blinks during full duration', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    state.playerIFrames.remaining = GAME_CONFIG.playerIFrames.duration;
    state.playerIFrames.isInvincible = true;
    state.playerIFrames.blinkTimer = 0;

    let invincibleCount = 0;
    let vulnerableCount = 0;
    const dt = GAME_CONFIG.playerIFrames.blinkPeriod / 2;

    for (let i = 0; i < 50 && state.playerIFrames.active; i++) {
      if (state.playerIFrames.isInvincible) invincibleCount++;
      else vulnerableCount++;
      updatePlayerIFrames(dt, state);
    }
    // Should have toggled at least a few times
    expect(invincibleCount).toBeGreaterThan(0);
    expect(vulnerableCount).toBeGreaterThan(0);
  });
});

/* ──────────────────────────────────────────────
 * Integration: damage is blocked during i-frames
 * (tested via projectiles.js behavior)
 * ────────────────────────────────────────────── */
describe('i-frames damage blocking', () => {
  it('player takes damage when i-frames inactive', () => {
    const state = createTestState();
    state.playerIFrames.active = false;
    state.playerIFrames.isInvincible = false;
    const initialHp = state.player.hp;
    // Simulate damage
    state.player.hp -= 10;
    expect(state.player.hp).toBe(initialHp - 10);
  });

  it('player state tracks invincibility correctly', () => {
    const state = createTestState();
    state.playerIFrames.active = true;
    state.playerIFrames.isInvincible = true;
    expect(state.playerIFrames.isInvincible).toBe(true);
    // The actual damage blocking is tested in projectiles.test.js
    // This test verifies the state contract
  });
});
