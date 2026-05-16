/**
 * environmentalHazards.test.js — Environmental hazard simulation tests.
 *
 * Tests updateEnvironmentalHazards for asteroid, gravityWell, plasmaStorm, and emp.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateEnvironmentalHazards } from '../../engine/systems/environmentalHazards';
import { createTestState, createTestEnemy, createTestProjectile } from '../helpers';

// Mock SoundManager to prevent audio errors in test environment
vi.mock('../../engine/audio', () => ({
  SoundManager: { play: vi.fn() },
}));

/* ──────────────────────────────────────────────
 * 1. Early return conditions
 * ────────────────────────────────────────────── */
describe('early return conditions', () => {
  it('returns false when g.hazards is empty', () => {
    const g = createTestState({ hazards: [] });
    const result = updateEnvironmentalHazards(0.1, g);
    expect(result).toBe(false);
  });

  it('returns false when g.hazards is null', () => {
    const g = createTestState();
    g.hazards = null;
    const result = updateEnvironmentalHazards(0.1, g);
    expect(result).toBe(false);
  });

  it('returns false when g.hazards is undefined', () => {
    const g = createTestState();
    delete g.hazards;
    const result = updateEnvironmentalHazards(0.1, g);
    expect(result).toBe(false);
  });

  it('returns false when no player', () => {
    const g = createTestState({
      hazards: [{ type: 'asteroid', active: true, x: 0, y: 0, radius: 20 }],
    });
    g.player = null;
    const result = updateEnvironmentalHazards(0.1, g);
    expect(result).toBe(false);
  });

  it('returns false when g is null', () => {
    const result = updateEnvironmentalHazards(0.1, null);
    expect(result).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 2. Asteroid collision tests
 * ────────────────────────────────────────────── */
describe('asteroid collision', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      player: { x: 0, y: 0, vx: 100, vy: 0, radius: 38 },
    });
  });

  it('player pushed back when colliding with asteroid', () => {
    const asteroidRadius = 20;
    // Place asteroid so player overlaps it
    // player at (0,0) with radius 38, asteroid at (40, 0) with radius 20
    // distance = 40, minDist = 58, overlap = 18
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 40, y: 0, radius: asteroidRadius,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];

    const origX = g.player.x;
    updateEnvironmentalHazards(0.1, g);

    // Player should be pushed away from asteroid (in -x direction)
    expect(g.player.x).toBeLessThan(origX);
  });

  it('player not pushed when outside asteroid radius', () => {
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 500, y: 0, radius: 20,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];

    const origX = g.player.x;
    updateEnvironmentalHazards(0.1, g);

    expect(g.player.x).toBe(origX);
  });

  it('player velocity dampened on collision', () => {
    g.player.vx = 100;
    g.player.vy = 0;
    // Asteroid to the right of player, player moving toward it
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 40, y: 0, radius: 20,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    // Velocity should be reduced (dampened)
    expect(g.player.vx).toBeLessThan(100);
  });

  it('enemies pushed back when colliding with asteroid', () => {
    // Enemy at (20, 0) with radius 15, asteroid at (0, 0) with radius 20
    // distance = 20, minDist = 35, overlap = 15 => push enemy in +x direction
    const enemy = createTestEnemy(20, 0);
    g.enemies = [enemy];
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 0, y: 0, radius: 20,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];

    const origX = enemy.x;
    updateEnvironmentalHazards(0.1, g);

    // Enemy should be pushed away from asteroid (in +x direction)
    expect(enemy.x).toBeGreaterThan(origX);
  });

  it('inactive enemies are skipped by asteroid', () => {
    const enemy = createTestEnemy(40, 0);
    enemy.active = false;
    g.enemies = [enemy];
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 0, y: 0, radius: 20,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];

    const origX = enemy.x;
    updateEnvironmentalHazards(0.1, g);

    expect(enemy.x).toBe(origX);
  });

  it('projectiles absorbed by asteroid (deactivated)', () => {
    // Projectile aimed at asteroid
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 0, y: 0, radius: 30,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];
    const proj = createTestProjectile(0, 0, 0);
    g.projectiles = [proj];

    updateEnvironmentalHazards(0.1, g);

    expect(proj.active).toBe(false);
  });

  it('projectiles outside asteroid radius are not absorbed', () => {
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 0, y: 0, radius: 20,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];
    const proj = createTestProjectile(100, 0, 0);
    g.projectiles = [proj];

    updateEnvironmentalHazards(0.1, g);

    expect(proj.active).toBe(true);
  });

  it('inactive projectiles are skipped', () => {
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 0, y: 0, radius: 30,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];
    const proj = createTestProjectile(0, 0, 0);
    proj.active = false;
    g.projectiles = [proj];

    updateEnvironmentalHazards(0.1, g);

    expect(proj.active).toBe(false); // stays false, not modified
  });

  it('particles created when projectile absorbed', () => {
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 0, y: 0, radius: 30,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];
    g.projectiles = [createTestProjectile(0, 0, 0)];
    g.particles = [];

    updateEnvironmentalHazards(0.1, g);

    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('inactive asteroid is skipped', () => {
    g.hazards = [{
      type: 'asteroid', active: false,
      x: 0, y: 0, radius: 30,
      rotationSpeed: 0.1, rotX: 0, rotY: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    // Player should not be pushed
    expect(g.player.x).toBe(0);
  });

  it('asteroid rotation is updated each tick', () => {
    g.hazards = [{
      type: 'asteroid', active: true,
      x: 500, y: 0, radius: 20, // far away, no collision
      rotationSpeed: 1.0, rotX: 0, rotY: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(g.hazards[0].rotX).toBeCloseTo(0.1);
    expect(g.hazards[0].rotY).toBeCloseTo(0.07); // 0.1 * 0.7
  });
});

/* ──────────────────────────────────────────────
 * 3. GravityWell tests
 * ────────────────────────────────────────────── */
describe('gravityWell', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      player: { x: 100, y: 0, vx: 0, vy: 0, radius: 38 },
    });
  });

  it('player pulled toward well center when in radius', () => {
    g.hazards = [{
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 400, pullStrength: 150,
    }];

    const origX = g.player.x;
    updateEnvironmentalHazards(0.1, g);

    // Player at 100 should be pulled toward 0
    expect(g.player.x).toBeLessThan(origX);
  });

  it('player not pulled when outside radius', () => {
    g.hazards = [{
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 50, pullStrength: 150,
    }];
    // Player at 100, radius 50, outside

    const origX = g.player.x;
    updateEnvironmentalHazards(0.1, g);

    expect(g.player.x).toBe(origX);
  });

  it('enemies pulled toward well', () => {
    const enemy = createTestEnemy(100, 0);
    g.enemies = [enemy];
    g.hazards = [{
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 400, pullStrength: 150,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(enemy.x).toBeLessThan(100);
  });

  it('inactive enemies are skipped by gravity well', () => {
    const enemy = createTestEnemy(100, 0);
    enemy.active = false;
    g.enemies = [enemy];
    g.hazards = [{
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 400, pullStrength: 150,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(enemy.x).toBe(100);
  });

  it('projectiles pulled toward well (weaker effect)', () => {
    const proj = createTestProjectile(100, 0, 0);
    g.projectiles = [proj];
    g.hazards = [{
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 400, pullStrength: 150,
    }];

    const origVx = proj.vx;
    updateEnvironmentalHazards(0.1, g);

    // Projectile vx should change (pulled toward center, reducing rightward velocity)
    expect(proj.vx).not.toBe(origVx);
  });

  it('projectiles outside radius are not pulled', () => {
    const proj = createTestProjectile(500, 0, 0);
    g.projectiles = [proj];
    g.hazards = [{
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 100, pullStrength: 150,
    }];

    const origVx = proj.vx;
    updateEnvironmentalHazards(0.1, g);

    expect(proj.vx).toBe(origVx);
  });

  it('inactive projectiles are skipped by gravity well', () => {
    const proj = createTestProjectile(100, 0, 0);
    proj.active = false;
    g.projectiles = [proj];
    g.hazards = [{
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 400, pullStrength: 150,
    }];

    const origVx = proj.vx;
    updateEnvironmentalHazards(0.1, g);

    expect(proj.vx).toBe(origVx);
  });

  it('pull strength is stronger near center', () => {
    // Test 1: Player close to center (stronger pull)
    g.player.x = 20;
    g.hazards = [{
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 400, pullStrength: 150,
    }];
    updateEnvironmentalHazards(0.1, g);
    const closePull = 20 - g.player.x;

    // Test 2: Player far from center (weaker pull)
    g.player.x = 380;
    updateEnvironmentalHazards(0.1, g);
    const farPull = 380 - g.player.x;

    // Pull should be stronger when closer
    expect(closePull).toBeGreaterThan(farPull);
  });

  it('inactive gravity well is skipped', () => {
    g.hazards = [{
      type: 'gravityWell', active: false,
      x: 0, y: 0, radius: 400, pullStrength: 150,
    }];

    const origX = g.player.x;
    updateEnvironmentalHazards(0.1, g);

    expect(g.player.x).toBe(origX);
  });
});

/* ──────────────────────────────────────────────
 * 4. PlasmaStorm tests
 * ────────────────────────────────────────────── */
describe('plasmaStorm', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      player: { x: 0, y: 0, vx: 0, vy: 0, radius: 38, hp: 300, maxHp: 300, shield: 20, maxShield: 20 },
    });
  });

  it('storm moves each tick', () => {
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 100, y: 100, vx: 60, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(g.hazards[0].x).toBeCloseTo(106); // 100 + 60 * 0.1
    expect(g.hazards[0].y).toBeCloseTo(100);
  });

  it('storm timer decreases each tick', () => {
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(g.hazards[0].timer).toBeCloseTo(24.9);
  });

  it('player damaged when inside storm (shield first)', () => {
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];
    // Player at (0,0) inside storm at (0,0) with radius 200

    updateEnvironmentalHazards(0.1, g);

    // damage = 20 * 0.1 = 2, shield absorbs 2
    expect(g.player.shield).toBeCloseTo(18); // 20 - 2
    expect(g.player.hp).toBe(300); // no hull damage
  });

  it('player damaged when inside storm (hull after shield depleted)', () => {
    g.player.shield = 0;
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];

    updateEnvironmentalHazards(0.1, g);

    // damage = 20 * 0.1 = 2, all to hull
    expect(g.player.shield).toBe(0);
    expect(g.player.hp).toBeCloseTo(298); // 300 - 2
  });

  it('player damaged when inside storm (partial shield, rest to hull)', () => {
    g.player.shield = 1;
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];

    updateEnvironmentalHazards(0.1, g);

    // damage = 20 * 0.1 = 2, shield absorbs 1, hull takes 1
    expect(g.player.shield).toBe(0);
    expect(g.player.hp).toBeCloseTo(299); // 300 - 1
  });

  it('player not damaged when outside storm', () => {
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 500, y: 0, vx: 0, vy: 0,
      radius: 100, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];
    // Player at (0,0), storm at (500,0) with radius 100

    const origHp = g.player.hp;
    const origShield = g.player.shield;
    updateEnvironmentalHazards(0.1, g);

    expect(g.player.hp).toBe(origHp);
    expect(g.player.shield).toBe(origShield);
  });

  it('enemies damaged at 2x rate inside storm', () => {
    const enemy = createTestEnemy(0, 0);
    enemy.hp = 30;
    g.enemies = [enemy];
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];

    updateEnvironmentalHazards(0.1, g);

    // damage = 20 * 2 * 0.1 = 4
    expect(enemy.hp).toBeCloseTo(26); // 30 - 4
  });

  it('enemies killed by storm when hp reaches 0', () => {
    const enemy = createTestEnemy(0, 0);
    enemy.hp = 1;
    g.enemies = [enemy];
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(enemy.active).toBe(false);
  });

  it('inactive enemies are skipped by storm', () => {
    const enemy = createTestEnemy(0, 0);
    enemy.active = false;
    g.enemies = [enemy];
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(enemy.active).toBe(false); // unchanged
    expect(enemy.hp).toBe(30); // unchanged
  });

  it('storm enters respawn phase when timer expires', () => {
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 0.05, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(g.hazards[0].respawning).toBe(true);
  });

  it('storm respawns at new position after respawn timer', () => {
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: true, respawnTimer: 0.05,
    }];

    const origX = g.hazards[0].x;
    const origY = g.hazards[0].y;
    updateEnvironmentalHazards(0.1, g);

    expect(g.hazards[0].respawning).toBe(false);
    // Should respawn at a new position (far from center)
    const newDist = Math.hypot(g.hazards[0].x, g.hazards[0].y);
    expect(newDist).toBeGreaterThan(800);
  });

  it('inactive plasma storm is skipped', () => {
    g.hazards = [{
      type: 'plasmaStorm', active: false,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 20,
      respawning: false, respawnTimer: 15,
    }];

    const origHp = g.player.hp;
    updateEnvironmentalHazards(0.1, g);

    expect(g.player.hp).toBe(origHp);
  });
});

