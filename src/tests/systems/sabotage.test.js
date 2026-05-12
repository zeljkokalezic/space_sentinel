/**
 * sabotage.test.js — Sabotage mission system tests.
 *
 * Tests structure firing, player projectile collision, structure destruction,
 * enemy targeting bias, and mission completion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateSabotage } from '../../engine/systems/sabotage';
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createTestState } from '../helpers';

// Mock window for node environment
beforeEach(() => {
  globalThis.window = { innerWidth: 1920, innerHeight: 1080 };
});

/* ──────────────────────────────────────────────
 * Helper: create a game state with sabotage active
 * ────────────────────────────────────────────── */
function createSabotageState(overrides = {}) {
  const structOverride = overrides.structures || [];
  const defaultStructures = structOverride.length
    ? structOverride
    : [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }];

  const missionOverride = overrides.mission || {};
  const defaultMission = {
    type: 'sabotage',
    current: 0,
    target: defaultStructures.length,
    completed: false,
    ...missionOverride,
  };

  return createTestState({
    sabotage: {
      active: true,
      structures: defaultStructures,
      ...overrides.sabotage,
    },
    mission: defaultMission,
    player: { x: 0, y: 0, radius: 38, ...overrides.player },
    projectiles: overrides.projectiles || [],
    enemies: overrides.enemies || [],
    particles: overrides.particles || [],
    effects: overrides.effects || [],
    pickups: overrides.pickups || [],
  });
}

/* ──────────────────────────────────────────────
 * 1. Early return conditions
 * ────────────────────────────────────────────── */
describe('early return conditions', () => {
  it('returns false when sabotage is not active', () => {
    const g = createTestState({
      sabotage: { active: false, structures: [] },
    });
    const result = updateSabotage(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });

  it('returns false when mission is completed', () => {
    const g = createSabotageState({
      mission: { completed: true },
    });
    const result = updateSabotage(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 2. Structure firing at player
 * ────────────────────────────────────────────── */
describe('structure firing at player', () => {
  it('structure fires projectile at player when cooldown expires', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 0, // ready to fire
        active: true,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.projectiles.length).toBeGreaterThan(0);
    const proj = g.projectiles[0];
    expect(proj.isEnemy).toBe(true);
    expect(proj.active).toBe(true);
  });

  it('structure does not fire when cooldown has not expired', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 5.0,
        active: true,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.projectiles.length).toBe(0);
  });

  it('fired projectile aims toward player position', () => {
    const g = createSabotageState({
      player: { x: 0, y: 0, radius: 38 },
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 0,
        active: true,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    const proj = g.projectiles[0];
    // Projectile should be heading left (negative vx) toward player at origin
    expect(proj.vx).toBeLessThan(0);
    expect(proj.vy).toBeCloseTo(0, 0);
  });

  it('fire cooldown resets after firing', () => {
    const cfg = GAME_CONFIG.sabotage;
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 0,
        active: true,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.sabotage.structures[0].fireCooldown).toBe(cfg.fireCooldown);
  });

  it('structure projectile damage scales with difficulty multiplier', () => {
    const cfg = GAME_CONFIG.sabotage;
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 0,
        active: true,
      }],
    });

    updateSabotage(0.1, g, 2.5, vi.fn(), vi.fn());

    const proj = g.projectiles[0];
    expect(proj.damage).toBe(cfg.projectileDamage * 2.5);
  });
});

/* ──────────────────────────────────────────────
 * 3. Player projectile collision with structures
 * ────────────────────────────────────────────── */
describe('player projectile collision with structures', () => {
  it('structure hp decreases when hit by player projectile', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.sabotage.structures[0].hp).toBe(75);
  });

  it('hit projectile is deactivated', () => {
    const proj = {
      x: 200, y: 0,
      vx: 100, vy: 0,
      active: true, isEnemy: false,
      damage: 25,
      radius: 5,
    };
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [proj],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(proj.active).toBe(false);
  });

  it('enemy projectiles do not damage structures', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: true,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.sabotage.structures[0].hp).toBe(100);
  });

  it('inactive projectiles do not damage structures', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: false, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.sabotage.structures[0].hp).toBe(100);
  });

  it('projectile outside structure radius does not hit', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 500, y: 0, // far away
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.sabotage.structures[0].hp).toBe(100);
  });
});

/* ──────────────────────────────────────────────
 * 4. Structure destruction
 * ────────────────────────────────────────────── */
describe('structure destruction', () => {
  it('structure becomes inactive when hp reaches 0', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 25, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.sabotage.structures[0].active).toBe(false);
  });

  it('particles are created on structure destruction', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 25, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('scrap pickup is dropped on structure destruction', () => {
    const cfg = GAME_CONFIG.sabotage;
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 25, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.pickups.length).toBeGreaterThan(0);
    expect(g.pickups[0].scrap).toBe(cfg.scrapPerDestroy);
    expect(g.pickups[0].active).toBe(true);
  });

  it('damage effect is pushed on hit', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.effects.length).toBeGreaterThan(0);
    expect(g.effects[0].type).toBe('dmg');
    expect(g.effects[0].text).toBe('25');
  });

  it('particles are created on hit (even if structure survives)', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.particles.length).toBeGreaterThan(0);
  });
});

/* ──────────────────────────────────────────────
 * 5. Mission completion
 * ────────────────────────────────────────────── */
