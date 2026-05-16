/**
 * hazardSetup.test.js — Environmental hazard initialization tests.
 *
 * Tests setupHazards and resetHazards from hazardSetup.js.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect } from 'vitest';
import { setupHazards, resetHazards } from '../engine/hazardSetup';
import { createTestState } from './helpers';
import { GAME_CONFIG } from '../constants/gameConfig';

/* ──────────────────────────────────────────────
 * setupHazards(g, level, hazardTypes)
 * ────────────────────────────────────────────── */
describe('setupHazards', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  /* ── asteroidField ── */
  describe('asteroidField', () => {
    it('creates multiple asteroids with type "asteroid"', () => {
      setupHazards(g, 1, ['asteroidField']);
      expect(g.hazards.length).toBeGreaterThan(0);
      for (const h of g.hazards) {
        expect(h.type).toBe('asteroid');
      }
    });

    it('level 1 produces countMin + scaled asteroids (round(5 + 10*1/20) = 6)', () => {
      setupHazards(g, 1, ['asteroidField']);
      // Formula: round(countMin + (countMax - countMin) * min(level/20, 1))
      // round(5 + 10 * 0.05) = round(5.5) = 6
      expect(g.hazards.length).toBe(6);
    });

    it('level 20 produces countMax asteroids (15)', () => {
      setupHazards(g, 20, ['asteroidField']);
      const cfg = GAME_CONFIG.environmentalHazards.asteroidField;
      expect(g.hazards.length).toBe(cfg.countMax); // 15
    });

    it('asteroid count scales linearly between level 1 and 20', () => {
      setupHazards(g, 10, ['asteroidField']);
      const cfg = GAME_CONFIG.environmentalHazards.asteroidField;
      // level 10: round(5 + (15 - 5) * 10/20) = round(5 + 5) = 10
      expect(g.hazards.length).toBe(10);
    });

    it('asteroid count caps at countMax for level > 20', () => {
      setupHazards(g, 50, ['asteroidField']);
      const cfg = GAME_CONFIG.environmentalHazards.asteroidField;
      expect(g.hazards.length).toBe(cfg.countMax); // 15
    });

    it('each asteroid has required properties', () => {
      setupHazards(g, 1, ['asteroidField']);
      const h = g.hazards[0];
      expect(h.id).toBeDefined();
      expect(h.type).toBe('asteroid');
      expect(h.active).toBe(true);
      expect(typeof h.x).toBe('number');
      expect(typeof h.y).toBe('number');
      expect(typeof h.radius).toBe('number');
      expect(typeof h.rotationSpeed).toBe('number');
      expect(typeof h.rotX).toBe('number');
      expect(typeof h.rotY).toBe('number');
    });

    it('asteroid radius is within config range', () => {
      setupHazards(g, 1, ['asteroidField']);
      const cfg = GAME_CONFIG.environmentalHazards.asteroidField;
      for (const h of g.hazards) {
        expect(h.radius).toBeGreaterThanOrEqual(cfg.radiusMin);
        expect(h.radius).toBeLessThanOrEqual(cfg.radiusMax);
      }
    });

    it('asteroids are spawned at varying positions', () => {
      setupHazards(g, 1, ['asteroidField']);
      const positions = g.hazards.map(h => `${h.x},${h.y}`);
      const uniquePositions = new Set(positions);
      // With random spread, positions should vary
      expect(uniquePositions.size).toBeGreaterThan(1);
    });
  });

  /* ── gravityWell ── */
  describe('gravityWell', () => {
    it('creates exactly 1 gravity well', () => {
      setupHazards(g, 1, ['gravityWell']);
      expect(g.hazards.length).toBe(1);
      expect(g.hazards[0].type).toBe('gravityWell');
    });

    it('gravity well has required properties', () => {
      setupHazards(g, 1, ['gravityWell']);
      const h = g.hazards[0];
      expect(h.id).toBeDefined();
      expect(h.type).toBe('gravityWell');
      expect(h.active).toBe(true);
      expect(typeof h.x).toBe('number');
      expect(typeof h.y).toBe('number');
      expect(typeof h.radius).toBe('number');
      expect(typeof h.pullStrength).toBe('number');
    });

    it('pullStrength scales with level', () => {
      setupHazards(g, 1, ['gravityWell']);
      const strengthL1 = g.hazards[0].pullStrength;

      setupHazards(g, 10, ['gravityWell']);
      const strengthL10 = g.hazards[0].pullStrength;

      setupHazards(g, 20, ['gravityWell']);
      const strengthL20 = g.hazards[0].pullStrength;

      const cfg = GAME_CONFIG.environmentalHazards.gravityWell;
      expect(strengthL1).toBe(cfg.pullStrength + 1 * 5);
      expect(strengthL10).toBe(cfg.pullStrength + 10 * 5);
      expect(strengthL20).toBe(cfg.pullStrength + 20 * 5);
    });

    it('pullRadius matches config', () => {
      setupHazards(g, 1, ['gravityWell']);
      const cfg = GAME_CONFIG.environmentalHazards.gravityWell;
      expect(g.hazards[0].radius).toBe(cfg.pullRadius);
    });
  });

  /* ── plasmaStorm ── */
  describe('plasmaStorm', () => {
    it('creates exactly 1 plasma storm', () => {
      setupHazards(g, 1, ['plasmaStorm']);
      expect(g.hazards.length).toBe(1);
      expect(g.hazards[0].type).toBe('plasmaStorm');
    });

    it('plasma storm has required properties', () => {
      setupHazards(g, 1, ['plasmaStorm']);
      const h = g.hazards[0];
      expect(h.id).toBeDefined();
      expect(h.type).toBe('plasmaStorm');
      expect(h.active).toBe(true);
      expect(typeof h.x).toBe('number');
      expect(typeof h.y).toBe('number');
      expect(typeof h.vx).toBe('number');
      expect(typeof h.vy).toBe('number');
      expect(typeof h.radius).toBe('number');
      expect(typeof h.timer).toBe('number');
      expect(typeof h.damagePerSecond).toBe('number');
      expect(h.respawning).toBe(false);
      expect(h.respawnTimer).toBe(0);
    });

    it('plasma storm spawns outside viewport (far from center)', () => {
      setupHazards(g, 1, ['plasmaStorm']);
      const h = g.hazards[0];
      const dist = Math.hypot(h.x, h.y);
      const cfg = GAME_CONFIG.environmentalHazards.plasmaStorm;
      // Should be at spawnSpread + 400 distance
      expect(dist).toBeGreaterThanOrEqual(cfg.spawnSpread + 400 - 100); // allow some tolerance
      expect(dist).toBeLessThanOrEqual(cfg.spawnSpread + 400 + 100);
    });

    it('plasma storm timer matches config duration', () => {
      setupHazards(g, 1, ['plasmaStorm']);
      const cfg = GAME_CONFIG.environmentalHazards.plasmaStorm;
      expect(g.hazards[0].timer).toBe(cfg.duration);
    });

    it('plasma storm damagePerSecond scales with level', () => {
      setupHazards(g, 1, ['plasmaStorm']);
      const dmgL1 = g.hazards[0].damagePerSecond;

      setupHazards(g, 10, ['plasmaStorm']);
      const dmgL10 = g.hazards[0].damagePerSecond;

      const cfg = GAME_CONFIG.environmentalHazards.plasmaStorm;
      expect(dmgL1).toBe(cfg.damagePerSecond + 1 * 2);
      expect(dmgL10).toBe(cfg.damagePerSecond + 10 * 2);
    });

    it('zoneRadius matches config', () => {
      setupHazards(g, 1, ['plasmaStorm']);
      const cfg = GAME_CONFIG.environmentalHazards.plasmaStorm;
      expect(g.hazards[0].radius).toBe(cfg.zoneRadius);
    });
  });

  /* ── empZone ── */
  describe('empZone', () => {
    it('creates exactly 1 EMP zone', () => {
      setupHazards(g, 1, ['empZone']);
      expect(g.hazards.length).toBe(1);
      expect(g.hazards[0].type).toBe('emp');
    });

    it('EMP zone has required properties', () => {
      setupHazards(g, 1, ['empZone']);
      const h = g.hazards[0];
      expect(h.id).toBeDefined();
      expect(h.type).toBe('emp');
      expect(h.active).toBe(true);
      expect(typeof h.x).toBe('number');
      expect(typeof h.y).toBe('number');
      expect(typeof h.radius).toBe('number');
      expect(typeof h.cooldown).toBe('number');
      expect(typeof h.timer).toBe('number');
      expect(typeof h.disableDuration).toBe('number');
      expect(h.empActive).toBe(0);
      expect(h.empTimer).toBe(0);
    });

    it('EMP radius matches config', () => {
      setupHazards(g, 1, ['empZone']);
      const cfg = GAME_CONFIG.environmentalHazards.empZone;
      expect(g.hazards[0].radius).toBe(cfg.radius);
    });

    it('EMP cooldown matches config', () => {
      setupHazards(g, 1, ['empZone']);
      const cfg = GAME_CONFIG.environmentalHazards.empZone;
      expect(g.hazards[0].cooldown).toBe(cfg.cooldown);
    });

    it('EMP timer starts at full cooldown', () => {
      setupHazards(g, 1, ['empZone']);
      const cfg = GAME_CONFIG.environmentalHazards.empZone;
      expect(g.hazards[0].timer).toBe(cfg.cooldown);
    });

    it('EMP disableDuration matches config', () => {
      setupHazards(g, 1, ['empZone']);
      const cfg = GAME_CONFIG.environmentalHazards.empZone;
      expect(g.hazards[0].disableDuration).toBe(cfg.disableDuration);
    });
  });

  /* ── multiple hazard types ── */
  describe('multiple hazard types', () => {
    it('creates all hazard types when multiple specified', () => {
      setupHazards(g, 1, ['asteroidField', 'gravityWell', 'plasmaStorm', 'empZone']);
      const types = g.hazards.map(h => h.type);
      expect(types).toContain('asteroid');
      expect(types).toContain('gravityWell');
      expect(types).toContain('plasmaStorm');
      expect(types).toContain('emp');
    });

    it('correct total count with all types at level 1', () => {
      setupHazards(g, 1, ['asteroidField', 'gravityWell', 'plasmaStorm', 'empZone']);
      // 6 asteroids + 1 gravityWell + 1 plasmaStorm + 1 emp = 9
      expect(g.hazards.length).toBe(9);
    });

    it('correct total count with all types at level 20', () => {
      setupHazards(g, 20, ['asteroidField', 'gravityWell', 'plasmaStorm', 'empZone']);
      // 15 asteroids + 1 gravityWell + 1 plasmaStorm + 1 emp = 18
      expect(g.hazards.length).toBe(18);
    });
  });

  /* ── edge cases ── */
  describe('edge cases', () => {
    it('empty hazardTypes array is no-op', () => {
      setupHazards(g, 1, []);
      expect(g.hazards.length).toBe(0);
    });

    it('null hazardTypes is no-op', () => {
      setupHazards(g, 1, null);
      expect(g.hazards.length).toBe(0);
    });

    it('undefined hazardTypes is no-op', () => {
      setupHazards(g, 1, undefined);
      expect(g.hazards.length).toBe(0);
    });

    it('unknown hazard type is silently ignored', () => {
      setupHazards(g, 1, ['unknownType']);
      expect(g.hazards.length).toBe(0);
    });

    it('setupHazards clears existing hazards before creating new ones', () => {
      g.hazards = [{ type: 'old' }];
      setupHazards(g, 1, ['empZone']);
      expect(g.hazards.length).toBe(1);
      expect(g.hazards[0].type).toBe('emp');
    });

    it('level 0 still creates hazards (clamped to minimum)', () => {
      setupHazards(g, 0, ['asteroidField']);
      // level 0: round(5 + 10 * 0) = 5 (countMin)
      expect(g.hazards.length).toBe(5);
    });
  });
});

/* ──────────────────────────────────────────────
 * resetHazards(g)
 * ────────────────────────────────────────────── */
describe('resetHazards', () => {
  it('clears g.hazards to empty array', () => {
    const g = createTestState();
    g.hazards = [
      { type: 'asteroid', active: true },
      { type: 'gravityWell', active: true },
    ];
    resetHazards(g);
    expect(g.hazards).toEqual([]);
  });

  it('resetHazards on already empty array is no-op', () => {
    const g = createTestState();
    resetHazards(g);
    expect(g.hazards).toEqual([]);
  });

  it('resetHazards replaces the array reference', () => {
    const g = createTestState();
    g.hazards = [{ type: 'test' }];
    const originalRef = g.hazards;
    resetHazards(g);
    expect(g.hazards).not.toBe(originalRef);
  });
});
