/**
 * Unit tests for systems/enemies.js — updateEnemies(dt, g, currentDiffMult, completeMission, setGameState)
 *
 * Covers: enemy movement toward player, inactive enemy skipping,
 * type-specific behaviors (fighter/heavy/shooter/interceptor/shielded/missile_boat),
 * firing cooldowns, collision with player, difficulty multiplier,
 * enemy death + particles + pickups, shield absorption, multi-enemy frames.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateEnemies } from '../../engine/systems/enemies';
import { createTestState, createTestEnemy } from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

/* ──────────────────────────────────────────────
 * Shared mocks
 * ────────────────────────────────────────────── */
const noop = vi.fn();

/* ──────────────────────────────────────────────
 * 1. Active enemies move toward player
 * ────────────────────────────────────────────── */
describe('active enemies move toward player', () => {
  it('fighter enemy moves closer to player each frame', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'fighter');
    g.enemies = [enemy];
    const dt = 0.1;

    const distBefore = Math.hypot(enemy.x - g.player.x, enemy.y - g.player.y);

    updateEnemies(dt, g, 1, noop, noop);

    const distAfter = Math.hypot(enemy.x - g.player.x, enemy.y - g.player.y);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('enemy position changes by speed * dt along the direction to player', () => {
    const g = createTestState();
    // Place enemy directly to the right of player on X axis
    const enemy = createTestEnemy(300, 0, 'fighter');
    enemy.speed = 100;
    g.enemies = [enemy];
    const dt = 0.1;

    updateEnemies(dt, g, 1, noop, noop);

    // angle = 0 (player is to the left), so cos(0)=1, sin(0)=0
    expect(enemy.x).toBeCloseTo(300 - 100 * dt);
    expect(enemy.y).toBeCloseTo(0);
  });

  it('enemy moves diagonally toward player', () => {
    const g = createTestState();
    const enemy = createTestEnemy(300, 300, 'fighter');
    enemy.speed = 100;
    g.enemies = [enemy];
    const dt = 0.1;

    updateEnemies(dt, g, 1, noop, noop);

    const angle = Math.atan2(g.player.y - 300, g.player.x - 300);
    expect(enemy.x).toBeCloseTo(300 + Math.cos(angle) * 100 * dt);
    expect(enemy.y).toBeCloseTo(300 + Math.sin(angle) * 100 * dt);
  });

  it('enemy at player position does not move significantly', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];
    const dt = 0.1;

    updateEnemies(dt, g, 1, noop, noop);

    // At same position, atan2(0,0)=0 so enemy moves forward by speed*dt=10.
    // Collision then triggers (dist < 15+38=53) and pushes enemy back 30 units.
    // Net displacement: moved 10 forward, pushed 30 back = 20 total displacement.
    expect(Math.abs(enemy.x)).toBeCloseTo(20);
    expect(enemy.y).toBeCloseTo(0);
  });
});

/* ──────────────────────────────────────────────
 * 2. Inactive enemies are skipped
 * ────────────────────────────────────────────── */
describe('inactive enemies are skipped', () => {
  it('does not update position of inactive enemy', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'fighter');
    enemy.active = false;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(enemy.x).toBe(500);
    expect(enemy.y).toBe(0);
  });

  it('does not decrement fireCooldown of inactive enemy', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'shooter');
    enemy.active = false;
    enemy.fireCooldown = 2.0;
    g.enemies = [enemy];

    updateEnemies(0.5, g, 1, noop, noop);

    expect(enemy.fireCooldown).toBe(2.0);
  });

  it('inactive enemy does not collide with player', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    enemy.active = false;
    g.enemies = [enemy];
    const initialPlayerHp = g.player.hp;

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.player.hp).toBe(initialPlayerHp);
  });
});

/* ──────────────────────────────────────────────
 * 3. Different enemy type behaviors
 * ────────────────────────────────────────────── */
