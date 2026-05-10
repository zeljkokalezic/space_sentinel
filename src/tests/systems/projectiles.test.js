/**
 * Unit tests for systems/projectiles.js — updateProjectiles(dt, g, setGameState)
 *
 * Covers: projectile movement, lifetime expiry, collision with enemies,
 * piercing, homing missiles, enemy projectiles hitting player,
 * hitList deduplication, and multi-projectile processing.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateProjectiles } from '../../engine/systems/projectiles';
import { createTestState, createTestEnemy, createTestProjectile } from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

/* ──────────────────────────────────────────────
 * Helper: no-op setGameState
 * ────────────────────────────────────────────── */
const noop = vi.fn();

/* ──────────────────────────────────────────────
 * 1. Active projectiles move by velocity * dt
 * ────────────────────────────────────────────── */
describe('active projectile movement', () => {
  it('updates position by velocity * dt along X axis', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0); // angle 0 = right
    g.projectiles = [p];
    const dt = 0.1;

    updateProjectiles(dt, g, noop);

    expect(p.x).toBeCloseTo(p.vx * dt);
    expect(p.y).toBeCloseTo(p.vy * dt);
  });

  it('updates position by velocity * dt along Y axis', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, Math.PI / 2); // straight up
    g.projectiles = [p];
    const dt = 0.05;

    updateProjectiles(dt, g, noop);

    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(p.vy * dt);
  });

  it('updates position by velocity * dt diagonally', () => {
    const g = createTestState();
    const angle = Math.PI / 4;
    const speed = 500;
    const p = createTestProjectile(10, 20, angle);
    // Override velocity to known values
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    g.projectiles = [p];
    const dt = 0.1;

    updateProjectiles(dt, g, noop);

    expect(p.x).toBeCloseTo(10 + Math.cos(angle) * speed * dt);
    expect(p.y).toBeCloseTo(20 + Math.sin(angle) * speed * dt);
  });

  it('projectile life increments by dt', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    g.projectiles = [p];

    updateProjectiles(0.2, g, noop);

    expect(p.life).toBe(0.2);
  });

  it('projectile life accumulates across multiple calls', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    g.projectiles = [p];

    updateProjectiles(0.5, g, noop);
    expect(p.life).toBe(0.5);

    updateProjectiles(0.3, g, noop);
    expect(p.life).toBe(0.8);
  });
});

/* ──────────────────────────────────────────────
 * 2. Inactive projectiles are skipped
 * ────────────────────────────────────────────── */
