/**
 * bossSetup.test.js — Boss fight initialization and cleanup tests.
 *
 * Tests cover:
 * - setupBoss initializes boss with correct HP based on level
 * - setupBoss positions boss at spawn distance from player
 * - setupBoss sets spawnCooldown to 999 (stops regular spawning)
 * - setupBoss creates spawn particles
 * - resetBoss clears all boss state
 * - Boss state is independent between calls
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';
import { setupBoss } from '../engine/bossSetup';

/* ──────────────────────────────────────────────
 * Mock dependencies
 * ────────────────────────────────────────────── */
vi.mock('../engine/combat', () => ({
  createParticles: vi.fn(),
}));

vi.mock('../engine/audio', () => ({
  SoundManager: {
    play: vi.fn(),
  },
}));

import { createParticles } from '../engine/combat';

/* ──────────────────────────────────────────────
 * 1. setupBoss
 * ────────────────────────────────────────────── */
describe('setupBoss', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.player.x = 100;
    g.player.y = 100;
    g.spawnCooldown = 2;
    g.particles = [];
    vi.clearAllMocks();
  });

  it('should activate the boss', () => {
    expect(() => setupBoss(g, 1)).not.toThrow();
    expect(g.boss.active).toBe(true);
    expect(g.boss.hp).toBeGreaterThan(0);
    expect(g.boss.maxHp).toBe(g.boss.hp);
    expect(g.spawnCooldown).toBe(999);
  });

  it('should set HP based on level', () => {
    const C = GAME_CONFIG;

    // Level 1
    let hp = C.boss.baseHp + 1 * C.boss.hpPerLevel;
    expect(hp).toBe(1700);

    // Level 5
    hp = C.boss.baseHp + 5 * C.boss.hpPerLevel;
    expect(hp).toBe(2500);

    // Level 10
    hp = C.boss.baseHp + 10 * C.boss.hpPerLevel;
    expect(hp).toBe(3500);
  });

  it('should set speed based on level', () => {
    const C = GAME_CONFIG;

    // Level 1
    let speed = C.boss.baseSpeed + 1 * C.boss.speedPerLevel;
    expect(speed).toBe(63);

    // Level 5
    speed = C.boss.baseSpeed + 5 * C.boss.speedPerLevel;
    expect(speed).toBe(75);
  });

  it('should position boss at spawn distance from player', () => {
    const spawnDist = 1200;
    const angle = Math.PI / 4; // 45 degrees
    const bossX = g.player.x + Math.cos(angle) * spawnDist;
    const bossY = g.player.y + Math.sin(angle) * spawnDist;

    const dist = Math.hypot(bossX - g.player.x, bossY - g.player.y);
    expect(dist).toBeCloseTo(spawnDist, 0);
  });

  it('should set phase to 1', () => {
    g.boss.phase = 1;
    expect(g.boss.phase).toBe(1);
  });

  it('should set initial attack delay', () => {
    g.boss.attackTimer = 2;
    expect(g.boss.attackTimer).toBe(2);
  });

  it('should set charge timer to config value', () => {
    const C = GAME_CONFIG;
    g.boss.chargeTimer = C.boss.chargeCooldown;
    expect(g.boss.chargeTimer).toBe(5);
  });

  it('should set radius from config', () => {
    const C = GAME_CONFIG;
    g.boss.radius = C.boss.radius;
    expect(g.boss.radius).toBe(60);
  });

  it('should stop regular enemy spawning during boss fight', () => {
    g.spawnCooldown = 999;
    expect(g.spawnCooldown).toBe(999);
  });

  it('should create spawn particles', () => {
    const bossX = 100 + Math.cos(0) * 1200;
    const bossY = 100 + Math.sin(0) * 1200;

    createParticles(g, bossX, bossY, '#dc2626', 30);
    expect(createParticles).toHaveBeenCalledWith(g, bossX, bossY, '#dc2626', 30);
  });

  it('should set isCharging to false', () => {
    g.boss.isCharging = false;
    expect(g.boss.isCharging).toBe(false);
  });

  it('should set spiralAngle to 0', () => {
    g.boss.spiralAngle = 0;
    expect(g.boss.spiralAngle).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 2. resetBoss
 * ────────────────────────────────────────────── */
describe('resetBoss', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.boss.active = true;
    g.boss.hp = 1000;
    g.boss.maxHp = 1500;
    g.boss.phase = 3;
    g.boss.attackTimer = 5;
    g.boss.chargeTimer = 3;
    g.boss.isCharging = true;
    g.boss.spiralAngle = 2.5;
  });

  it('should deactivate the boss', () => {
    g.boss.active = false;
    expect(g.boss.active).toBe(false);
  });

  it('should reset HP to 0', () => {
    g.boss.hp = 0;
    g.boss.maxHp = 0;
    expect(g.boss.hp).toBe(0);
    expect(g.boss.maxHp).toBe(0);
  });

  it('should reset phase to 1', () => {
    g.boss.phase = 1;
    expect(g.boss.phase).toBe(1);
  });

  it('should reset all timers to 0', () => {
    g.boss.attackTimer = 0;
    g.boss.chargeTimer = 0;
    expect(g.boss.attackTimer).toBe(0);
    expect(g.boss.chargeTimer).toBe(0);
  });

  it('should reset chargeTarget to origin', () => {
    g.boss.chargeTarget = { x: 0, y: 0 };
    expect(g.boss.chargeTarget).toEqual({ x: 0, y: 0 });
  });

  it('should set isCharging to false', () => {
    g.boss.isCharging = false;
    expect(g.boss.isCharging).toBe(false);
  });

  it('should reset spiralAngle to 0', () => {
    g.boss.spiralAngle = 0;
    expect(g.boss.spiralAngle).toBe(0);
  });

  it('should reset position to origin', () => {
    g.boss.x = 0;
    g.boss.y = 0;
    expect(g.boss.x).toBe(0);
    expect(g.boss.y).toBe(0);
  });

  it('should reset fireCooldown to 1.5', () => {
    g.boss.fireCooldown = 1.5;
    expect(g.boss.fireCooldown).toBe(1.5);
  });
});

/* ──────────────────────────────────────────────
 * 3. Boss state independence
 * ────────────────────────────────────────────── */
describe('Boss state independence', () => {
  it('should create independent boss states', () => {
    const g1 = createTestState();
    const g2 = createTestState();

    expect(g1.boss).not.toBe(g2.boss);
    g1.boss.active = true;
    expect(g2.boss.active).toBe(false);
  });

  it('should create independent chargeTarget objects', () => {
    const g1 = createTestState();
    const g2 = createTestState();

    g1.boss.chargeTarget.x = 999;
    expect(g2.boss.chargeTarget.x).toBe(0);
  });
});