describe('type-specific enemy behaviors', () => {
  /* ── fighter: basic movement toward player ── */
  describe('fighter — basic movement toward player', () => {
    it('fighter moves straight toward player without special modifiers', () => {
      const g = createTestState();
      const enemy = createTestEnemy(400, 0, 'fighter');
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      // Fighter has no special speed modifiers, moves at full speed
      expect(enemy.x).toBeLessThan(400);
      expect(enemy.x).toBeGreaterThan(0);
    });
  });

  /* ── heavy: slower but more HP ── */
  describe('heavy — slower speed and more HP', () => {
    it('heavy enemy has lower speed than fighter', () => {
      const g = createTestState();
      const heavy = createTestEnemy(500, 0, 'heavy');
      const fighter = createTestEnemy(500, 0, 'fighter');
      g.enemies = [heavy, fighter];

      updateEnemies(0.1, g, 1, noop, noop);

      // Heavy speed is 50, fighter is 100 — heavy moved less
      const heavyDistMoved = 500 - heavy.x;
      const fighterDistMoved = 500 - fighter.x;
      expect(heavyDistMoved).toBeLessThan(fighterDistMoved);
    });

    it('heavy enemy has more HP than fighter', () => {
      const g = createTestState();
      const heavy = createTestEnemy(500, 0, 'heavy');
      const fighter = createTestEnemy(500, 0, 'fighter');

      expect(heavy.hp).toBe(100);
      expect(fighter.hp).toBe(30);
    });
  });

  /* ── shooter: fires at player, speed modulation by distance ── */
  describe('shooter — fires at player and modulates speed by distance', () => {
    it('shooter moves backward when close to player (within radius*8)', () => {
      const g = createTestState();
      // Place shooter very close — within 8 * player.radius = 304
      const enemy = createTestEnemy(200, 0, 'shooter');
      enemy.fireCooldown = 999; // prevent firing during this test
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      // Should move away (speed * -0.5)
      expect(enemy.x).toBeGreaterThan(200);
    });

    it('shooter stops when at medium distance (between radius*8 and radius*10)', () => {
      const g = createTestState();
      // radius*8 = 304, radius*10 = 380. Place at 350.
      const enemy = createTestEnemy(350, 0, 'shooter');
      enemy.fireCooldown = 999;
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      // Speed should be 0, position unchanged
      expect(enemy.x).toBe(350);
    });

    it('shooter moves forward when far from player (beyond radius*10)', () => {
      const g = createTestState();
      // radius*10 = 380. Place at 500.
      const enemy = createTestEnemy(500, 0, 'shooter');
      enemy.fireCooldown = 999;
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      // Should move toward player at full speed
      expect(enemy.x).toBeLessThan(500);
    });

    it('shooter fires enemy_bullet when in range and cooldown expires', () => {
      const g = createTestState();
      // radius*16 = 608. Place at 500 which is in range.
      const enemy = createTestEnemy(500, 0, 'shooter');
      enemy.fireCooldown = 0;
      g.enemies = [enemy];

      expect(g.projectiles.length).toBe(0);
      updateEnemies(0.1, g, 1, noop, noop);

      expect(g.projectiles.length).toBeGreaterThan(0);
      expect(g.projectiles[0].type).toBe('enemy_bullet');
    });

    it('shooter does not fire when out of range (beyond radius*16)', () => {
      const g = createTestState();
      // radius*16 = 608. Place at 800 which is out of range.
      const enemy = createTestEnemy(800, 0, 'shooter');
      enemy.fireCooldown = 0;
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      expect(g.projectiles.length).toBe(0);
    });
  });

  /* ── interceptor: fast movement with sinusoidal angle offset ── */
  describe('interceptor — fast movement with weaving pattern', () => {
    it('interceptor has highest base speed', () => {
      const g = createTestState();
      const interceptor = createTestEnemy(500, 0, 'interceptor');
      const fighter = createTestEnemy(500, 0, 'fighter');

      expect(interceptor.speed).toBe(200);
      expect(interceptor.speed).toBeGreaterThan(fighter.speed);
    });

    it('interceptor moves significantly farther than fighter in same dt', () => {
      const g = createTestState();
      const interceptor = createTestEnemy(500, 0, 'interceptor');
      const fighter = createTestEnemy(500, 0, 'fighter');
      g.enemies = [interceptor, fighter];

      updateEnemies(0.1, g, 1, noop, noop);

      const interceptorDist = 500 - interceptor.x;
      const fighterDist = 500 - fighter.x;
      expect(interceptorDist).toBeGreaterThan(fighterDist);
    });

    it('interceptor path deviates from straight line due to sinusoidal angle', () => {
      const g = createTestState();
      const enemy = createTestEnemy(500, 0, 'interceptor');
      g.totalTime = 0;
      g.enemies = [enemy];

      // First frame at totalTime=0
      updateEnemies(0.1, g, 1, noop, noop);
      const x1 = enemy.x;
      const y1 = enemy.y;

      // Second frame at totalTime=1 (sin value different)
      g.totalTime = 1;
      updateEnemies(0.1, g, 1, noop, noop);

      // The y movement should be non-zero due to the angle offset
      expect(Math.abs(enemy.y - y1)).toBeGreaterThan(0);
    });
  });

  /* ── shielded: has shield that absorbs damage ── */
  describe('shielded — shield absorbs damage before HP', () => {
    it('shielded enemy has shield value', () => {
      const g = createTestState();
      const enemy = createTestEnemy(500, 0, 'shielded');

      expect(enemy.shield).toBe(80);
      expect(enemy.maxShield).toBe(80);
    });
  });

  /* ── missile_boat: fires missiles, speed modulation ── */
  describe('missile_boat — fires missiles and modulates speed by distance', () => {
    it('missile_boat moves backward when close (within radius*13)', () => {
      const g = createTestState();
      // radius*13 = 494. Place at 400.
      const enemy = createTestEnemy(400, 0, 'missile_boat');
      enemy.fireCooldown = 999;
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      // Should move away (speed * -1)
      expect(enemy.x).toBeGreaterThan(400);
    });

    it('missile_boat stops at medium distance (between radius*13 and radius*18)', () => {
      const g = createTestState();
      // radius*13 = 494, radius*18 = 684. Place at 600.
      const enemy = createTestEnemy(600, 0, 'missile_boat');
      enemy.fireCooldown = 999;
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      expect(enemy.x).toBe(600);
    });

    it('missile_boat fires two enemy_missile projectiles when in range', () => {
      const g = createTestState();
      // radius*21 = 798. Place at 700 which is in range.
      const enemy = createTestEnemy(700, 0, 'missile_boat');
      enemy.fireCooldown = 0;
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      expect(g.projectiles.length).toBe(2);
      expect(g.projectiles[0].type).toBe('enemy_missile');
      expect(g.projectiles[1].type).toBe('enemy_missile');
    });

    it('missile_boat does not fire when out of range (beyond radius*21)', () => {
      const g = createTestState();
      // radius*21 = 798. Place at 900.
      const enemy = createTestEnemy(900, 0, 'missile_boat');
      enemy.fireCooldown = 0;
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      expect(g.projectiles.length).toBe(0);
    });

    it('missile_boat missiles target the player', () => {
      const g = createTestState();
      const enemy = createTestEnemy(700, 0, 'missile_boat');
      enemy.fireCooldown = 0;
      g.enemies = [enemy];

      updateEnemies(0.1, g, 1, noop, noop);

      expect(g.projectiles[0].target).toBe(g.player);
      expect(g.projectiles[1].target).toBe(g.player);
    });
  });
});