/* ──────────────────────────────────────────────
 * 5. EMP Zone tests
 * ────────────────────────────────────────────── */
describe('empZone', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      player: { x: 0, y: 0, vx: 0, vy: 0, radius: 38 },
      cooldowns: {
        autocannon: 0, plasma: 0, missiles: 0,
        pointDefense: 0, shieldRegen: 0,
      },
    });
  });

  it('EMP activates when player enters radius after cooldown', () => {
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0, // cooldown already expired
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];
    // Player at (0,0) inside EMP at (0,0) with radius 300

    updateEnvironmentalHazards(0.1, g);

    expect(g.hazards[0].empActive).toBe(1);
  });

  it('player weapon cooldowns set when EMP fires', () => {
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0,
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(g.cooldowns.autocannon).toBe(2);
    expect(g.cooldowns.plasma).toBe(2);
    expect(g.cooldowns.missiles).toBe(2);
    expect(g.cooldowns.pointDefense).toBe(2);
  });

  it('enemy weapon cooldowns set when EMP fires', () => {
    const enemy = createTestEnemy(0, 0);
    enemy.fireCooldown = 0;
    g.enemies = [enemy];
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0,
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(enemy.fireCooldown).toBe(2);
  });

  it('enemies outside EMP radius are not affected', () => {
    const enemy = createTestEnemy(500, 0);
    enemy.fireCooldown = 0;
    g.enemies = [enemy];
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0,
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(enemy.fireCooldown).toBe(0);
  });

  it('inactive enemies are skipped by EMP', () => {
    const enemy = createTestEnemy(0, 0);
    enemy.active = false;
    g.enemies = [enemy];
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0,
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    // Should not crash
    expect(enemy.fireCooldown).toBe(0);
  });

  it('EMP does not fire while cooldown is active', () => {
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 5, // cooldown not expired
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(g.hazards[0].empActive).toBe(0);
  });

  it('EMP deactivates after disableDuration', () => {
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0,
      disableDuration: 2, empActive: 1, empTimer: 0.5,
    }];

    updateEnvironmentalHazards(0.1, g);
    expect(g.hazards[0].empActive).toBe(1);

    updateEnvironmentalHazards(0.5, g); // empTimer goes to 0
    expect(g.hazards[0].empActive).toBe(0);
  });

  it('EMP re-enters cooldown after deactivating', () => {
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0,
      disableDuration: 0.5, empActive: 1, empTimer: 0.1,
    }];

    updateEnvironmentalHazards(0.2, g); // empTimer goes to 0, EMP deactivates

    expect(g.hazards[0].empActive).toBe(0);
    expect(g.hazards[0].timer).toBe(10); // reset to full cooldown
  });

  it('player outside EMP radius does not trigger EMP', () => {
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 100,
      cooldown: 10, timer: 0,
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];
    // Player at (0,0), EMP at (0,0) radius 100 — player IS inside
    // Move player outside
    g.player.x = 200;

    updateEnvironmentalHazards(0.1, g);

    expect(g.hazards[0].empActive).toBe(0);
  });

  it('inactive EMP is skipped', () => {
    g.hazards = [{
      type: 'emp', active: false,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0,
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    expect(g.cooldowns.autocannon).toBe(0);
  });

  it('EMP uses max of existing cooldown and disableDuration', () => {
    g.cooldowns.autocannon = 3; // already has a longer cooldown
    g.hazards = [{
      type: 'emp', active: true,
      x: 0, y: 0, radius: 300,
      cooldown: 10, timer: 0,
      disableDuration: 2, empActive: 0, empTimer: 0,
    }];

    updateEnvironmentalHazards(0.1, g);

    // max(3, 2) = 3, stays at 3
    expect(g.cooldowns.autocannon).toBe(3);
  });
});