describe('inactive projectiles are skipped', () => {
  it('does not update position of inactive projectile', () => {
    const g = createTestState();
    const p = createTestProjectile(100, 200, 0);
    p.active = false;
    g.projectiles = [p];

    updateProjectiles(0.1, g, noop);

    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
  });

  it('does not increment life of inactive projectile', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.active = false;
    p.life = 2;
    g.projectiles = [p];

    updateProjectiles(0.5, g, noop);

    expect(p.life).toBe(2);
  });

  it('inactive projectile remains inactive', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.active = false;
    g.projectiles = [p];

    updateProjectiles(0.1, g, noop);

    expect(p.active).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 3. Projectile lifetime expiry
 * ────────────────────────────────────────────── */
describe('projectile lifetime expiry', () => {
  it('becomes inactive after GAME_CONFIG.projectile.lifetime seconds', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.life = GAME_CONFIG.projectile.lifetime - 0.01;
    g.projectiles = [p];

    updateProjectiles(0.1, g, noop);

    expect(p.active).toBe(false);
  });

  it('stays active when life is exactly at lifetime threshold (not exceeded)', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.life = GAME_CONFIG.projectile.lifetime - 0.1;
    g.projectiles = [p];

    updateProjectiles(0.05, g, noop);

    expect(p.active).toBe(true);
  });

  it('becomes inactive when life exceeds lifetime', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.life = GAME_CONFIG.projectile.lifetime;
    g.projectiles = [p];

    updateProjectiles(0.01, g, noop);

    expect(p.active).toBe(false);
  });

  it('does not move projectile that expired this frame (continue after deactivation)', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.life = GAME_CONFIG.projectile.lifetime - 0.01;
    g.projectiles = [p];

    updateProjectiles(0.1, g, noop);

    // The projectile was deactivated before movement, so position unchanged
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 4. Player projectile hits enemy
 * ────────────────────────────────────────────── */
describe('player projectile hits enemy', () => {
  it('reduces enemy HP by projectile damage', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    enemy.hp = 50;
    enemy.maxHp = 50;
    g.enemies = [enemy];

    // Place projectile so it collides with enemy (within combined radii)
    const p = createTestProjectile(-5, -5, 0);
    p.vx = 0;
    p.vy = 0;
    p.damage = 15;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(enemy.hp).toBe(35);
  });

  it('creates hit particles when projectile hits enemy', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    g.projectiles = [p];

    expect(g.particles.length).toBe(0);
    updateProjectiles(0.016, g, noop);
    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('creates damage effect on enemy hit', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.damage = 10;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    const dmgEffect = g.effects.find(e => e.type === 'dmg');
    expect(dmgEffect).toBeDefined();
    expect(dmgEffect.text).toBe('10');
  });

  it('applies damage to shield first, then to HP', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'shielded');
    enemy.shield = 20;
    enemy.hp = 40;
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.damage = 30;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    // absorb = min(20, 30) = 20, shield=0, remaining dmg=10, hp=40-10=30
    expect(enemy.shield).toBe(0);
    expect(enemy.hp).toBe(30);
  });

  it('only damages shield when damage is less than shield', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0, 'shielded');
    enemy.shield = 50;
    enemy.hp = 40;
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.damage = 15;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(enemy.shield).toBe(35);
    expect(enemy.hp).toBe(40);
  });
});

/* ──────────────────────────────────────────────
 * 5. Non-piercing projectile deactivated after hit
 * ────────────────────────────────────────────── */
describe('non-piercing projectile deactivated after hit', () => {
  it('projectile becomes inactive after hitting enemy when pierce=0', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(p.active).toBe(false);
  });

  it('deactivated projectile is not processed in subsequent frames', () => {
    const g = createTestState();
    const enemy1 = createTestEnemy(0, 0);
    const enemy2 = createTestEnemy(0, 0);
    g.enemies = [enemy1, enemy2];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 0;
    p.damage = 10;
    g.projectiles = [p];

    const initialHp2 = enemy2.hp;

    updateProjectiles(0.016, g, noop);
    expect(p.active).toBe(false);

    // Second frame — projectile is inactive, enemy2 should not be hit
    enemy1.hp = 0; // deactivate enemy1 for next frame
    enemy1.active = false;
    updateProjectiles(0.016, g, noop);

    expect(enemy2.hp).toBe(initialHp2);
  });
});

/* ──────────────────────────────────────────────
 * 6. Piercing projectile can hit multiple enemies
 * ────────────────────────────────────────────── */