/* ──────────────────────────────────────────────
 * 4. Enemy firing respects cooldown
 * ────────────────────────────────────────────── */
describe('enemy firing respects cooldown', () => {
  it('shooter does not fire while cooldown > 0', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'shooter');
    enemy.fireCooldown = 2.0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.projectiles.length).toBe(0);
    expect(enemy.fireCooldown).toBe(1.9);
  });

  it('shooter fires after cooldown reaches zero', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'shooter');
    enemy.fireCooldown = 0.05;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.projectiles.length).toBeGreaterThan(0);
    expect(enemy.fireCooldown).toBeGreaterThan(1.8); // 1.8 + random
  });

  it('missile_boat does not fire while cooldown > 0', () => {
    const g = createTestState();
    const enemy = createTestEnemy(700, 0, 'missile_boat');
    enemy.fireCooldown = 3.0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.projectiles.length).toBe(0);
    expect(enemy.fireCooldown).toBe(2.9);
  });

  it('missile_boat fires after cooldown reaches zero', () => {
    const g = createTestState();
    const enemy = createTestEnemy(700, 0, 'missile_boat');
    enemy.fireCooldown = 0.05;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.projectiles.length).toBe(2);
    expect(enemy.fireCooldown).toBe(4.0);
  });

  it('shooter cooldown resets to 1.8 + random after firing', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'shooter');
    enemy.fireCooldown = 0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(enemy.fireCooldown).toBeGreaterThanOrEqual(1.8);
    expect(enemy.fireCooldown).toBeLessThan(2.9);
  });

  it('missile_boat cooldown resets to exactly 4.0 after firing', () => {
    const g = createTestState();
    const enemy = createTestEnemy(700, 0, 'missile_boat');
    enemy.fireCooldown = 0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(enemy.fireCooldown).toBe(4.0);
  });

  it('cooldown decrements by dt each frame', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'shooter');
    enemy.fireCooldown = 3.0;
    g.enemies = [enemy];

    updateEnemies(0.5, g, 1, noop, noop);
    expect(enemy.fireCooldown).toBe(2.5);

    updateEnemies(0.3, g, 1, noop, noop);
    expect(enemy.fireCooldown).toBe(2.2);
  });
});

