/**
 * Unit tests for systems/pickups.js — updatePickups(dt, g, completeMission)
 *
 * Covers: magnet attraction, pickup collection, magnet range scaling,
 * scrap accumulation, inactive pickup skipping, collect-mission tracking,
 * and multi-pickup frames.
 *
 * Run:  npm run test:run -- src/tests/systems/pickups.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePickups } from '../../engine/systems/pickups';
import { createTestState, createTestPickup } from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

/* ──────────────────────────────────────────────
 * Shared helpers
 * ────────────────────────────────────────────── */
const noop = vi.fn();

/**
 * Compute the effective magnet radius for a given game state.
 */
function getMagnetRadius(g) {
  return g.player.magnetRadius + (g.levels.magnet - 1) * GAME_CONFIG.magnet.radiusPerLevel;
}

/* ──────────────────────────────────────────────
 * 1. Magnet attraction — pickups within range move toward player
 * ────────────────────────────────────────────── */
describe('magnet attraction — pickups within range move toward player', () => {
  it('pickup inside magnet range moves closer to player', () => {
    const g = createTestState();
    // Magnet radius at level 1 = 150 + 0 = 150. Place pickup at 100 px away.
    const pickup = createTestPickup(100, 0);
    g.pickups = [pickup];
    const dt = 0.1;

    const distBefore = Math.hypot(pickup.x - g.player.x, pickup.y - g.player.y);

    updatePickups(dt, g, noop);

    const distAfter = Math.hypot(pickup.x - g.player.x, pickup.y - g.player.y);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('pickup moves by pullSpeed * dt toward player along the correct angle', () => {
    const g = createTestState();
    // Place pickup directly to the right of player
    const pickup = createTestPickup(100, 0);
    g.pickups = [pickup];
    const dt = 0.1;

    updatePickups(dt, g, noop);

    // angle = 0, so cos(0)=1, sin(0)=0 — moves purely left along X
    const expectedDelta = GAME_CONFIG.magnet.pullSpeed * dt;
    expect(pickup.x).toBeCloseTo(100 - expectedDelta);
    expect(pickup.y).toBeCloseTo(0);
  });

  it('pickup moves diagonally toward player', () => {
    const g = createTestState();
    const pickup = createTestPickup(80, 80);
    g.pickups = [pickup];
    const dt = 0.1;

    updatePickups(dt, g, noop);

    const angle = Math.atan2(g.player.y - 80, g.player.x - 80);
    const expectedDelta = GAME_CONFIG.magnet.pullSpeed * dt;
    expect(pickup.x).toBeCloseTo(80 + Math.cos(angle) * expectedDelta);
    expect(pickup.y).toBeCloseTo(80 + Math.sin(angle) * expectedDelta);
  });

  it('pickup on the negative side moves toward player', () => {
    const g = createTestState();
    const pickup = createTestPickup(-100, -50);
    g.pickups = [pickup];
    const dt = 0.1;

    const distBefore = Math.hypot(pickup.x, pickup.y);

    updatePickups(dt, g, noop);

    const distAfter = Math.hypot(pickup.x - g.player.x, pickup.y - g.player.y);
    expect(distAfter).toBeLessThan(distBefore);
  });
});

/* ──────────────────────────────────────────────
 * 2. Pickups outside magnet range are not affected
 * ────────────────────────────────────────────── */
describe('pickups outside magnet range are not affected', () => {
  it('pickup beyond magnet radius does not move', () => {
    const g = createTestState();
    // Magnet radius = 150. Place pickup at 200 px away.
    const pickup = createTestPickup(200, 0);
    const startX = pickup.x;
    const startY = pickup.y;
    g.pickups = [pickup];

    updatePickups(0.1, g, noop);

    expect(pickup.x).toBe(startX);
    expect(pickup.y).toBe(startY);
  });

  it('pickup exactly at magnet radius does not move (strict < check)', () => {
    const g = createTestState();
    // Magnet radius = 150. Place pickup exactly at 150.
    const pickup = createTestPickup(150, 0);
    const startX = pickup.x;
    g.pickups = [pickup];

    updatePickups(0.1, g, noop);

    // dist == 150, condition is dist < currentMagnet, so not attracted
    expect(pickup.x).toBe(startX);
  });

  it('pickup well beyond magnet radius is unaffected', () => {
    const g = createTestState();
    const pickup = createTestPickup(1000, 0);
    const startX = pickup.x;
    const startY = pickup.y;
    g.pickups = [pickup];

    updatePickups(0.1, g, noop);

    expect(pickup.x).toBe(startX);
    expect(pickup.y).toBe(startY);
  });
});

/* ──────────────────────────────────────────────
 * 3. Pickup collection — scrap is added on collision
 * ────────────────────────────────────────────── */
describe('pickup collection — scrap added on collision', () => {
  it('collecting a pickup adds its value to g.scrap', () => {
    const g = createTestState();
    // Place pickup so close it will collide after being pulled one frame.
    // player.radius = 38, pickup.radius = 6, collision threshold = 44.
    // Put pickup at 40 px away — inside magnet range, close enough to collide.
    const pickup = createTestPickup(40, 0, 5);
    g.pickups = [pickup];
    const initialScrap = g.scrap;

    updatePickups(0.1, g, noop);

    expect(g.scrap).toBe(initialScrap + 5);
  });

  it('collecting a pickup also adds to g.totalScrapEarned', () => {
    const g = createTestState();
    const pickup = createTestPickup(40, 0, 10);
    g.pickups = [pickup];
    const initialTotal = g.totalScrapEarned;

    updatePickups(0.1, g, noop);

    expect(g.totalScrapEarned).toBe(initialTotal + 10);
  });

  it('pickup with value 1 adds 1 scrap', () => {
    const g = createTestState();
    const pickup = createTestPickup(40, 0, 1);
    g.pickups = [pickup];
    const initialScrap = g.scrap;

    updatePickups(0.1, g, noop);

    expect(g.scrap).toBe(initialScrap + 1);
  });

  it('pickup with high value adds that amount', () => {
    const g = createTestState();
    const pickup = createTestPickup(40, 0, 50);
    g.pickups = [pickup];
    const initialScrap = g.scrap;

    updatePickups(0.1, g, noop);

    expect(g.scrap).toBe(initialScrap + 50);
  });
});

/* ──────────────────────────────────────────────
 * 4. Collected pickups become inactive
 * ────────────────────────────────────────────── */
describe('collected pickups become inactive', () => {
  it('pickup marked inactive after collection', () => {
    const g = createTestState();
    const pickup = createTestPickup(40, 0, 1);
    g.pickups = [pickup];

    updatePickups(0.1, g, noop);

    expect(pickup.active).toBe(false);
  });

  it('inactive pickup is not processed on subsequent frames', () => {
    const g = createTestState();
    const pickup = createTestPickup(40, 0, 5);
    g.pickups = [pickup];
    const initialScrap = g.scrap;

    // First frame: pickup collected
    updatePickups(0.1, g, noop);
    expect(pickup.active).toBe(false);
    expect(g.scrap).toBe(initialScrap + 5);

    // Second frame: should not collect again
    updatePickups(0.1, g, noop);
    expect(g.scrap).toBe(initialScrap + 5); // unchanged
  });

  it('inactive pickup retains its position (not moved)', () => {
    const g = createTestState();
    const pickup = createTestPickup(100, 0, 1);
    pickup.active = false;
    g.pickups = [pickup];

    updatePickups(0.1, g, noop);

    expect(pickup.x).toBe(100);
    expect(pickup.y).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 5. Magnet range scales with magnet level
 * ────────────────────────────────────────────── */
describe('magnet range scales with magnet level', () => {
  it('magnet level 1 uses base magnetRadius', () => {
    const g = createTestState();
    g.levels.magnet = 1;
    const radius = getMagnetRadius(g);
    expect(radius).toBe(150); // 150 + (1-1)*35 = 150
  });

  it('magnet level 2 adds radiusPerLevel', () => {
    const g = createTestState();
    g.levels.magnet = 2;
    const radius = getMagnetRadius(g);
    expect(radius).toBe(185); // 150 + 1*35
  });

  it('magnet level 5 has significantly larger range', () => {
    const g = createTestState();
    g.levels.magnet = 5;
    const radius = getMagnetRadius(g);
    expect(radius).toBe(290); // 150 + 4*35
  });

  it('pickup outside base range but inside upgraded range is attracted', () => {
    const g = createTestState();
    g.levels.magnet = 3; // radius = 150 + 2*35 = 220
    // Place pickup at 200 — outside base 150 but inside 220
    const pickup = createTestPickup(200, 0);
    g.pickups = [pickup];

    updatePickups(0.1, g, noop);

    // Should have moved toward player
    expect(pickup.x).toBeLessThan(200);
  });

  it('pickup outside upgraded range is not attracted', () => {
    const g = createTestState();
    g.levels.magnet = 2; // radius = 185
    const pickup = createTestPickup(200, 0);
    const startX = pickup.x;
    g.pickups = [pickup];

    updatePickups(0.1, g, noop);

    expect(pickup.x).toBe(startX);
  });
});

/* ──────────────────────────────────────────────
 * 6. Multiple pickups in one frame
 * ────────────────────────────────────────────── */
describe('multiple pickups in one frame', () => {
  it('all pickups within range are attracted', () => {
    const g = createTestState();
    const p1 = createTestPickup(80, 0);
    const p2 = createTestPickup(0, 80);
    const p3 = createTestPickup(-60, 0);
    g.pickups = [p1, p2, p3];

    updatePickups(0.1, g, noop);

    // All three should have moved closer
    expect(Math.hypot(p1.x, p1.y)).toBeLessThan(80);
    expect(Math.hypot(p2.x, p2.y)).toBeLessThan(80);
    expect(Math.hypot(p3.x, p3.y)).toBeLessThan(60);
  });

  it('multiple pickups can be collected in one frame', () => {
    const g = createTestState();
    const p1 = createTestPickup(40, 0, 3);
    const p2 = createTestPickup(0, 40, 7);
    g.pickups = [p1, p2];
    const initialScrap = g.scrap;

    updatePickups(0.1, g, noop);

    expect(g.scrap).toBe(initialScrap + 3 + 7);
    expect(p1.active).toBe(false);
    expect(p2.active).toBe(false);
  });

  it('mix of in-range and out-of-range pickups', () => {
    const g = createTestState();
    // Place in-range pickup at 140 — inside magnet range (150) but after pulling 50px
    // it lands at ~90, still well above collision threshold (44).
    const inRange = createTestPickup(140, 0, 5);
    const outOfRange = createTestPickup(300, 0, 10);
    g.pickups = [inRange, outOfRange];
    const initialScrap = g.scrap;

    updatePickups(0.1, g, noop);

    // In-range pickup moved
    expect(Math.hypot(inRange.x, inRange.y)).toBeLessThan(140);
    // Out-of-range pickup unchanged
    expect(outOfRange.x).toBe(300);
    expect(outOfRange.y).toBe(0);
    // No scrap collected (in-range pickup didn't collide in one frame)
    expect(g.scrap).toBe(initialScrap);
  });

  it('only active pickups are processed among mixed set', () => {
    const g = createTestState();
    const active = createTestPickup(80, 0, 1);
    const inactive = createTestPickup(80, 50, 1);
    inactive.active = false;
    g.pickups = [active, inactive];

    updatePickups(0.1, g, noop);

    expect(Math.hypot(active.x, active.y)).toBeLessThan(80);
    expect(inactive.x).toBe(80);
    expect(inactive.y).toBe(50);
  });
});

/* ──────────────────────────────────────────────
 * 7. Collect mission tracking
 * ────────────────────────────────────────────── */
describe('collect mission tracking', () => {
  it('collecting pickup increments mission.current', () => {
    const g = createTestState();
    g.mission = { type: 'collect', target: 10, current: 3 };
    const pickup = createTestPickup(40, 0, 2);
    g.pickups = [pickup];

    updatePickups(0.1, g, noop);

    expect(g.mission.current).toBe(5);
  });

  it('completeMission called when mission target reached', () => {
    const completeMission = vi.fn();
    const g = createTestState();
    g.mission = { type: 'collect', target: 5, current: 3 };
    const pickup = createTestPickup(40, 0, 2);
    g.pickups = [pickup];

    updatePickups(0.1, g, completeMission);

    expect(completeMission).toHaveBeenCalledTimes(1);
  });

  it('completeMission not called when target not yet reached', () => {
    const completeMission = vi.fn();
    const g = createTestState();
    g.mission = { type: 'collect', target: 10, current: 3 };
    const pickup = createTestPickup(40, 0, 2);
    g.pickups = [pickup];

    updatePickups(0.1, g, completeMission);

    expect(completeMission).not.toHaveBeenCalled();
  });

  it('completeMission not called for non-collect missions', () => {
    const completeMission = vi.fn();
    const g = createTestState();
    g.mission = { type: 'escort', target: 10, current: 0 };
    const pickup = createTestPickup(40, 0, 2);
    g.pickups = [pickup];

    updatePickups(0.1, g, completeMission);

    expect(completeMission).not.toHaveBeenCalled();
  });

  it('completeMission not called when mission is null', () => {
    const completeMission = vi.fn();
    const g = createTestState();
    g.mission = null;
    const pickup = createTestPickup(40, 0, 2);
    g.pickups = [pickup];

    updatePickups(0.1, g, completeMission);

    expect(completeMission).not.toHaveBeenCalled();
  });

  it('completeMission called when multiple pickups push over target', () => {
    const completeMission = vi.fn();
    const g = createTestState();
    g.mission = { type: 'collect', target: 8, current: 2 };
    const p1 = createTestPickup(40, 0, 3);
    const p2 = createTestPickup(0, 40, 4);
    g.pickups = [p1, p2];

    updatePickups(0.1, g, completeMission);

    // After p1: current = 5 (not >= 8). After p2: current = 9 (>= 8).
    expect(completeMission).toHaveBeenCalledTimes(1);
    expect(g.mission.current).toBe(9);
  });
});

/* ──────────────────────────────────────────────
 * 8. Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  it('empty pickups array does nothing', () => {
    const g = createTestState();
    g.pickups = [];
    const initialScrap = g.scrap;

    updatePickups(0.1, g, noop);

    expect(g.scrap).toBe(initialScrap);
    expect(noop).not.toHaveBeenCalled();
  });

  it('pickup at player position is collected immediately', () => {
    const g = createTestState();
    // Place pickup very close to player — after being pulled toward player,
    // it will be well within collision threshold (player.radius + pickup.radius = 44).
    const pickup = createTestPickup(30, 0, 3);
    g.pickups = [pickup];
    const initialScrap = g.scrap;

    updatePickups(0.1, g, noop);

    expect(g.scrap).toBe(initialScrap + 3);
    expect(pickup.active).toBe(false);
  });

  it('dt of 0 does not move pickups', () => {
    const g = createTestState();
    const pickup = createTestPickup(100, 0);
    g.pickups = [pickup];

    updatePickups(0, g, noop);

    expect(pickup.x).toBe(100);
    expect(pickup.y).toBe(0);
  });

  it('large dt moves pickup farther but may overshoot into collection', () => {
    const g = createTestState();
    // Pull speed = 500, dt = 0.1 => 50 px move. Pickup at 50 px.
    // After moving 50 px toward player (at 0,0), pickup reaches origin, collides.
    const pickup = createTestPickup(50, 0, 1);
    g.pickups = [pickup];
    const initialScrap = g.scrap;

    updatePickups(0.1, g, noop);

    // Pickup moved to player and was collected
    expect(pickup.active).toBe(false);
    expect(g.scrap).toBe(initialScrap + 1);
  });

  it('player magnetRadius override affects attraction', () => {
    const g = createTestState();
    g.player.magnetRadius = 50;
    // Pickup at 30 — inside 50 range
    const inside = createTestPickup(30, 0);
    // Pickup at 80 — outside 50 range
    const outside = createTestPickup(80, 0);
    g.pickups = [inside, outside];

    updatePickups(0.1, g, noop);

    expect(Math.hypot(inside.x, inside.y)).toBeLessThan(30);
    expect(outside.x).toBe(80);
  });
});
