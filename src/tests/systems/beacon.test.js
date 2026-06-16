/**
 * beacon.test.js — Beacon defense system tests.
 *
 * Tests enemy projectile collision, ramming, beacon destruction,
 * enemy targeting, and gameover on beacon death.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateBeacon } from '../../engine/systems/beaconSystem';
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createTestState, createTestEnemy, createTestProjectile } from '../helpers';
import { setupLocalStorageMock, clearLocalStorageMock } from '../helpers';

// Mock window for node environment
beforeEach(() => {
  globalThis.window = { innerWidth: 1920, innerHeight: 1080 };
});

/* ──────────────────────────────────────────────
 * Helper: create a game state with beacon active
 * ────────────────────────────────────────────── */
function createBeaconState(overrides = {}) {
  const missionOverride = overrides.mission || {};
  const defaultMission = {
    type: 'defend',
    current: 0,
    target: 30,
    completed: false,
    ...missionOverride,
  };

  const beaconOverride = overrides.beacon || {};
  const defaultBeacon = {
    active: true,
    x: 400,
    y: 0,
    hp: 250,
    maxHp: 250,
    radius: 30,
    color: 0x22d3ee,
    ...beaconOverride,
  };

  return createTestState({
    beacon: defaultBeacon,
    mission: defaultMission,
    player: { x: 0, y: 0, radius: 38, ...overrides.player },
    projectiles: overrides.projectiles || [],
    enemies: overrides.enemies || [],
    particles: overrides.particles || [],
    effects: overrides.effects || [],
  });
}

/* ──────────────────────────────────────────────
 * 1. Early return conditions
 * ────────────────────────────────────────────── */
describe('early return conditions', () => {
  it('returns false when beacon is not active', () => {
    const g = createTestState({
      beacon: { active: false },
      mission: { completed: false },
    });
    const result = updateBeacon(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });

  it('returns false when beacon is missing', () => {
    const g = createTestState();
    g.beacon = null;
    g.mission = { completed: false };
    const result = updateBeacon(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });

  it('returns false when mission is completed', () => {
    const g = createBeaconState({
      mission: { completed: true },
    });
    const result = updateBeacon(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 2. Enemy projectile collision with beacon
 * ────────────────────────────────────────────── */
describe('enemy projectile collision with beacon', () => {
  it('beacon hp decreases when hit by enemy projectile', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(240); // 250 - 10 * 1
  });

  it('hit projectile is deactivated', () => {
    const proj = {
      x: 200, y: 0,
      vx: 100, vy: 0,
      active: true, isEnemy: true,
      damage: 10,
      radius: 5,
    };
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [proj],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(proj.active).toBe(false);
  });

  it('damage scales with difficulty multiplier', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 2.5, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(225); // 250 - 10 * 2.5
  });

  it('player projectiles do not damage beacon', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(250);
  });

  it('inactive projectiles do not damage beacon', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: false, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(250);
  });

  it('projectile outside beacon radius does not hit', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 500, y: 0, // far away
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(250);
  });

  it('particles are created on projectile hit', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('damage effect is pushed on projectile hit', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.effects.length).toBeGreaterThan(0);
    expect(g.effects[0].type).toBe('dmg');
  });
});

/* ──────────────────────────────────────────────
 * 3. Enemy ramming beacon
 * ────────────────────────────────────────────── */
describe('enemy ramming beacon', () => {
  it('beacon and enemy both take damage on ram', () => {
    const enemy = createTestEnemy(200, 0);
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      enemies: [enemy],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(235); // 250 - 15
    expect(enemy.hp).toBe(10); // 30 - 20
  });

  it('ram has cooldown — second tick within cooldown does not deal damage', () => {
    const enemy = createTestEnemy(200, 0);
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      enemies: [enemy],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());
    const hpAfterFirst = g.beacon.hp;

    updateBeacon(0.05, g, 1, vi.fn(), vi.fn()); // within cooldown

    expect(g.beacon.hp).toBe(hpAfterFirst);
  });

  it('ram deals damage again after cooldown expires', () => {
    const enemy = createTestEnemy(200, 0);
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      enemies: [enemy],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());
    const hpAfterFirst = g.beacon.hp;

    // Wait for cooldown to expire (1.0s)
    updateBeacon(1.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBeLessThan(hpAfterFirst);
  });

  it('inactive enemy does not ram beacon', () => {
    const enemy = createTestEnemy(200, 0);
    enemy.active = false;
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      enemies: [enemy],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(250);
  });

  it('enemy outside beacon radius does not ram', () => {
    const enemy = createTestEnemy(500, 0);
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      enemies: [enemy],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(250);
  });
});

