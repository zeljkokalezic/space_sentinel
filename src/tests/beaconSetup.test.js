/**
 * beaconSetup.test.js — Tests for beaconSetup.js setup/reset functions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setupBeacon, resetBeacon } from '../engine/beaconSetup';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';

describe('setupBeacon', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  it('activates beacon state', () => {
    expect(g.beacon.active).toBe(false);
    setupBeacon(g, 1);
    expect(g.beacon.active).toBe(true);
  });

  it('sets beacon hp to baseHp + level * hpPerLevel', () => {
    const cfg = GAME_CONFIG.beacon;
    setupBeacon(g, 1);
    expect(g.beacon.hp).toBe(cfg.baseHp + 1 * cfg.hpPerLevel);
    expect(g.beacon.maxHp).toBe(cfg.baseHp + 1 * cfg.hpPerLevel);
  });

  it('beacon hp equals maxHp on setup', () => {
    setupBeacon(g, 5);
    expect(g.beacon.hp).toBe(g.beacon.maxHp);
  });

  it('beacon hp scales with level', () => {
    const cfg = GAME_CONFIG.beacon;
    setupBeacon(g, 1);
    const hp1 = g.beacon.hp;

    setupBeacon(g, 10);
    const hp10 = g.beacon.hp;

    expect(hp10).toBeGreaterThan(hp1);
    expect(hp10).toBe(cfg.baseHp + 10 * cfg.hpPerLevel);
  });

  it('beacon hp at level 25', () => {
    const cfg = GAME_CONFIG.beacon;
    setupBeacon(g, 25);
    expect(g.beacon.hp).toBe(cfg.baseHp + 25 * cfg.hpPerLevel);
    expect(g.beacon.maxHp).toBe(cfg.baseHp + 25 * cfg.hpPerLevel);
  });

  it('beacon position is offset from player by spawnSpread', () => {
    g.player.x = 100;
    g.player.y = 200;
    setupBeacon(g, 1);
    const dist = Math.hypot(g.beacon.x - 100, g.beacon.y - 200);
    expect(dist).toBeCloseTo(GAME_CONFIG.beacon.spawnSpread, 0);
  });

  it('beacon spawns at random angle around player', () => {
    g.player.x = 0;
    g.player.y = 0;
    setupBeacon(g, 1);
    // Beacon should not be at player position
    expect(g.beacon.x).not.toBe(0);
    expect(g.beacon.y).not.toBe(0);
  });

  it('beacon radius matches config', () => {
    setupBeacon(g, 1);
    expect(g.beacon.radius).toBe(GAME_CONFIG.beacon.radius);
  });

  it('beacon color preserved from state', () => {
    setupBeacon(g, 1);
    expect(g.beacon.color).toBe(0x22d3ee);
  });

  it('multiple setups at different levels produce different hp', () => {
    setupBeacon(g, 1);
    const hp1 = g.beacon.hp;

    setupBeacon(g, 5);
    expect(g.beacon.hp).toBeGreaterThan(hp1);

    setupBeacon(g, 20);
    expect(g.beacon.hp).toBeGreaterThan(g.beacon.maxHp - 1); // should equal maxHp
  });

  it('beacon position is within spawnSpread tolerance', () => {
    const cfg = GAME_CONFIG.beacon;
    g.player.x = 500;
    g.player.y = 300;
    setupBeacon(g, 1);
    const dist = Math.hypot(g.beacon.x - 500, g.beacon.y - 300);
    expect(dist).toBeGreaterThanOrEqual(cfg.spawnSpread - 1);
    expect(dist).toBeLessThanOrEqual(cfg.spawnSpread + 1);
  });

  it('beacon setup does not modify player position', () => {
    g.player.x = 100;
    g.player.y = 200;
    setupBeacon(g, 1);
    expect(g.player.x).toBe(100);
    expect(g.player.y).toBe(200);
  });

  it('beacon setup does not affect other state', () => {
    g.scrap = 500;
    g.level = 5;
    setupBeacon(g, 1);
    expect(g.scrap).toBe(500);
    expect(g.level).toBe(5);
  });
});

describe('resetBeacon', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  it('deactivates beacon state', () => {
    setupBeacon(g, 1);
    expect(g.beacon.active).toBe(true);
    resetBeacon(g);
    expect(g.beacon.active).toBe(false);
  });

  it('clears beacon hp', () => {
    setupBeacon(g, 1);
    expect(g.beacon.hp).toBeGreaterThan(0);
    resetBeacon(g);
    expect(g.beacon.hp).toBe(0);
  });

  it('clears beacon maxHp', () => {
    setupBeacon(g, 1);
    expect(g.beacon.maxHp).toBeGreaterThan(0);
    resetBeacon(g);
    expect(g.beacon.maxHp).toBe(0);
  });

  it('works when beacon is already inactive', () => {
    expect(g.beacon.active).toBe(false);
    resetBeacon(g);
    expect(g.beacon.active).toBe(false);
    expect(g.beacon.hp).toBe(0);
    expect(g.beacon.maxHp).toBe(0);
  });

  it('reset does not modify player position', () => {
    g.player.x = 100;
    g.player.y = 200;
    setupBeacon(g, 1);
    resetBeacon(g);
    expect(g.player.x).toBe(100);
    expect(g.player.y).toBe(200);
  });

  it('reset does not affect other state', () => {
    g.scrap = 500;
    setupBeacon(g, 1);
    resetBeacon(g);
    expect(g.scrap).toBe(500);
  });

  it('setup after reset works correctly', () => {
    setupBeacon(g, 1);
    resetBeacon(g);
    setupBeacon(g, 5);
    expect(g.beacon.active).toBe(true);
    expect(g.beacon.hp).toBeGreaterThan(0);
  });
});