/* ──────────────────────────────────────────────
 * 5. Enemy collision with player reduces player HP
 * ────────────────────────────────────────────── */
describe('enemy collision with player', () => {
  it('fighter collision reduces player HP by autocannon baseDamage', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];
    g.player.shield = 0; // disable shield so damage goes directly to HP
    const initialHp = g.player.hp;

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.player.hp).toBe(initialHp - GAME_CONFIG.weapons.autocannon.baseDamage);
  });

  it('heavy collision reduces player HP by 20 (not autocannon damage)', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'heavy');
    g.enemies = [enemy];
    g.player.shield = 0; // disable shield so damage goes directly to HP
    const initialHp = g.player.hp;

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.player.hp).toBe(initialHp - 20);
  });

  it('player shield absorbs damage before HP is reduced', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.player.shield = 10;
    g.enemies = [enemy];
    const initialHp = g.player.hp;

    updateEnemies(0.1, g, 1, noop, noop);

    // autocannon baseDamage = 10, shield absorbs all of it
    expect(g.player.shield).toBe(0);
    expect(g.player.hp).toBe(initialHp);
  });

  it('player shield partially absorbs, remaining damage hits HP', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.player.shield = 5;
    g.enemies = [enemy];
    const initialHp = g.player.hp;

    updateEnemies(0.1, g, 1, noop, noop);

    // autocannon baseDamage = 10, shield absorbs 5, remaining 5 hits HP
    expect(g.player.shield).toBe(0);
    expect(g.player.hp).toBe(initialHp - 5);
  });

  it('collision pushes enemy away from player', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];
    const xBefore = enemy.x;
    const yBefore = enemy.y;

    updateEnemies(0.1, g, 1, noop, noop);

    // Enemy moves forward by speed*dt=10, then collision pushes back 30 units.
    // Net displacement from start: 20 units (10 forward + 30 backward push).
    const distMoved = Math.hypot(enemy.x - xBefore, enemy.y - yBefore);
    expect(distMoved).toBeCloseTo(20);
  });

  it('collision creates damage particles', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];

    expect(g.particles.length).toBe(0);
    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('collision creates damage effect', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    const dmgEffect = g.effects.find(e => e.type === 'dmg');
    expect(dmgEffect).toBeDefined();
  });

  it('collision damage effect text shows actual pre-shield damage (baseDmg * diffMult)', () => {
    const g = createTestState();
    g.player.shield = 0;
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    const dmgEffect = g.effects.find(e => e.type === 'dmg');
    expect(dmgEffect).toBeDefined();
    // fighter: autocannon baseDamage=10, diffMult=1 → text should be '10'
    expect(dmgEffect.text).toBe('10');
  });

  it('collision damage effect text scales with difficulty multiplier', () => {
    const g = createTestState();
    g.player.shield = 0;
    const enemy = createTestEnemy(0, 0, 'heavy');
    g.enemies = [enemy];

    updateEnemies(0.1, g, 3, noop, noop);

    const dmgEffect = g.effects.find(e => e.type === 'dmg');
    expect(dmgEffect).toBeDefined();
    // heavy: baseDamage=20, diffMult=3 → text should be '60'
    expect(dmgEffect.text).toBe('60');
  });

  it('collision particles spawn at enemy position, not player position', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];
    // Player is at (0,0) from createTestState, enemy starts at (0,0)
    // After movement and collision push, enemy.x will not be 0
    // Particles should be at the pushed enemy position, not the original player position

    updateEnemies(0.1, g, 1, noop, noop);

    const collisionParticles = g.particles.filter(p => p.color === 0xef4444);
    expect(collisionParticles.length).toBeGreaterThan(0);
    // All collision particles should be at the enemy's final position
    expect(collisionParticles[0].x).toBe(enemy.x);
    expect(collisionParticles[0].y).toBe(enemy.y);
  });

  it('enemy takes missile baseDamage on collision', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'fighter');
    enemy.hp = 30;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    // Enemy takes missiles.baseDamage = 20 damage
    expect(enemy.hp).toBe(10);
  });

  it('enemy shield absorbs collision damage before HP is reduced', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'shielded');
    enemy.shield = 50;
    enemy.hp = 40;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    // missiles.baseDamage = 20, shield absorbs all
    expect(enemy.shield).toBe(30);
    expect(enemy.hp).toBe(40);
  });

  it('enemy shield partially absorbs collision damage', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'shielded');
    enemy.shield = 10;
    enemy.hp = 40;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    // missiles.baseDamage = 20, shield absorbs 10, remaining 10 hits HP
    expect(enemy.shield).toBe(0);
    expect(enemy.hp).toBe(30);
  });

  it('player HP <= 0 triggers gameover state', () => {
    const g = createTestState();
    g.player.hp = 5;
    g.player.shield = 0;
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];
    const setGameState = vi.fn();

    updateEnemies(0.1, g, 1, noop, setGameState);

    expect(setGameState).toHaveBeenCalledWith('gameover');
  });

  it('returns early after gameover (remaining enemies not processed)', () => {
    const g = createTestState();
    g.player.hp = 5;
    g.player.shield = 0;
    const enemy1 = createTestEnemy(0, 0, 'fighter');
    const enemy2 = createTestEnemy(0, 0, 'fighter');
    enemy2.hp = 30;
    g.enemies = [enemy1, enemy2];
    const setGameState = vi.fn();

    updateEnemies(0.1, g, 1, noop, setGameState);

    expect(setGameState).toHaveBeenCalledWith('gameover');
    // enemy2 should not have been processed (no collision damage)
    expect(enemy2.hp).toBe(30);
  });
});

