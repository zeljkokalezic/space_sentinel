/**
 * Unit tests for enemy spawn flash effect system.
 *
 * When enemies spawn, an expanding ring effect appears at the spawn location,
 * giving the player visual warning of new threats. The ring expands outward
 * and fades over a short duration.
 *
 * Tests cover: config, effect creation, lifecycle, and edge cases.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';
import { createSpawnFlash, updateSpawnFlashes } from '../engine/spawner';

/* ──────────────────────────────────────────────
 * Config: GAME_CONFIG.enemySpawnFlash
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.enemySpawnFlash', () => {
  it('has enabled flag', () => {
    expect('enabled' in GAME_CONFIG.enemySpawnFlash).toBe(true);
  });

  it('has maxRadius value > 0', () => {
    expect(GAME_CONFIG.enemySpawnFlash.maxRadius).toBeGreaterThan(0);
  });

  it('has duration value > 0', () => {
    expect(GAME_CONFIG.enemySpawnFlash.duration).toBeGreaterThan(0);
  });

  it('has ringColor value', () => {
    expect(GAME_CONFIG.enemySpawnFlash.ringColor).toBeDefined();
  });

  it('has lineWidth value > 0', () => {
    expect(GAME_CONFIG.enemySpawnFlash.lineWidth).toBeGreaterThan(0);
  });

  it('has particleCount value >= 0', () => {
    expect(GAME_CONFIG.enemySpawnFlash.particleCount).toBeGreaterThanOrEqual(0);
  });

  it('has particleColor value', () => {
    expect(GAME_CONFIG.enemySpawnFlash.particleColor).toBeDefined();
  });

  it('has maxFlashes value > 0', () => {
    expect(GAME_CONFIG.enemySpawnFlash.maxFlashes).toBeGreaterThan(0);
  });
});

/* ──────────────────────────────────────────────
 * createSpawnFlash
 * ────────────────────────────────────────────── */