describe('piercing projectile hits multiple enemies', () => {
  it('piercing projectile hits first enemy and continues', () => {
    const g = createTestState();
    const enemy1 = createTestEnemy(0, 0);
    const enemy2 = createTestEnemy(100, 100); // far away, won't be hit in same frame
    g.enemies = [enemy1, enemy2];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 1;
    p.damage = 10;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(enemy1.hp).toBe(20); // 30 - 10
    expect(p.active).toBe(true);
    expect(p.pierce).toBe(0);
  });

  it('piercing projectile hits second enemy after first', () => {
    const g = createTestState();
    const enemy1 = createTestEnemy(0, 0);
    const enemy2 = createTestEnemy(0, 0); // same position, will be hit next frame
    g.enemies = [enemy1, enemy2];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 1;
    p.damage = 10;
    g.projectiles = [p];

    // Frame 1: hits enemy1
    updateProjectiles(0.016, g, noop);
    expect(enemy1.hp).toBe(20);
    expect(p.active).toBe(true);
    expect(p.pierce).toBe(0);

    // Frame 2: hits enemy2 (enemy1 is in hitList, skipped)
    updateProjectiles(0.016, g, noop);
    expect(enemy2.hp).toBe(20);
    expect(p.active).toBe(false); // pierce exhausted
  });

  it('pierce=2 allows hitting 3 enemies total', () => {
    const g = createTestState();
    const enemy1 = createTestEnemy(0, 0);
    const enemy2 = createTestEnemy(0, 0);
    const enemy3 = createTestEnemy(0, 0);
    g.enemies = [enemy1, enemy2, enemy3];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 2;
    p.damage = 5;
    g.projectiles = [p];

    // Frame 1: hits enemy1
    updateProjectiles(0.016, g, noop);
    expect(enemy1.hp).toBe(25);
    expect(p.pierce).toBe(1);
    expect(p.active).toBe(true);

    // Frame 2: hits enemy2
    updateProjectiles(0.016, g, noop);
    expect(enemy2.hp).toBe(25);
    expect(p.pierce).toBe(0);
    expect(p.active).toBe(true);

    // Frame 3: hits enemy3
    updateProjectiles(0.016, g, noop);
    expect(enemy3.hp).toBe(25);
    expect(p.active).toBe(false);
  });

  it('hitList contains IDs of enemies hit while pierce > 0', () => {
    const g = createTestState();
    const enemy1 = createTestEnemy(0, 0);
    const enemy2 = createTestEnemy(0, 0);
    g.enemies = [enemy1, enemy2];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 1;
    g.projectiles = [p];

    // Frame 1: pierce=1 > 0, hits enemy1, pierce--, hitList gets enemy1.id
    updateProjectiles(0.016, g, noop);
    expect(p.hitList).toContain(enemy1.id);
    expect(p.pierce).toBe(0);

    // Frame 2: pierce=0, hits enemy2 but does NOT add to hitList (code only pushes when pierce>0)
    updateProjectiles(0.016, g, noop);
    expect(p.hitList).not.toContain(enemy2.id);
    expect(p.active).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 7. Piercing projectile deactivated after max hits
 * ────────────────────────────────────────────── */
describe('piercing projectile deactivated after max hits', () => {
  it('piercing projectile becomes inactive after exhausting all pierce counts', () => {
    const g = createTestState();
    const enemies = [];
    for (let i = 0; i < 5; i++) {
      enemies.push(createTestEnemy(0, 0));
    }
    g.enemies = enemies;

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 3;
    p.damage = 5;
    g.projectiles = [p];

    // 4 frames = 4 hits (initial + 3 pierce)
    for (let i = 0; i < 4; i++) {
      updateProjectiles(0.016, g, noop);
    }

    expect(p.active).toBe(false);
    expect(p.pierce).toBe(0);
  });

  it('projectile remains active if pierce not exhausted and no enemies in range', () => {
    const g = createTestState();
    const enemy = createTestEnemy(9999, 9999); // far away
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 2;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(p.active).toBe(true);
    expect(p.pierce).toBe(2);
  });
});

/* ──────────────────────────────────────────────
 * 8. Enemy projectiles hit player
 * ────────────────────────────────────────────── */
describe('enemy projectile hits player', () => {
  it('reduces player HP when enemy projectile collides', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.type = 'enemy_bullet';
    p.isEnemy = true;
    p.vx = 0;
    p.vy = 0;
    p.damage = 25;
    g.projectiles = [p];

    const initialHp = g.player.hp;
    updateProjectiles(0.016, g, noop);

    // shield=20 absorbs min(20,25)=20, remaining dmg=5, hp=300-5=295
    expect(g.player.hp).toBe(295);
  });

  it('enemy projectile becomes inactive after hitting player', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.type = 'enemy_bullet';
    p.isEnemy = true;
    p.vx = 0;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(p.active).toBe(false);
  });

  it('absorbs damage from player shield first', () => {
    const g = createTestState();
    g.player.shield = 15;
    g.player.hp = 300;

    const p = createTestProjectile(0, 0, 0);
    p.type = 'enemy_bullet';
    p.isEnemy = true;
    p.vx = 0;
    p.vy = 0;
    p.damage = 30;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(g.player.shield).toBe(0);
    expect(g.player.hp).toBe(285); // 300 - (30 - 15)
  });

  it('only damages shield when damage is less than shield', () => {
    const g = createTestState();
    g.player.shield = 50;
    g.player.hp = 300;

    const p = createTestProjectile(0, 0, 0);
    p.type = 'enemy_bullet';
    p.isEnemy = true;
    p.vx = 0;
    p.vy = 0;
    p.damage = 10;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(g.player.shield).toBe(40);
    expect(g.player.hp).toBe(300);
  });

  it('creates particles on player hit', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.type = 'enemy_bullet';
    p.isEnemy = true;
    p.vx = 0;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('adds damage effect on player hit', () => {
    const g = createTestState();
    const p = createTestProjectile(0, 0, 0);
    p.type = 'enemy_bullet';
    p.isEnemy = true;
    p.vx = 0;
    p.vy = 0;
    p.damage = 15;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    const dmgEffect = g.effects.find(e => e.type === 'dmg');
    expect(dmgEffect).toBeDefined();
    expect(dmgEffect.text).toBe('15');
  });

  it('triggers gameover when player HP drops to 0 or below', () => {
    const g = createTestState();
    g.player.hp = 10;
    g.player.shield = 0;

    const p = createTestProjectile(0, 0, 0);
    p.type = 'enemy_bullet';
    p.isEnemy = true;
    p.vx = 0;
    p.vy = 0;
    p.damage = 20;
    g.projectiles = [p];

    const setGameState = vi.fn();
    updateProjectiles(0.016, g, setGameState);

    expect(setGameState).toHaveBeenCalledWith('gameover');
    expect(g.player.hp).toBeLessThanOrEqual(0);
  });

  it('returns early on gameover (remaining projectiles not processed)', () => {
    const g = createTestState();
    g.player.hp = 5;
    g.player.shield = 0;

    const p1 = createTestProjectile(0, 0, 0);
    p1.type = 'enemy_bullet';
    p1.isEnemy = true;
    p1.vx = 0;
    p1.vy = 0;
    p1.damage = 10;

    const p2 = createTestProjectile(100, 100, 0);
    p2.type = 'enemy_bullet';
    p2.isEnemy = true;
    p2.vx = 100;
    p2.vy = 0;
    p2.damage = 5;

    g.projectiles = [p1, p2];

    const setGameState = vi.fn();
    updateProjectiles(0.016, g, setGameState);

    expect(setGameState).toHaveBeenCalledWith('gameover');
    // p2 should not have been processed (early return)
    expect(p2.x).toBe(100);
  });
});

/* ──────────────────────────────────────────────
 * 9. Homing missiles steer toward target
 * ────────────────────────────────────────────── */
describe('homing missiles steer toward target', () => {
  it('player missile adjusts velocity toward target enemy', () => {
    const g = createTestState();
    const target = createTestEnemy(200, 0);
    g.enemies = [target];

    const p = createTestProjectile(0, 0, Math.PI / 2); // initially firing up
    p.type = 'missile';
    p.target = target;
    p.vx = 0;
    p.vy = 700;
    g.projectiles = [p];

    const oldVx = p.vx;
    const oldVy = p.vy;

    updateProjectiles(0.016, g, noop);

    // Velocity should have changed to steer right (toward enemy at x=200)
    expect(p.vx).not.toBe(oldVx);
    expect(p.vy).not.toBe(oldVy);
    // X component should now be positive (steering toward target)
    expect(p.vx).toBeGreaterThan(0);
  });

  it('player missile does not steer when target is dead (hp <= 0)', () => {
    const g = createTestState();
    const target = createTestEnemy(200, 0);
    target.hp = 0;
    g.enemies = [target];

    const p = createTestProjectile(0, 0, 0);
    p.type = 'missile';
    p.target = target;
    p.vx = 100;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    // Velocity unchanged (no homing)
    expect(p.vx).toBe(100);
    expect(p.vy).toBe(0);
  });

  it('player missile does not steer when target is null', () => {
    const g = createTestState();

    const p = createTestProjectile(0, 0, 0);
    p.type = 'missile';
    p.target = null;
    p.vx = 100;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(p.vx).toBeCloseTo(100);
    expect(p.vy).toBeCloseTo(0);
  });

  it('enemy missile steers toward player', () => {
    const g = createTestState();
    g.player.x = 0;
    g.player.y = -200;

    const p = createTestProjectile(0, 200, Math.PI, 'enemy_missile'); // firing left, away from player
    p.target = g.player;
    p.vx = -700;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    // Velocity should have changed to steer toward player
    expect(p.vx).not.toBe(-700);
    expect(p.vy).not.toBe(0);
  });

  it('enemy missile does not steer when player is dead', () => {
    const g = createTestState();
    g.player.hp = 0;

    const p = createTestProjectile(0, 0, 0);
    p.type = 'enemy_missile';
    p.target = g.player;
    p.vx = 100;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(p.vx).toBeCloseTo(100);
    expect(p.vy).toBeCloseTo(0);
  });

  it('missile speed increases slightly during homing', () => {
    const g = createTestState();
    const target = createTestEnemy(200, 0);
    g.enemies = [target];

    const p = createTestProjectile(0, 0, Math.PI / 2);
    p.type = 'missile';
    p.target = target;
    p.vx = 0;
    p.vy = 700;
    g.projectiles = [p];

    const oldSpeed = Math.hypot(p.vx, p.vy);

    updateProjectiles(0.016, g, noop);

    const newSpeed = Math.hypot(p.vx, p.vy);
    expect(newSpeed).toBeGreaterThan(oldSpeed);
  });

  it('non-missile player projectiles do not home', () => {
    const g = createTestState();
    const target = createTestEnemy(200, 0);
    g.enemies = [target];

    const p = createTestProjectile(0, 0, 0);
    p.type = 'autocannon';
    p.target = target; // target set but type is not missile
    p.vx = 700;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    // Velocity unchanged — autocannon doesn't home
    expect(p.vx).toBeCloseTo(700);
    expect(p.vy).toBeCloseTo(0);
  });
});

/* ──────────────────────────────────────────────
 * 10. Collision uses radius-based distance check
 * ────────────────────────────────────────────── */
describe('radius-based collision detection', () => {
  it('hits when distance < enemy.radius + projectile.radius', () => {
    const g = createTestState();
    const enemy = createTestEnemy(30, 0);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    // distance = 30, enemy radius = 15, projectile radius = 5, combined = 20
    // 30 > 20, so no hit yet — move closer
    p.x = 15; // distance = 15 < 20
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(enemy.hp).toBeLessThan(30);
  });

  it('does not hit when distance >= combined radii', () => {
    const g = createTestState();
    const enemy = createTestEnemy(100, 0);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    // distance = 100, combined radii = 15 + 5 = 20, no hit
    expect(enemy.hp).toBe(30);
    expect(p.active).toBe(true);
  });

  it('collision distance uses enemy radius + projectile radius', () => {
    const g = createTestState();
    const enemy = createTestEnemy(20, 0);
    enemy.radius = 15;
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.radius = 5;
    g.projectiles = [p];

    // distance = 20, combined = 15 + 5 = 20, 20 < 20 is false, no hit
    updateProjectiles(0.016, g, noop);
    expect(enemy.hp).toBe(30);

    // Move projectile 0.1 closer
    p.x = 0.1;
    updateProjectiles(0.016, g, noop);
    expect(enemy.hp).toBeLessThan(30);
  });

  it('player collision uses player.radius + projectile.radius', () => {
    const g = createTestState();
    g.player.shield = 0; // disable shield so damage goes to HP
    const enemyP = createTestProjectile(38, 0, 0, 'enemy_bullet');
    enemyP.vx = 0;
    enemyP.vy = 0;
    enemyP.radius = 5;
    g.projectiles = [enemyP];

    // player at (0,0), radius=38, projectile at (38,0), radius=5
    // distance = 38, combined = 38 + 5 = 43, 38 < 43 = hit
    const initialHp = g.player.hp;
    updateProjectiles(0.016, g, noop);
    expect(g.player.hp).toBeLessThan(initialHp);
  });

  it('no player collision when outside combined radius', () => {
    const g = createTestState();
    const enemyP = createTestProjectile(200, 0, 0);
    enemyP.type = 'enemy_bullet';
    enemyP.vx = 0;
    enemyP.vy = 0;
    g.projectiles = [enemyP];

    const initialHp = g.player.hp;
    updateProjectiles(0.016, g, noop);
    expect(g.player.hp).toBe(initialHp);
  });
});

/* ──────────────────────────────────────────────
 * 11. Projectile skips already-hit enemy (hitList)
 * ────────────────────────────────────────────── */
describe('hitList prevents double-hitting same enemy', () => {
  it('projectile does not damage enemy already in hitList', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 1;
    p.damage = 10;
    g.projectiles = [p];

    // Frame 1: hits enemy, adds to hitList
    updateProjectiles(0.016, g, noop);
    const hpAfterFirst = enemy.hp;

    // Frame 2: enemy still in position but in hitList — should be skipped
    updateProjectiles(0.016, g, noop);

    expect(enemy.hp).toBe(hpAfterFirst);
  });

  it('inactive enemy is skipped even if not in hitList', () => {
    const g = createTestState();
    const enemy1 = createTestEnemy(0, 0);
    const enemy2 = createTestEnemy(0, 0);
    enemy1.active = false;
    g.enemies = [enemy1, enemy2];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.pierce = 1;
    p.damage = 10;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    // enemy1 inactive, should hit enemy2
    expect(enemy1.hp).toBe(30); // unchanged
    expect(enemy2.hp).toBe(20);
  });
});

/* ──────────────────────────────────────────────
 * 12. Multiple projectiles in a single frame
 * ────────────────────────────────────────────── */
describe('multiple projectiles in a single frame', () => {
  it('all active projectiles are processed', () => {
    const g = createTestState();
    const enemy1 = createTestEnemy(0, 0);
    const enemy2 = createTestEnemy(0, 0);
    g.enemies = [enemy1, enemy2];

    const p1 = createTestProjectile(0, 0, 0);
    p1.vx = 0;
    p1.vy = 0;
    p1.damage = 5;

    const p2 = createTestProjectile(0, 0, 0);
    p2.vx = 0;
    p2.vy = 0;
    p2.damage = 8;

    g.projectiles = [p1, p2];

    updateProjectiles(0.016, g, noop);

    // p1 hits enemy1, p2 hits enemy1 (enemy1 not yet in p2's hitList)
    expect(enemy1.hp).toBe(30 - 5 - 8);
    expect(p1.active).toBe(false);
    expect(p2.active).toBe(false);
  });

  it('multiple projectiles can hit different enemies', () => {
    const g = createTestState();
    const enemy1 = createTestEnemy(0, 0);
    const enemy2 = createTestEnemy(100, 100);
    g.enemies = [enemy1, enemy2];

    const p1 = createTestProjectile(0, 0, 0);
    p1.vx = 0;
    p1.vy = 0;
    p1.damage = 10;

    const p2 = createTestProjectile(100, 100, 0);
    p2.vx = 0;
    p2.vy = 0;
    p2.damage = 12;

    g.projectiles = [p1, p2];

    updateProjectiles(0.016, g, noop);

    expect(enemy1.hp).toBe(20);
    expect(enemy2.hp).toBe(18);
  });

  it('inactive projectiles in the middle of the array are skipped', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    const p1 = createTestProjectile(0, 0, 0);
    p1.vx = 0;
    p1.vy = 0;
    p1.damage = 5;

    const p2 = createTestProjectile(50, 50, 0);
    p2.active = false;

    const p3 = createTestProjectile(0, 0, 0);
    p3.vx = 0;
    p3.vy = 0;
    p3.damage = 7;
    p3.pierce = 1; // can hit same enemy since p1 deactivated it

    g.projectiles = [p1, p2, p3];

    updateProjectiles(0.016, g, noop);

    // p1 hits enemy, p2 skipped, p3 hits enemy (pierce allows it)
    expect(enemy.hp).toBe(30 - 5 - 7);
    expect(p2.x).toBe(50); // p2 not moved
  });

  it('mixed active/inactive and expired projectiles all handled correctly', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    const p1 = createTestProjectile(0, 0, 0);
    p1.vx = 0;
    p1.vy = 0;
    p1.damage = 5;

    const p2 = createTestProjectile(100, 100, 0);
    p2.active = false;

    const p3 = createTestProjectile(0, 0, 0);
    p3.life = GAME_CONFIG.projectile.lifetime - 0.01;
    p3.vx = 0;
    p3.vy = 0;
    p3.damage = 3;

    g.projectiles = [p1, p2, p3];

    updateProjectiles(0.1, g, noop);

    expect(enemy.hp).toBe(25); // only p1 hit
    expect(p1.active).toBe(false); // deactivated after hit
    expect(p2.active).toBe(false); // still inactive
    expect(p3.active).toBe(false); // expired
  });

  it('player and enemy projectiles coexist and process independently', () => {
    const g = createTestState();
    g.player.shield = 0; // disable shield so damage goes directly to HP
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    const playerP = createTestProjectile(0, 0, 0);
    playerP.vx = 0;
    playerP.vy = 0;
    playerP.damage = 8;

    const enemyP = createTestProjectile(0, 0, 0, 'enemy_bullet');
    enemyP.vx = 0;
    enemyP.vy = 0;
    enemyP.damage = 12;

    g.projectiles = [playerP, enemyP];
    const initialPlayerHp = g.player.hp;

    updateProjectiles(0.016, g, noop);

    expect(enemy.hp).toBe(22);
    expect(g.player.hp).toBe(initialPlayerHp - 12);
  });
});