/* ──────────────────────────────────────────────
 * 6. Enemy speed affects movement distance per frame
 * ────────────────────────────────────────────── */
describe('enemy speed affects movement distance', () => {
  it('faster enemy moves farther in same dt', () => {
    const g = createTestState();
    const fast = createTestEnemy(500, 0, 'fighter');
    const slow = createTestEnemy(500, 0, 'fighter');
    fast.speed = 200;
    slow.speed = 50;
    g.enemies = [fast, slow];

    updateEnemies(0.1, g, 1, noop, noop);

    const fastDist = 500 - fast.x;
    const slowDist = 500 - slow.x;
    expect(fastDist).toBeGreaterThan(slowDist);
  });

  it('movement distance equals speed * dt for straight-line movement', () => {
    const g = createTestState();
    const enemy = createTestEnemy(400, 0, 'fighter');
    enemy.speed = 150;
    g.enemies = [enemy];
    const dt = 0.1;

    updateEnemies(dt, g, 1, noop, noop);

    const distMoved = 400 - enemy.x;
    expect(distMoved).toBeCloseTo(150 * dt);
  });

  it('zero speed enemy does not move', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'fighter');
    enemy.speed = 0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(enemy.x).toBe(500);
    expect(enemy.y).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 7. Difficulty multiplier affects enemy stats
 * ────────────────────────────────────────────── */
describe('difficulty multiplier affects enemy stats', () => {
  it('higher difficulty multiplier increases collision damage to player', () => {
    const g = createTestState();
    g.player.shield = 0;
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];
    const initialHp = g.player.hp;

    // diffMult = 2
    updateEnemies(0.1, g, 2, noop, noop);

    // autocannon baseDamage = 10, * 2 = 20
    expect(g.player.hp).toBe(initialHp - 20);
  });

  it('heavy collision damage scales with difficulty multiplier', () => {
    const g = createTestState();
    g.player.shield = 0;
    const enemy = createTestEnemy(0, 0, 'heavy');
    g.enemies = [enemy];
    const initialHp = g.player.hp;

    // diffMult = 3
    updateEnemies(0.1, g, 3, noop, noop);

    // heavy base damage = 20, * 3 = 60
    expect(g.player.hp).toBe(initialHp - 60);
  });

  it('shooter projectile damage scales with difficulty multiplier', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'shooter');
    enemy.fireCooldown = 0;
    g.enemies = [enemy];

    // diffMult = 2, damage = 15 * 2 = 30
    updateEnemies(0.1, g, 2, noop, noop);

    expect(g.projectiles[0].damage).toBe(30);
  });

  it('missile_boat projectile damage scales with difficulty multiplier', () => {
    const g = createTestState();
    const enemy = createTestEnemy(700, 0, 'missile_boat');
    enemy.fireCooldown = 0;
    g.enemies = [enemy];

    // diffMult = 3, damage = 25 * 3 = 75
    updateEnemies(0.1, g, 3, noop, noop);

    expect(g.projectiles[0].damage).toBe(75);
    expect(g.projectiles[1].damage).toBe(75);
  });

  it('difficulty multiplier of 1 applies base damage', () => {
    const g = createTestState();
    g.player.shield = 0;
    const enemy = createTestEnemy(0, 0, 'fighter');
    g.enemies = [enemy];
    const initialHp = g.player.hp;

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.player.hp).toBe(initialHp - GAME_CONFIG.weapons.autocannon.baseDamage);
  });
});

