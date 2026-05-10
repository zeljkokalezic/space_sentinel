/**
 * Unit tests for combat.js — getNearestEnemy, fireProjectile, createParticles.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi } from 'vitest';
import { getNearestEnemy, fireProjectile, createParticles } from '../engine/combat';
import { createTestState, createTestEnemy } from './helpers';
import { GAME_CONFIG } from '../constants/gameConfig';

/* ──────────────────────────────────────────────
 * getNearestEnemy(x, y, enemies)
 * ────────────────────────────────────────────── */
describe('getNearestEnemy', () => {
  it('returns closest active enemy by Euclidean distance', () => {
    const enemies = [
      createTestEnemy(100, 0),
      createTestEnemy(30, 0),
      createTestEnemy(200, 0),
    ];
    const nearest = getNearestEnemy(0, 0, enemies);
    expect(nearest.x).toBe(30);
    expect(nearest.y).toBe(0);
  });

  it('skips inactive enemies (active=false)', () => {
    const enemies = [
      createTestEnemy(10, 0),
      createTestEnemy(50, 0),
    ];
    enemies[0].active = false;
    const nearest = getNearestEnemy(0, 0, enemies);
    expect(nearest.x).toBe(50);
  });

  it('returns null for empty enemy array', () => {
    expect(getNearestEnemy(0, 0, [])).toBeNull();
  });

  it('returns null when all enemies are inactive', () => {
    const enemies = [
      createTestEnemy(10, 0),
      createTestEnemy(20, 0),
    ];
    enemies.forEach(e => { e.active = false; });
    expect(getNearestEnemy(0, 0, enemies)).toBeNull();
  });

  it('returns single enemy when only one exists', () => {
    const enemy = createTestEnemy(42, 42);
    const nearest = getNearestEnemy(0, 0, [enemy]);
    expect(nearest).toBe(enemy);
  });

  it('handles enemies at same distance (returns first found)', () => {
    const enemies = [
      createTestEnemy(10, 0),
      createTestEnemy(0, 10),
    ];
    const nearest = getNearestEnemy(0, 0, enemies);
    expect(nearest.x).toBe(10);
    expect(nearest.y).toBe(0);
  });

  it('computes distance correctly in 2D (non-axis-aligned)', () => {
    const enemies = [
      createTestEnemy(6, 8),
      createTestEnemy(3, 4),
    ];
    const nearest = getNearestEnemy(0, 0, enemies);
    expect(nearest.x).toBe(3);
    expect(nearest.y).toBe(4);
  });

  it('works with negative coordinates', () => {
    const enemies = [
      createTestEnemy(-10, -10),
      createTestEnemy(-3, -3),
    ];
    const nearest = getNearestEnemy(0, 0, enemies);
    expect(nearest.x).toBe(-3);
    expect(nearest.y).toBe(-3);
  });
});

/* ──────────────────────────────────────────────
 * fireProjectile(g, x, y, angle, speed, damage, type, pierceCount)
 * ────────────────────────────────────────────── */