describe('mission completion', () => {
  it('mission completes when all structures are destroyed', () => {
    const completeFn = vi.fn();
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 25, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    // First frame: projectile hits structure, destroying it
    updateSabotage(0.1, g, 1, completeFn, vi.fn());
    expect(completeFn).not.toHaveBeenCalled(); // alive check runs before collision

    // Second frame: no alive structures => mission complete
    updateSabotage(0.1, g, 1, completeFn, vi.fn());

    expect(completeFn).toHaveBeenCalled();
    expect(g.mission.current).toBe(g.mission.target);
  });

  it('mission does not complete when structures remain', () => {
    const completeFn = vi.fn();
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, completeFn, vi.fn());

    expect(completeFn).not.toHaveBeenCalled();
  });

  it('mission completes when all structures already inactive', () => {
    const completeFn = vi.fn();
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 0, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: false,
      }],
    });

    updateSabotage(0.1, g, 1, completeFn, vi.fn());

    expect(completeFn).toHaveBeenCalled();
  });

  it('returns false on mission completion (not gameover)', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 25, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    const result = updateSabotage(0.1, g, 1, vi.fn(), vi.fn());

    expect(result).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 6. Enemy targeting bias
 * ────────────────────────────────────────────── */
describe('enemy targeting bias toward structures', () => {
  it('enemy within protectRadius targets nearest structure', () => {
    const cfg = GAME_CONFIG.sabotage;
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      enemies: [{
        x: 180, y: 0, // close to structure at (200, 0)
        active: true,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.enemies[0].targetX).toBe(200);
    expect(g.enemies[0].targetY).toBe(0);
  });

  it('enemy outside protectRadius targets player', () => {
    const cfg = GAME_CONFIG.sabotage;
    // Structure at (200, 0), protectRadius=250 => enemy must be >250 from (200,0)
    // Place enemy at (600, 0) which is 400 units from structure
    const g = createSabotageState({
      player: { x: 0, y: 0, radius: 38 },
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      enemies: [{
        x: 600, y: 0, // 400 units from structure (> protectRadius of 250)
        active: true,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.enemies[0].targetX).toBe(0);
    expect(g.enemies[0].targetY).toBe(0);
  });

  it('inactive enemies are skipped', () => {
    const g = createSabotageState({
      structures: [{
        x: 200, y: 0,
        hp: 100, maxHp: 100,
        radius: 30,
        fireCooldown: 2.0,
        active: true,
      }],
      enemies: [{
        x: 180, y: 0,
        active: false,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    // Inactive enemy should not have target set
    expect(g.enemies[0].targetX).toBeUndefined();
    expect(g.enemies[0].targetY).toBeUndefined();
  });

  it('enemy targets nearest structure when multiple exist', () => {
    const g = createSabotageState({
      structures: [
        { x: 200, y: 0, hp: 100, maxHp: 100, radius: 30, fireCooldown: 2.0, active: true },
        { x: -200, y: 0, hp: 100, maxHp: 100, radius: 30, fireCooldown: 2.0, active: true },
      ],
      enemies: [{
        x: 180, y: 0, // closer to structure at (200, 0)
        active: true,
      }],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.enemies[0].targetX).toBe(200);
    expect(g.enemies[0].targetY).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 7. Multiple structures
 * ────────────────────────────────────────────── */
describe('multiple structures', () => {
  it('multiple structures all fire when cooldowns expire', () => {
    const g = createSabotageState({
      structures: [
        { x: 200, y: 0, hp: 100, maxHp: 100, radius: 30, fireCooldown: 0, active: true },
        { x: -200, y: 0, hp: 100, maxHp: 100, radius: 30, fireCooldown: 0, active: true },
      ],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.projectiles.length).toBe(2);
  });

  it('only active structures fire', () => {
    const g = createSabotageState({
      structures: [
        { x: 200, y: 0, hp: 100, maxHp: 100, radius: 30, fireCooldown: 0, active: true },
        { x: -200, y: 0, hp: 100, maxHp: 100, radius: 30, fireCooldown: 0, active: false },
      ],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.projectiles.length).toBe(1);
  });

  it('only active structures with hp > 0 fire', () => {
    const g = createSabotageState({
      structures: [
        { x: 200, y: 0, hp: 100, maxHp: 100, radius: 30, fireCooldown: 0, active: true },
        { x: -200, y: 0, hp: 0, maxHp: 100, radius: 30, fireCooldown: 0, active: true },
      ],
    });

    updateSabotage(0.1, g, 1, vi.fn());

    expect(g.projectiles.length).toBe(1);
  });

  it('destroying one structure does not complete mission if others remain', () => {
    const completeFn = vi.fn();
    const g = createSabotageState({
      structures: [
        { x: 200, y: 0, hp: 25, maxHp: 100, radius: 30, fireCooldown: 2.0, active: true },
        { x: -200, y: 0, hp: 100, maxHp: 100, radius: 30, fireCooldown: 2.0, active: true },
      ],
      projectiles: [{
        x: 200, y: 0,
        vx: 100, vy: 0,
        active: true, isEnemy: false,
        damage: 25,
        radius: 5,
      }],
    });

    updateSabotage(0.1, g, 1, completeFn, vi.fn());

    expect(completeFn).not.toHaveBeenCalled();
    expect(g.sabotage.structures[0].active).toBe(false);
    expect(g.sabotage.structures[1].active).toBe(true);
  });
});