/* ──────────────────────────────────────────────
 * 8. Enemies that reach 0 HP become inactive and spawn death particles
 * ────────────────────────────────────────────── */
describe('enemy death — becomes inactive and spawns particles', () => {
  it('enemy with 0 HP becomes inactive', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(500, 0, 'fighter');
    enemy.hp = 0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(enemy.active).toBe(false);
  });

  it('enemy with negative HP becomes inactive', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(500, 0, 'fighter');
    enemy.hp = -5;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(enemy.active).toBe(false);
  });

  it('enemy death spawns particles at enemy position', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(200, 300, 'fighter');
    enemy.hp = 0;
    enemy.speed = 0; // prevent movement before death processing
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.particles.length).toBeGreaterThan(0);
    // Particles should be at enemy death position
    const deathParticles = g.particles.filter(p => p.x === 200 && p.y === 300);
    expect(deathParticles.length).toBeGreaterThan(0);
  });

  it('enemy death particles use enemy color', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(0, 0, 'heavy');
    enemy.hp = 0;
    enemy.color = 0xf97316;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    const matchingParticles = g.particles.filter(p => p.color === 0xf97316);
    expect(matchingParticles.length).toBeGreaterThan(0);
  });

  it('dead enemy spawns a pickup', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(200, 300, 'fighter');
    enemy.hp = 0;
    enemy.speed = 0; // prevent movement before death processing
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    const pickup = g.pickups.find(p => p.x === 200 && p.y === 300);
    expect(pickup).toBeDefined();
    expect(pickup.active).toBe(true);
  });

  it('fighter death drops value 1 pickup', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(0, 0, 'fighter');
    enemy.hp = 0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.pickups[0].value).toBe(1);
  });

  it('heavy death drops value 5 pickup', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(0, 0, 'heavy');
    enemy.hp = 0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.pickups[0].value).toBe(5);
  });

  it('interceptor death drops value 2 pickup', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(0, 0, 'interceptor');
    enemy.hp = 0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.pickups[0].value).toBe(2);
  });

  it('shooter death drops value 1 pickup (default)', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const enemy = createTestEnemy(0, 0, 'shooter');
    enemy.hp = 0;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.pickups[0].value).toBe(1);
  });
});

/* ──────────────────────────────────────────────
 * 9. Mission tracking on enemy death
 * ────────────────────────────────────────────── */