/* ──────────────────────────────────────────────
 * 6. Player death return value
 * ────────────────────────────────────────────── */
describe('player death', () => {
  it('returns true when player hp drops to 0 or below', () => {
    const g = createTestState({
      player: { x: 0, y: 0, vx: 0, vy: 0, radius: 38, hp: 1, maxHp: 300, shield: 0, maxShield: 20 },
    });
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 200, timer: 25, damagePerSecond: 100,
      respawning: false, respawnTimer: 15,
    }];

    const result = updateEnvironmentalHazards(0.1, g);

    expect(result).toBe(true);
  });

  it('returns false when player survives', () => {
    const g = createTestState({
      player: { x: 500, y: 0, vx: 0, vy: 0, radius: 38, hp: 300, maxHp: 300, shield: 20, maxShield: 20 },
    });
    g.hazards = [{
      type: 'plasmaStorm', active: true,
      x: 0, y: 0, vx: 0, vy: 0,
      radius: 100, timer: 25, damagePerSecond: 100,
      respawning: false, respawnTimer: 15,
    }];

    const result = updateEnvironmentalHazards(0.1, g);

    expect(result).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 7. Mixed hazard types
 * ────────────────────────────────────────────── */
describe('mixed hazard types', () => {
  it('processes multiple different hazard types in one tick', () => {
    const g = createTestState({
      player: { x: 100, y: 0, vx: 0, vy: 0, radius: 38, hp: 300, maxHp: 300, shield: 20, maxShield: 20 },
    });
    g.hazards = [
      {
        type: 'gravityWell', active: true,
        x: 0, y: 0, radius: 400, pullStrength: 150,
      },
      {
        type: 'emp', active: true,
        x: 100, y: 0, radius: 300,
        cooldown: 10, timer: 0,
        disableDuration: 2, empActive: 0, empTimer: 0,
      },
    ];

    updateEnvironmentalHazards(0.1, g);

    // Gravity well should pull player toward 0
    expect(g.player.x).toBeLessThan(100);
    // EMP should activate
    expect(g.hazards[1].empActive).toBe(1);
  });

  it('null hazard entry in array is skipped', () => {
    const g = createTestState({
      player: { x: 0, y: 0, vx: 0, vy: 0, radius: 38, hp: 300, maxHp: 300, shield: 20, maxShield: 20 },
    });
    g.hazards = [null, {
      type: 'gravityWell', active: true,
      x: 0, y: 0, radius: 400, pullStrength: 150,
    }];

    // Should not crash
    updateEnvironmentalHazards(0.1, g);
    expect(g.player.x).toBe(0); // at center, no pull (distance = 0, < 1)
  });
});