describe('fireProjectile', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  it('adds projectile to g.projectiles array', () => {
    expect(g.projectiles.length).toBe(0);
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    expect(g.projectiles.length).toBe(1);
  });

  it('projectile has correct velocity: vx=cos(angle)*speed, vy=sin(angle)*speed', () => {
    const angle = Math.PI / 4;
    const speed = 600;
    fireProjectile(g, 0, 0, angle, speed, 10, 'autocannon');
    const p = g.projectiles[0];
    expect(p.vx).toBeCloseTo(Math.cos(angle) * speed);
    expect(p.vy).toBeCloseTo(Math.sin(angle) * speed);
  });

  it('projectile velocity works at angle 0 (firing right)', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    const p = g.projectiles[0];
    expect(p.vx).toBeCloseTo(500);
    expect(p.vy).toBeCloseTo(0);
  });

  it('projectile velocity works at angle PI/2 (firing up)', () => {
    fireProjectile(g, 0, 0, Math.PI / 2, 500, 10, 'autocannon');
    const p = g.projectiles[0];
    expect(p.vx).toBeCloseTo(0);
    expect(p.vy).toBeCloseTo(500);
  });

  it('projectile velocity works at angle PI (firing left)', () => {
    fireProjectile(g, 0, 0, Math.PI, 500, 10, 'autocannon');
    const p = g.projectiles[0];
    expect(p.vx).toBeCloseTo(-500);
    expect(p.vy).toBeCloseTo(0);
  });

  it('projectile velocity works at angle -PI/4', () => {
    const angle = -Math.PI / 4;
    const speed = 400;
    fireProjectile(g, 0, 0, angle, speed, 10, 'autocannon');
    const p = g.projectiles[0];
    expect(p.vx).toBeCloseTo(Math.cos(angle) * speed);
    expect(p.vy).toBeCloseTo(Math.sin(angle) * speed);
  });

  it('projectile radius per type: plasma=12, missile=8, enemy_missile=8, default=5', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'plasma');
    expect(g.projectiles[0].radius).toBe(12);

    fireProjectile(g, 0, 0, 0, 500, 10, 'missile');
    expect(g.projectiles[1].radius).toBe(8);

    fireProjectile(g, 0, 0, 0, 500, 10, 'enemy_missile');
    expect(g.projectiles[2].radius).toBe(8);

    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    expect(g.projectiles[3].radius).toBe(5);

    fireProjectile(g, 0, 0, 0, 500, 10, 'enemy_bullet');
    expect(g.projectiles[4].radius).toBe(5);

    fireProjectile(g, 0, 0, 0, 500, 10, 'unknown_type');
    expect(g.projectiles[5].radius).toBe(5);
  });

  it('missile type sets target to a random active enemy (or undefined if none)', () => {
    const enemy1 = createTestEnemy(100, 100);
    const enemy2 = createTestEnemy(200, 200);
    const enemyInactive = createTestEnemy(50, 50);
    enemyInactive.active = false;

    g.enemies = [enemy1, enemy2, enemyInactive];

    fireProjectile(g, 0, 0, 0, 500, 10, 'missile');
    const p = g.projectiles[0];
    expect(p.target).toBeDefined();
    expect([enemy1, enemy2]).toContain(p.target);
    expect(p.target).not.toBe(enemyInactive);
  });

  it('missile type target is undefined when no active enemies exist', () => {
    g.enemies = [];
    fireProjectile(g, 0, 0, 0, 500, 10, 'missile');
    expect(g.projectiles[0].target).toBeUndefined();
  });

  it('missile type target is undefined when all enemies are inactive', () => {
    g.enemies = [createTestEnemy(10, 10)];
    g.enemies[0].active = false;
    fireProjectile(g, 0, 0, 0, 500, 10, 'missile');
    expect(g.projectiles[0].target).toBeUndefined();
  });

  it('enemy_missile type sets target to g.player', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'enemy_missile');
    expect(g.projectiles[0].target).toBe(g.player);
  });

  it('isEnemy flag: true for types starting with "enemy", false otherwise', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'enemy_bullet');
    expect(g.projectiles[0].isEnemy).toBe(true);

    fireProjectile(g, 0, 0, 0, 500, 10, 'enemy_missile');
    expect(g.projectiles[1].isEnemy).toBe(true);

    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    expect(g.projectiles[2].isEnemy).toBe(false);

    fireProjectile(g, 0, 0, 0, 500, 10, 'plasma');
    expect(g.projectiles[3].isEnemy).toBe(false);

    fireProjectile(g, 0, 0, 0, 500, 10, 'missile');
    expect(g.projectiles[4].isEnemy).toBe(false);
  });

  it('pierce defaults to 0 when not specified', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    expect(g.projectiles[0].pierce).toBe(0);
  });

  it('pierce is set when pierceCount is provided', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon', 3);
    expect(g.projectiles[0].pierce).toBe(3);
  });

  it('hitList starts as empty array', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    expect(Array.isArray(g.projectiles[0].hitList)).toBe(true);
    expect(g.projectiles[0].hitList.length).toBe(0);
  });

  it('projectile life starts at 0', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    expect(g.projectiles[0].life).toBe(0);
  });

  it('projectile is active on creation', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    expect(g.projectiles[0].active).toBe(true);
  });

  it('projectile stores correct origin position', () => {
    fireProjectile(g, 100, 200, 0, 500, 10, 'autocannon');
    expect(g.projectiles[0].x).toBe(100);
    expect(g.projectiles[0].y).toBe(200);
  });

  it('projectile stores correct damage value', () => {
    fireProjectile(g, 0, 0, 0, 500, 25, 'autocannon');
    expect(g.projectiles[0].damage).toBe(25);
  });

  it('projectile stores correct type', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'plasma');
    expect(g.projectiles[0].type).toBe('plasma');
  });

  it('multiple projectiles are independent objects', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    fireProjectile(g, 50, 50, Math.PI / 2, 600, 20, 'plasma');
    expect(g.projectiles.length).toBe(2);
    expect(g.projectiles[0]).not.toBe(g.projectiles[1]);
    expect(g.projectiles[0].x).toBe(0);
    expect(g.projectiles[1].x).toBe(50);
  });
});