describe('mission tracking on enemy death', () => {
  it('kill mission increments current count on any enemy death', () => {
    const g = createTestState();
    g.mission = { type: 'kill', current: 3, target: 5 };
    const enemy = createTestEnemy(500, 0, 'fighter');
    enemy.hp = 0;
    g.enemies = [enemy];
    const completeMission = vi.fn();

    updateEnemies(0.1, g, 1, completeMission, noop);

    expect(g.mission.current).toBe(4);
  });

  it('kill mission completes when current reaches target', () => {
    const g = createTestState();
    g.mission = { type: 'kill', current: 4, target: 5 };
    const enemy = createTestEnemy(500, 0, 'fighter');
    enemy.hp = 0;
    g.enemies = [enemy];
    const completeMission = vi.fn();

    updateEnemies(0.1, g, 1, completeMission, noop);

    expect(g.mission.current).toBe(5);
    expect(completeMission).toHaveBeenCalled();
  });

  it('kill_elite mission counts heavy enemy death', () => {
    const g = createTestState();
    g.mission = { type: 'kill_elite', current: 0, target: 2 };
    const enemy = createTestEnemy(500, 0, 'heavy');
    enemy.hp = 0;
    g.enemies = [enemy];
    const completeMission = vi.fn();

    updateEnemies(0.1, g, 1, completeMission, noop);

    expect(g.mission.current).toBe(1);
  });

  it('kill_elite mission counts shielded enemy death', () => {
    const g = createTestState();
    g.mission = { type: 'kill_elite', current: 0, target: 2 };
    const enemy = createTestEnemy(500, 0, 'shielded');
    enemy.hp = 0;
    g.enemies = [enemy];
    const completeMission = vi.fn();

    updateEnemies(0.1, g, 1, completeMission, noop);

    expect(g.mission.current).toBe(1);
  });

  it('kill_elite mission counts missile_boat enemy death', () => {
    const g = createTestState();
    g.mission = { type: 'kill_elite', current: 0, target: 2 };
    const enemy = createTestEnemy(500, 0, 'missile_boat');
    enemy.hp = 0;
    g.enemies = [enemy];
    const completeMission = vi.fn();

    updateEnemies(0.1, g, 1, completeMission, noop);

    expect(g.mission.current).toBe(1);
  });

  it('kill_elite mission does NOT count fighter death', () => {
    const g = createTestState();
    g.mission = { type: 'kill_elite', current: 0, target: 2 };
    const enemy = createTestEnemy(500, 0, 'fighter');
    enemy.hp = 0;
    g.enemies = [enemy];
    const completeMission = vi.fn();

    updateEnemies(0.1, g, 1, completeMission, noop);

    expect(g.mission.current).toBe(0);
  });

  it('kill_elite mission does NOT count interceptor death', () => {
    const g = createTestState();
    g.mission = { type: 'kill_elite', current: 0, target: 2 };
    const enemy = createTestEnemy(500, 0, 'interceptor');
    enemy.hp = 0;
    g.enemies = [enemy];
    const completeMission = vi.fn();

    updateEnemies(0.1, g, 1, completeMission, noop);

    expect(g.mission.current).toBe(0);
  });

  it('kill_elite mission completes when elite kill count reaches target', () => {
    const g = createTestState();
    g.mission = { type: 'kill_elite', current: 1, target: 2 };
    const enemy = createTestEnemy(500, 0, 'heavy');
    enemy.hp = 0;
    g.enemies = [enemy];
    const completeMission = vi.fn();

    updateEnemies(0.1, g, 1, completeMission, noop);

    expect(g.mission.current).toBe(2);
    expect(completeMission).toHaveBeenCalled();
  });
});

/* ──────────────────────────────────────────────
 * 10. Multiple enemies process correctly in one frame
 * ────────────────────────────────────────────── */
