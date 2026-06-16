/**
 * Unit tests for combat.js — getNearestEnemy, fireProjectile, createParticles, killEnemy.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNearestEnemy, fireProjectile, createParticles, killEnemy } from '../engine/combat';
import { createTestState, createTestEnemy } from './helpers';
import { GAME_CONFIG } from '../constants/gameConfig';

// Mock SoundManager to prevent audio errors in test environment
vi.mock('../engine/audio', () => ({
  SoundManager: { play: vi.fn() },
}));

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

  it('missile type target is null when no active enemies exist', () => {
    g.enemies = [];
    fireProjectile(g, 0, 0, 0, 500, 10, 'missile');
    expect(g.projectiles[0].target).toBeNull();
  });

  it('missile type target is null when all enemies are inactive', () => {
    g.enemies = [createTestEnemy(10, 10)];
    g.enemies[0].active = false;
    fireProjectile(g, 0, 0, 0, 500, 10, 'missile');
    expect(g.projectiles[0].target).toBeNull();
  });

  it('missile type can target active bosses when no enemies exist', () => {
    g.enemies = [];
    g.boss = { ...g.boss, active: true, x: 100, y: 0, hp: 500, maxHp: 500 };
    fireProjectile(g, 0, 0, 0, 500, 10, 'missile');
    expect(g.projectiles[0].target).toBe(g.boss);
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

  it('sets proj.isCrit when synergyFlags.isCrit is true', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon', 0, { isCrit: true });
    expect(g.projectiles[0].isCrit).toBe(true);
  });

  it('does not set proj.isCrit when synergyFlags is undefined', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon');
    expect(g.projectiles[0].isCrit).toBeUndefined();
  });

  it('does not set proj.isCrit when synergyFlags.isCrit is false', () => {
    fireProjectile(g, 0, 0, 0, 500, 10, 'autocannon', 0, { isCrit: false });
    // Only truthy isCrit is stamped; false/undefined leaves it unset
    expect(g.projectiles[0].isCrit).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────
 * createParticles(g, x, y, color, count, type)
 * Delegates to createParticlesWithType — uses PARTICLE_TYPES config
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

  it('each particle has correct properties: vx, vy, vz, life, maxLife, color, active=true, type', () => {
    createParticles(g, 100, 200, 0x00ff00, 3);
    for (const p of g.particles) {
      expect(typeof p.vx).toBe('number');
      expect(typeof p.vy).toBe('number');
      expect(typeof p.vz).toBe('number');
      expect(p.life).toBe(0.6); // PARTICLE_TYPES.spark.life
      expect(p.maxLife).toBe(0.6);
      expect(p.color).toBe(0x00ff00);
      expect(p.active).toBe(true);
      expect(p.type).toBe('spark');
    }
  });

  it('particles spread in random directions (different angles)', () => {
    createParticles(g, 0, 0, 0xffffff, 20);
    const angles = g.particles.map(p => Math.atan2(p.vy, p.vx));
    const uniqueAngles = new Set(angles.map(a => Math.round(a * 1000)));
    expect(uniqueAngles.size).toBeGreaterThan(1);
  });

  it('particle life matches PARTICLE_TYPES.spark.life (via createParticlesWithType)', () => {
    createParticles(g, 0, 0, 0xffffff, 10);
    for (const p of g.particles) {
      expect(p.life).toBe(0.6);
      expect(p.maxLife).toBe(0.6);
    }
  });

  it('particle speed is within PARTICLE_TYPES.spark speed range (50-200)', () => {
    createParticles(g, 0, 0, 0xffffff, 50);
    for (const p of g.particles) {
      const speed = Math.hypot(p.vx, p.vy);
      expect(speed).toBeGreaterThanOrEqual(49);
      expect(speed).toBeLessThanOrEqual(201);
    }
  });

  it('particle vz is within expected range (negative to positive)', () => {
    createParticles(g, 0, 0, 0xffffff, 50);
    for (const p of g.particles) {
      const maxVz = 200; // PARTICLE_TYPES.spark.speedMax
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

/* ──────────────────────────────────────────────
 * killEnemy(g, e, completeMission)
 * ────────────────────────────────────────────── */