/* ──────────────────────────────────────────────
 * 4. Beacon destroyed — game over
 * ────────────────────────────────────────────── */
describe('beacon destroyed', () => {
  it('beacon hp <= 0 triggers gameover', () => {
    const setGameState = vi.fn();
    const g = createBeaconState({
      beacon: { hp: 5, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    const result = updateBeacon(0.1, g, 1, vi.fn(), setGameState);

    expect(result).toBe(true);
    expect(setGameState).toHaveBeenCalledWith('gameover');
  });

  it('beacon becomes inactive on destruction', () => {
    const g = createBeaconState({
      beacon: { hp: 5, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.active).toBe(false);
  });

  it('explosion particles spawned on beacon destruction', () => {
    const g = createBeaconState({
      beacon: { hp: 5, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.particles.length).toBeGreaterThanOrEqual(20); // 20 explosion + hit particles
  });

  it('returns true on gameover (signals stop)', () => {
    const g = createBeaconState({
      beacon: { hp: 5, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    const result = updateBeacon(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * 5. Enemy targeting
 * ────────────────────────────────────────────── */
describe('enemy targeting', () => {
  it('enemy within defenseRadius targets beacon', () => {
    const cfg = GAME_CONFIG.beacon;
    const enemy = createTestEnemy(200, 0); // close to beacon at 400,0
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 400, y: 0, radius: 30 },
      enemies: [enemy],
      player: { x: -500, y: 0, radius: 38 },
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(enemy.targetX).toBe(400);
    expect(enemy.targetY).toBe(0);
  });

  it('enemy outside defenseRadius targets player', () => {
    const cfg = GAME_CONFIG.beacon;
    const enemy = createTestEnemy(-500, 0); // far from beacon
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 400, y: 0, radius: 30 },
      enemies: [enemy],
      player: { x: 0, y: 0, radius: 38 },
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(enemy.targetX).toBe(0);
    expect(enemy.targetY).toBe(0);
  });

  it('inactive enemy is skipped in targeting', () => {
    const enemy = createTestEnemy(200, 0);
    enemy.active = false;
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 400, y: 0, radius: 30 },
      enemies: [enemy],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    // Should not crash; no targetX/targetY set on inactive enemy
    expect(enemy.targetX).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────
 * 6. Multiple enemies and projectiles
 * ────────────────────────────────────────────── */
describe('multiple entities', () => {
  it('multiple enemy projectiles all hit beacon', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [
        { x: 200, y: 0, vx: 100, vy: 0, active: true, isEnemy: true, damage: 10, radius: 5 },
        { x: 200, y: 0, vx: -100, vy: 0, active: true, isEnemy: true, damage: 10, radius: 5 },
      ],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(230); // 250 - 10*1 - 10*1
  });

  it('only active projectiles hit', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [
        { x: 200, y: 0, vx: 100, vy: 0, active: true, isEnemy: true, damage: 10, radius: 5 },
        { x: 200, y: 0, vx: -100, vy: 0, active: false, isEnemy: true, damage: 10, radius: 5 },
      ],
    });

    updateBeacon(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.beacon.hp).toBe(240); // only 1 hit
  });

  it('returns false when beacon survives', () => {
    const g = createBeaconState({
      beacon: { hp: 250, maxHp: 250, x: 200, y: 0, radius: 30 },
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 10,
        radius: 5,
      }],
    });

    const result = updateBeacon(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });
});