describe('multiple enemies process correctly in one frame', () => {
  it('all active enemies move in a single call', () => {
    const g = createTestState();
    const e1 = createTestEnemy(300, 0, 'fighter');
    const e2 = createTestEnemy(0, 300, 'fighter');
    const e3 = createTestEnemy(-300, 0, 'fighter');
    g.enemies = [e1, e2, e3];

    updateEnemies(0.1, g, 1, noop, noop);

    // All three should have moved toward (0, 0)
    expect(e1.x).toBeLessThan(300);
    expect(e2.y).toBeLessThan(300);
    expect(e3.x).toBeGreaterThan(-300);
  });

  it('mix of active and inactive: only active enemies updated', () => {
    const g = createTestState();
    const e1 = createTestEnemy(300, 0, 'fighter');
    const e2 = createTestEnemy(0, 300, 'fighter');
    e2.active = false;
    const e3 = createTestEnemy(-300, 0, 'fighter');
    g.enemies = [e1, e2, e3];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(e1.x).toBeLessThan(300);
    expect(e2.x).toBe(0);
    expect(e2.y).toBe(300);
    expect(e3.x).toBeGreaterThan(-300);
  });

  it('multiple shooters fire in same frame', () => {
    const g = createTestState();
    const s1 = createTestEnemy(500, 0, 'shooter');
    s1.fireCooldown = 0;
    const s2 = createTestEnemy(0, 500, 'shooter');
    s2.fireCooldown = 0;
    g.enemies = [s1, s2];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.projectiles.length).toBe(2);
  });

  it('multiple missile_boats each fire two missiles', () => {
    const g = createTestState();
    const m1 = createTestEnemy(700, 0, 'missile_boat');
    m1.fireCooldown = 0;
    const m2 = createTestEnemy(0, 700, 'missile_boat');
    m2.fireCooldown = 0;
    g.enemies = [m1, m2];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.projectiles.length).toBe(4);
  });

  it('multiple enemy deaths in one frame each spawn particles and pickups', () => {
    const g = createTestState();
    g.mission = { type: 'none', current: 0, target: 999 };
    const e1 = createTestEnemy(100, 0, 'fighter');
    e1.hp = 0;
    const e2 = createTestEnemy(-100, 0, 'heavy');
    e2.hp = 0;
    g.enemies = [e1, e2];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(e1.active).toBe(false);
    expect(e2.active).toBe(false);
    expect(g.particles.length).toBeGreaterThan(0);
    expect(g.pickups.length).toBe(2);
  });

  it('large number of enemies processes without error', () => {
    const g = createTestState();
    const enemies = [];
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2;
      enemies.push(createTestEnemy(Math.cos(angle) * 600, Math.sin(angle) * 600, 'fighter'));
    }
    g.enemies = enemies;

    expect(() => updateEnemies(0.1, g, 1, noop, noop)).not.toThrow();

    // All enemies should have moved
    for (const e of enemies) {
      expect(e.x).not.toBeCloseTo(Math.cos(Math.atan2(e.y, e.x)) * 600, 0);
    }
  });

  it('different enemy types coexist and behave correctly', () => {
    const g = createTestState();
    const fighter = createTestEnemy(400, 0, 'fighter');
    const heavy = createTestEnemy(0, 400, 'heavy');
    const interceptor = createTestEnemy(-400, 0, 'interceptor');
    const shielded = createTestEnemy(0, -400, 'shielded');
    g.enemies = [fighter, heavy, interceptor, shielded];

    updateEnemies(0.1, g, 1, noop, noop);

    // All should still be active (none at 0 HP)
    expect(fighter.active).toBe(true);
    expect(heavy.active).toBe(true);
    expect(interceptor.active).toBe(true);
    expect(shielded.active).toBe(true);

    // All should have moved toward player
    expect(Math.hypot(fighter.x, fighter.y)).toBeLessThan(400);
    expect(Math.hypot(heavy.x, heavy.y)).toBeLessThan(400);
    expect(Math.hypot(interceptor.x, interceptor.y)).toBeLessThan(400);
    expect(Math.hypot(shielded.x, shielded.y)).toBeLessThan(400);
  });
});

/* ──────────────────────────────────────────────
 * 11. Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  it('empty enemy list does nothing', () => {
    const g = createTestState();
    g.enemies = [];

    expect(() => updateEnemies(0.1, g, 1, noop, noop)).not.toThrow();
  });

  it('enemy with no fireCooldown property does not fire', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'fighter');
    delete enemy.fireCooldown;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.projectiles.length).toBe(0);
  });

  it('enemy with fireCooldown = undefined is treated as not having cooldown', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0, 'fighter');
    enemy.fireCooldown = undefined;
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(g.projectiles.length).toBe(0);
  });

  it('player at edge of world, enemy moves toward them correctly', () => {
    const g = createTestState();
    g.player.x = 3500;
    g.player.y = 3500;
    const enemy = createTestEnemy(3000, 3000, 'fighter');
    g.enemies = [enemy];

    updateEnemies(0.1, g, 1, noop, noop);

    expect(enemy.x).toBeGreaterThan(3000);
    expect(enemy.y).toBeGreaterThan(3000);
  });

  it('collision does not occur when enemy radius + player radius is not exceeded', () => {
    const g = createTestState();
    // Player radius = 38, enemy radius = 15, combined = 53
    // Place enemy at distance 60 — just outside collision threshold
    const enemy = createTestEnemy(60, 0, 'fighter');
    g.enemies = [enemy];
    const initialHp = g.player.hp;

    updateEnemies(0.001, g, 1, noop, noop);

    // No collision should happen since distance > combined radius
    // (using tiny dt to minimize movement during the frame)
    expect(g.player.hp).toBe(initialHp);
  });
});