describe('createSpawnFlash', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      spawnFlashes: [],
      particles: [],
    });
  });

  it('creates a spawn flash at the given position', () => {
    createSpawnFlash(g, 100, 200);

    expect(g.spawnFlashes.length).toBe(1);
    expect(g.spawnFlashes[0].x).toBe(100);
    expect(g.spawnFlashes[0].y).toBe(200);
  });

  it('initializes radius to 0', () => {
    createSpawnFlash(g, 0, 0);

    expect(g.spawnFlashes[0].radius).toBe(0);
  });

  it('sets maxRadius from config', () => {
    createSpawnFlash(g, 0, 0);

    expect(g.spawnFlashes[0].maxRadius).toBe(GAME_CONFIG.enemySpawnFlash.maxRadius);
  });

  it('sets life from config duration', () => {
    createSpawnFlash(g, 0, 0);

    expect(g.spawnFlashes[0].life).toBe(GAME_CONFIG.enemySpawnFlash.duration);
  });

  it('sets color from config', () => {
    createSpawnFlash(g, 0, 0);

    expect(g.spawnFlashes[0].color).toBe(GAME_CONFIG.enemySpawnFlash.ringColor);
  });

  it('is active on creation', () => {
    createSpawnFlash(g, 0, 0);

    expect(g.spawnFlashes[0].active).toBe(true);
  });

  it('assigns stable unique ids for renderer caching', () => {
    createSpawnFlash(g, 0, 0);
    createSpawnFlash(g, 0, 0);

    expect(g.spawnFlashes[0].id).toBeDefined();
    expect(g.spawnFlashes[1].id).toBeDefined();
    expect(g.spawnFlashes[0].id).not.toBe(g.spawnFlashes[1].id);
  });

  it('respects maxFlashes limit — drops oldest when full', () => {
    const max = GAME_CONFIG.enemySpawnFlash.maxFlashes;
    for (let i = 0; i < max + 3; i++) {
      createSpawnFlash(g, i * 100, i * 100);
    }

    expect(g.spawnFlashes.length).toBe(max);
    // The first few should have been dropped
    expect(g.spawnFlashes[0].x).toBe(3 * 100); // oldest remaining after 3 overflows
  });

  it('spawns particles at the flash location', () => {
    g.particles = [];
    createSpawnFlash(g, 50, 75);

    const particleCount = GAME_CONFIG.enemySpawnFlash.particleCount;
    expect(g.particles.length).toBe(particleCount);
    for (const p of g.particles) {
      expect(p.x).toBe(50);
      expect(p.y).toBe(75);
      expect(p.color).toBe(GAME_CONFIG.enemySpawnFlash.particleColor);
    }
  });

  it('handles null game state gracefully', () => {
    expect(() => createSpawnFlash(null, 0, 0)).not.toThrow();
  });

  it('handles missing spawnFlashes array', () => {
    delete g.spawnFlashes;
    expect(() => createSpawnFlash(g, 0, 0)).not.toThrow();
  });

  it('handles missing particles array', () => {
    delete g.particles;
    expect(() => createSpawnFlash(g, 0, 0)).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * updateSpawnFlashes
 * ────────────────────────────────────────────── */
describe('updateSpawnFlashes', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      spawnFlashes: [],
    });
  });

  it('expands ring radius over time', () => {
    g.spawnFlashes.push({
      x: 0, y: 0,
      radius: 0,
      maxRadius: 100,
      life: 0.5,
      maxLife: 0.5,
      color: 0xff0000,
      active: true,
    });

    updateSpawnFlashes(0.1, g);

    // After 0.1s of 0.5s total: progress = 0.2, radius = 100 * 0.2 = 20
    expect(g.spawnFlashes[0].radius).toBeCloseTo(20, 1);
  });

  it('decrements life and deactivates when expired', () => {
    g.spawnFlashes.push({
      x: 0, y: 0,
      radius: 0,
      maxRadius: 100,
      life: 0.2,
      maxLife: 0.2,
      color: 0xff0000,
      active: true,
    });

    updateSpawnFlashes(0.3, g);

    expect(g.spawnFlashes[0].active).toBe(false);
    expect(g.spawnFlashes[0].life).toBe(0);
  });

  it('skips inactive flashes', () => {
    g.spawnFlashes.push({
      x: 0, y: 0,
      radius: 50,
      maxRadius: 100,
      life: 0.5,
      maxLife: 0.5,
      color: 0xff0000,
      active: false,
    });

    updateSpawnFlashes(0.1, g);

    // Inactive flash should not be modified
    expect(g.spawnFlashes[0].radius).toBe(50);
    expect(g.spawnFlashes[0].life).toBe(0.5);
  });

  it('clamps radius to maxRadius', () => {
    g.spawnFlashes.push({
      x: 0, y: 0,
      radius: 0,
      maxRadius: 100,
      life: 0.5,
      maxLife: 0.5,
      color: 0xff0000,
      active: true,
    });

    // Advance past the full duration
    updateSpawnFlashes(1.0, g);

    expect(g.spawnFlashes[0].radius).toBeLessThanOrEqual(100);
  });

  it('handles null game state gracefully', () => {
    expect(() => updateSpawnFlashes(0.016, null)).not.toThrow();
  });

  it('handles missing spawnFlashes array', () => {
    delete g.spawnFlashes;
    expect(() => updateSpawnFlashes(0.016, g)).not.toThrow();
  });

  it('handles empty spawnFlashes array', () => {
    g.spawnFlashes = [];
    expect(() => updateSpawnFlashes(0.016, g)).not.toThrow();
  });

  it('handles flash with missing maxLife (fallback to life)', () => {
    g.spawnFlashes.push({
      x: 0, y: 0,
      radius: 0,
      maxRadius: 100,
      life: 0.5,
      color: 0xff0000,
      active: true,
      // No maxLife
    });

    expect(() => updateSpawnFlashes(0.1, g)).not.toThrow();
  });

  it('handles multiple flashes independently', () => {
    g.spawnFlashes.push(
      { x: 0, y: 0, radius: 0, maxRadius: 100, life: 0.5, maxLife: 0.5, color: 0xff0000, active: true },
      { x: 200, y: 200, radius: 0, maxRadius: 80, life: 0.3, maxLife: 0.3, color: 0x00ff00, active: true },
    );

    updateSpawnFlashes(0.1, g);

    // First flash: 0.1/0.5 = 0.2 progress → radius = 20
    expect(g.spawnFlashes[0].radius).toBeCloseTo(20, 1);
    // Second flash: 0.1/0.3 = 0.333 progress → radius = 26.67
    expect(g.spawnFlashes[1].radius).toBeCloseTo(26.67, 1);
  });
});

/* ──────────────────────────────────────────────
 * Integration: spawn flash lifecycle
 * ────────────────────────────────────────────── */
describe('spawn flash lifecycle', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      spawnFlashes: [],
      particles: [],
    });
  });

  it('full lifecycle: create → expand → expire', () => {
    const duration = GAME_CONFIG.enemySpawnFlash.duration;
    const maxRadius = GAME_CONFIG.enemySpawnFlash.maxRadius;

    // Create
    createSpawnFlash(g, 100, 100);
    expect(g.spawnFlashes.length).toBe(1);
    expect(g.spawnFlashes[0].radius).toBe(0);
    expect(g.spawnFlashes[0].active).toBe(true);

    // Halfway through
    updateSpawnFlashes(duration / 2, g);
    expect(g.spawnFlashes[0].radius).toBeCloseTo(maxRadius / 2, 0);
    expect(g.spawnFlashes[0].active).toBe(true);

    // Near end (just before expiry)
    updateSpawnFlashes(duration / 2 - 0.001, g);
    expect(g.spawnFlashes[0].active).toBe(true);

    // Past expiry
    updateSpawnFlashes(0.01, g);
    expect(g.spawnFlashes[0].active).toBe(false);
  });
});
