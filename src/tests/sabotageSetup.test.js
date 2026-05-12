/**
 * sabotageSetup.test.js — Tests for sabotageSetup.js setup/reset functions.
 */

import { describe, it, expect } from 'vitest';
import { setupSabotage, resetSabotage } from '../engine/sabotageSetup';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';

describe('setupSabotage', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  it('activates sabotage state', () => {
    expect(g.sabotage.active).toBe(false);
    setupSabotage(g, 1);
    expect(g.sabotage.active).toBe(true);
  });

  it('creates structures array with expected count at level 1', () => {
    setupSabotage(g, 1);
    expect(g.sabotage.structures.length).toBe(GAME_CONFIG.sabotage.baseStructures);
  });

  it('structure count scales with level', () => {
    const cfg = GAME_CONFIG.sabotage;
    // Level 1 => baseStructures + 0 = 3
    setupSabotage(g, 1);
    expect(g.sabotage.structures.length).toBe(cfg.baseStructures);

    // Level 4 => baseStructures + 2*1 = 5
    setupSabotage(g, 4);
    expect(g.sabotage.structures.length).toBe(cfg.baseStructures + cfg.structuresPer2Levels * 2);
  });

  it('structure count is capped at maxStructures', () => {
    const cfg = GAME_CONFIG.sabotage;
    // Level 20 => baseStructures + 10*1 = 13, capped at 8
    setupSabotage(g, 20);
    expect(g.sabotage.structures.length).toBeLessThanOrEqual(cfg.maxStructures);
  });

  it('each structure has required properties', () => {
    setupSabotage(g, 1);
    const s = g.sabotage.structures[0];
    expect(s).toHaveProperty('x');
    expect(s).toHaveProperty('y');
    expect(s).toHaveProperty('hp');
    expect(s).toHaveProperty('maxHp');
    expect(s).toHaveProperty('radius');
    expect(s).toHaveProperty('fireCooldown');
    expect(s).toHaveProperty('active');
    expect(s.active).toBe(true);
  });

  it('structure hp equals maxHp on setup', () => {
    setupSabotage(g, 1);
    for (const s of g.sabotage.structures) {
      expect(s.hp).toBe(s.maxHp);
    }
  });

  it('structure hp scales with level', () => {
    const cfg = GAME_CONFIG.sabotage;
    setupSabotage(g, 1);
    const hp1 = g.sabotage.structures[0].hp;

    setupSabotage(g, 10);
    const hp10 = g.sabotage.structures[0].hp;

    expect(hp10).toBeGreaterThan(hp1);
    expect(hp10).toBe(cfg.structureHp + 10 * cfg.hpPerLevel);
  });

  it('structure radius matches config', () => {
    const cfg = GAME_CONFIG.sabotage;
    setupSabotage(g, 1);
    for (const s of g.sabotage.structures) {
      expect(s.radius).toBe(cfg.structureRadius);
    }
  });

  it('structure fireCooldown matches config', () => {
    const cfg = GAME_CONFIG.sabotage;
    setupSabotage(g, 1);
    for (const s of g.sabotage.structures) {
      expect(s.fireCooldown).toBe(cfg.fireCooldown);
    }
  });

  it('structures are spawned in a ring around player', () => {
    const cfg = GAME_CONFIG.sabotage;
    setupSabotage(g, 1);
    for (const s of g.sabotage.structures) {
      const dist = Math.hypot(s.x - g.player.x, s.y - g.player.y);
      expect(dist).toBeGreaterThanOrEqual(cfg.spawnSpreadMin - 1);
      expect(dist).toBeLessThanOrEqual(cfg.spawnSpreadMax + 1);
    }
  });

  it('structures are spawned relative to player position', () => {
    g.player.x = 500;
    g.player.y = 300;
    setupSabotage(g, 1);
    for (const s of g.sabotage.structures) {
      const dx = s.x - 500;
      const dy = s.y - 300;
      const dist = Math.hypot(dx, dy);
      expect(dist).toBeGreaterThanOrEqual(GAME_CONFIG.sabotage.spawnSpreadMin - 1);
      expect(dist).toBeLessThanOrEqual(GAME_CONFIG.sabotage.spawnSpreadMax + 1);
    }
  });

  it('multiple structures have different positions', () => {
    setupSabotage(g, 4);
    const positions = g.sabotage.structures.map(s => `${s.x.toFixed(0)},${s.y.toFixed(0)}`);
    // All positions should be unique (very unlikely to collide with random spread)
    expect(new Set(positions).size).toBe(positions.length);
  });
});

describe('resetSabotage', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  it('deactivates sabotage state', () => {
    setupSabotage(g, 1);
    expect(g.sabotage.active).toBe(true);
    resetSabotage(g);
    expect(g.sabotage.active).toBe(false);
  });

  it('clears structures array', () => {
    setupSabotage(g, 1);
    expect(g.sabotage.structures.length).toBeGreaterThan(0);
    resetSabotage(g);
    expect(g.sabotage.structures.length).toBe(0);
  });

  it('works when sabotage is already inactive', () => {
    expect(g.sabotage.active).toBe(false);
    resetSabotage(g);
    expect(g.sabotage.active).toBe(false);
    expect(g.sabotage.structures.length).toBe(0);
  });
});