describe('killEnemy', () => {
  let g;
  let enemy;

  beforeEach(() => {
    g = createTestState({
      stats: { enemiesDestroyed: 0 },
      combo: { count: 0, timer: 0, multiplier: 1 },
      powerups: [],
      pickups: [],
      particles: [],
      mission: null,
    });
    enemy = createTestEnemy(100, 200);
  });

  it('sets e.active = false', () => {
    expect(enemy.active).toBe(true);
    killEnemy(g, enemy, null);
    expect(enemy.active).toBe(false);
  });

  it('increments g.stats.enemiesDestroyed', () => {
    expect(g.stats.enemiesDestroyed).toBe(0);
    killEnemy(g, enemy, null);
    expect(g.stats.enemiesDestroyed).toBe(1);
  });

  it('does not crash when g.stats is undefined', () => {
    delete g.stats;
    expect(() => killEnemy(g, enemy, null)).not.toThrow();
  });

  it('increments mission.current for kill type mission', () => {
    g.mission = { type: 'kill', current: 3, target: 5, completed: false };
    killEnemy(g, enemy, null);
    expect(g.mission.current).toBe(4);
  });

  it('calls completeMission when kill target reached', () => {
    g.mission = { type: 'kill', current: 4, target: 5, completed: false };
    const completeMission = vi.fn();
    killEnemy(g, enemy, completeMission);
    expect(completeMission).toHaveBeenCalled();
  });

  it('does not call completeMission when kill target not reached', () => {
    g.mission = { type: 'kill', current: 2, target: 5, completed: false };
    const completeMission = vi.fn();
    killEnemy(g, enemy, completeMission);
    expect(completeMission).not.toHaveBeenCalled();
  });

  it('increments mission.current for kill_elite with elite enemy type', () => {
    g.mission = { type: 'kill_elite', current: 0, target: 3, completed: false };
    const eliteEnemy = createTestEnemy(100, 200, 'missile_boat');
    killEnemy(g, eliteEnemy, null);
    expect(g.mission.current).toBe(1);
  });

  it('does not increment mission.current for kill_elite with non-elite type', () => {
    g.mission = { type: 'kill_elite', current: 0, target: 3, completed: false };
    const regularEnemy = createTestEnemy(100, 200, 'fighter');
    killEnemy(g, regularEnemy, null);
    expect(g.mission.current).toBe(0);
  });

  it('does not increment mission.current for kill_miniboss type', () => {
    g.mission = { type: 'kill_miniboss', current: 0, target: 1, completed: false };
    killEnemy(g, enemy, null);
    expect(g.mission.current).toBe(0);
  });

  it('calls completeMission with null completeMission does not crash', () => {
    g.mission = { type: 'kill', current: 4, target: 5, completed: false };
    expect(() => killEnemy(g, enemy, null)).not.toThrow();
  });

  it('creates particles at enemy position', () => {
    killEnemy(g, enemy, null);
    expect(g.particles.length).toBe(15);
    for (const p of g.particles) {
      expect(p.x).toBe(100);
      expect(p.y).toBe(200);
    }
  });

  it('particle color matches enemy color', () => {
    killEnemy(g, enemy, null);
    for (const p of g.particles) {
      expect(p.color).toBe(enemy.color);
    }
  });

  it('increments combo count', () => {
    expect(g.combo.count).toBe(0);
    killEnemy(g, enemy, null);
    expect(g.combo.count).toBe(1);
  });

  it('resets combo timer', () => {
    g.combo.timer = 0;
    killEnemy(g, enemy, null);
    expect(g.combo.timer).toBe(GAME_CONFIG.combo.timerDuration);
  });

  it('updates combo multiplier based on milestones', () => {
    g.combo.count = 4;
    killEnemy(g, enemy, null);
    // count becomes 5, which hits the 1.5x milestone
    expect(g.combo.count).toBe(5);
    expect(g.combo.multiplier).toBe(1.5);
  });

  it('combo multiplier at 10 count', () => {
    g.combo.count = 9;
    killEnemy(g, enemy, null);
    expect(g.combo.count).toBe(10);
    expect(g.combo.multiplier).toBe(2);
  });

  it('combo multiplier at 15 count', () => {
    g.combo.count = 14;
    killEnemy(g, enemy, null);
    expect(g.combo.count).toBe(15);
    expect(g.combo.multiplier).toBe(3);
  });

  it('does not crash when g.combo is undefined', () => {
    delete g.combo;
    expect(() => killEnemy(g, enemy, null)).not.toThrow();
  });

  it('creates scrap pickup at enemy position', () => {
    killEnemy(g, enemy, null);
    expect(g.pickups.length).toBe(1);
    expect(g.pickups[0].x).toBe(100);
    expect(g.pickups[0].y).toBe(200);
    expect(g.pickups[0].active).toBe(true);
    expect(g.pickups[0].radius).toBe(6);
  });

  it('scrap pickup value for fighter is 1', () => {
    const fighter = createTestEnemy(0, 0, 'fighter');
    killEnemy(g, fighter, null);
    expect(g.pickups[0].value).toBe(1);
  });

  it('scrap pickup value for heavy is 5', () => {
    const heavy = createTestEnemy(0, 0, 'heavy');
    killEnemy(g, heavy, null);
    expect(g.pickups[0].value).toBe(5);
  });

  it('scrap pickup value for interceptor is 2', () => {
    const interceptor = createTestEnemy(0, 0, 'interceptor');
    killEnemy(g, interceptor, null);
    expect(g.pickups[0].value).toBe(2);
  });

  it('scrap pickup value for unknown type is 1', () => {
    const unknown = createTestEnemy(0, 0, 'unknown');
    killEnemy(g, unknown, null);
    expect(g.pickups[0].value).toBe(1);
  });

  it('multiple kills accumulate pickups', () => {
    const e1 = createTestEnemy(0, 0);
    const e2 = createTestEnemy(50, 50);
    killEnemy(g, e1, null);
    killEnemy(g, e2, null);
    expect(g.pickups.length).toBe(2);
  });

  it('multiple kills accumulate stats', () => {
    const e1 = createTestEnemy(0, 0);
    const e2 = createTestEnemy(50, 50);
    const e3 = createTestEnemy(100, 100);
    killEnemy(g, e1, null);
    killEnemy(g, e2, null);
    killEnemy(g, e3, null);
    expect(g.stats.enemiesDestroyed).toBe(3);
  });

  it('power-up drops are possible (random chance)', () => {
    // Force the random check by running many kills to observe behavior
    // Note: dropChance is 0.05 so it's probabilistic
    // We test the mechanism, not the randomness
    const enemyForDrop = createTestEnemy(0, 0);
    killEnemy(g, enemyForDrop, null);
    // powerups array should either have 0 or 1 entry
    expect(g.powerups.length).toBeLessThanOrEqual(1);
    if (g.powerups.length > 0) {
      const pu = g.powerups[0];
      expect(pu.active).toBe(true);
      expect(pu.radius).toBe(10);
      expect(typeof pu.type).toBe('string');
    }
  });

  it('power-up has correct type from config', () => {
    // Run multiple kills to get a power-up drop
    let gotPowerup = false;
    for (let i = 0; i < 200; i++) {
      const e = createTestEnemy(0, 0);
      killEnemy(g, e, null);
      if (g.powerups.length > 0) {
        const pu = g.powerups[g.powerups.length - 1];
        const types = Object.keys(GAME_CONFIG.powerups.types);
        expect(types).toContain(pu.type);
        gotPowerup = true;
        break;
      }
    }
    expect(gotPowerup).toBe(true);
  });

  it('does not push power-up when g.powerups is undefined', () => {
    delete g.powerups;
    expect(() => killEnemy(g, enemy, null)).not.toThrow();
  });
});