/* ──────────────────────────────────────────────
 * Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  it('does nothing when no projectiles exist', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    updateProjectiles(0.016, g, noop);

    expect(enemy.hp).toBe(30);
  });

  it('does nothing when all projectiles are inactive', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.active = false;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(enemy.hp).toBe(30);
  });

  it('does nothing when no enemies exist for player projectile', () => {
    const g = createTestState();
    g.enemies = [];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 100;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(p.active).toBe(true);
  });

  it('projectile that kills enemy (hp <= 0) still deactivates correctly', () => {
    const g = createTestState();
    const enemy = createTestEnemy(0, 0);
    enemy.hp = 5;
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 0;
    p.vy = 0;
    p.damage = 10;
    g.projectiles = [p];

    updateProjectiles(0.016, g, noop);

    expect(enemy.hp).toBe(-5);
    expect(p.active).toBe(false);
  });

  it('dt=0 does not change positions but still increments life by 0', () => {
    const g = createTestState();
    const p = createTestProjectile(50, 50, 0);
    p.vx = 700;
    p.vy = 0;
    g.projectiles = [p];

    updateProjectiles(0, g, noop);

    expect(p.x).toBe(50);
    expect(p.y).toBe(50);
    expect(p.life).toBe(0);
  });

  it('very large dt still processes correctly', () => {
    const g = createTestState();
    const enemy = createTestEnemy(500, 0);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0);
    p.vx = 100;
    p.vy = 0;
    p.damage = 10;
    g.projectiles = [p];

    // dt=5 moves projectile 500 units right, right onto enemy
    updateProjectiles(5, g, noop);

    // lifetime check runs before movement: life=5 > 4.0, so expired and continue skips movement
    expect(p.x).toBe(0);
    // projectile life = 5 > lifetime (4.0), so expired before collision
    expect(p.active).toBe(false);
    expect(enemy.hp).toBe(30); // not hit because expired first
  });
});