/* ──────────────────────────────────────────────
 * createParticles(g, x, y, color, count)
 * ────────────────────────────────────────────── */
describe('createParticles', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  it('creates exactly count particles in g.particles', () => {
    expect(g.particles.length).toBe(0);
    createParticles(g, 0, 0, 0xff0000, 5);
    expect(g.particles.length).toBe(5);
  });

  it('creates zero particles when count is 0', () => {
    createParticles(g, 0, 0, 0xff0000, 0);
    expect(g.particles.length).toBe(0);
  });

  it('each particle has correct properties: vx, vy, vz, life, maxLife, color, active=true', () => {
    createParticles(g, 100, 200, 0x00ff00, 3);
    for (const p of g.particles) {
      expect(typeof p.vx).toBe('number');
      expect(typeof p.vy).toBe('number');
      expect(typeof p.vz).toBe('number');
      expect(p.life).toBe(GAME_CONFIG.particles.life);
      expect(p.maxLife).toBe(GAME_CONFIG.particles.life);
      expect(p.color).toBe(0x00ff00);
      expect(p.active).toBe(true);
    }
  });

  it('particles spread in random directions (different angles)', () => {
    createParticles(g, 0, 0, 0xffffff, 20);
    const angles = g.particles.map(p => Math.atan2(p.vy, p.vx));
    const uniqueAngles = new Set(angles.map(a => Math.round(a * 1000)));
    expect(uniqueAngles.size).toBeGreaterThan(1);
  });

  it('particle life matches GAME_CONFIG.particles.life', () => {
    createParticles(g, 0, 0, 0xffffff, 10);
    for (const p of g.particles) {
      expect(p.life).toBe(GAME_CONFIG.particles.life);
      expect(p.maxLife).toBe(GAME_CONFIG.particles.life);
    }
  });

  it('particle speed is within GAME_CONFIG.particles speed range', () => {
    createParticles(g, 0, 0, 0xffffff, 50);
    for (const p of g.particles) {
      const speed = Math.hypot(p.vx, p.vy);
      expect(speed).toBeGreaterThanOrEqual(GAME_CONFIG.particles.speedMin - 1);
      expect(speed).toBeLessThanOrEqual(GAME_CONFIG.particles.speedMax + 1);
    }
  });

  it('particle vz is within expected range (negative to positive)', () => {
    createParticles(g, 0, 0, 0xffffff, 50);
    for (const p of g.particles) {
      const maxVz = GAME_CONFIG.particles.speedMax;
      expect(p.vz).toBeGreaterThanOrEqual(-maxVz);
      expect(p.vz).toBeLessThanOrEqual(maxVz);
    }
  });

  it('particles are placed at correct origin (x, y)', () => {
    createParticles(g, 42, 99, 0xffffff, 5);
    for (const p of g.particles) {
      expect(p.x).toBe(42);
      expect(p.y).toBe(99);
    }
  });

  it('multiple calls accumulate particles', () => {
    createParticles(g, 0, 0, 0xff0000, 3);
    createParticles(g, 0, 0, 0x00ff00, 4);
    expect(g.particles.length).toBe(7);
  });

  it('particles from different calls have different colors', () => {
    createParticles(g, 0, 0, 0xff0000, 3);
    createParticles(g, 0, 0, 0x0000ff, 3);
    const reds = g.particles.slice(0, 3);
    const blues = g.particles.slice(3, 6);
    for (const p of reds) expect(p.color).toBe(0xff0000);
    for (const p of blues) expect(p.color).toBe(0x0000ff);
  });
});
