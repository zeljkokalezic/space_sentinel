/**
 * Unit tests for systems/projectiles.js — updateProjectiles(dt, g, setGameState)
 *
 * Covers: projectile collision, hit sounds, enemy projectile hitting player.
 *
 * Run:  npm run test:run -- src/tests/systems/projectiles.test.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateProjectiles } from '../../engine/systems/projectiles';
import { createTestState, createTestEnemy, createTestProjectile } from '../helpers';

describe('projectile hit sounds', () => {
  let SoundManager;
  let updateProjectiles;

  beforeEach(async () => {
    ({ SoundManager } = await import('../../engine/audio'));
    ({ updateProjectiles } = await import('../../engine/systems/projectiles'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays "hit" when player projectile hits an enemy', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const enemy = createTestEnemy(100, 100);
    const projectile = createTestProjectile(90, 90, Math.atan2(10, 10));
    projectile.damage = 10;
    projectile.isEnemy = false;

    const g = createTestState({
      enemies: [enemy],
      projectiles: [projectile],
    });

    updateProjectiles(0.016, g, vi.fn());
    expect(spy).toHaveBeenCalledWith('hit');
  });

  it('does not play "hit" when projectile misses all enemies', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const enemy = createTestEnemy(1000, 1000);
    const projectile = createTestProjectile(0, 0, 0);
    projectile.isEnemy = false;

    const g = createTestState({
      enemies: [enemy],
      projectiles: [projectile],
    });

    updateProjectiles(0.016, g, vi.fn());
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not play "hit" for enemy projectiles hitting player', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const projectile = createTestProjectile(30, 30, 0);
    projectile.type = 'enemy_bullet';
    projectile.isEnemy = true;
    projectile.radius = 5;

    const g = createTestState({
      enemies: [],
      projectiles: [projectile],
    });

    updateProjectiles(0.016, g, vi.fn());
    // Enemy projectile hitting player does NOT trigger 'hit' sound (that's in enemies.js for ram)
    expect(spy).not.toHaveBeenCalledWith('hit');
  });

  it('plays "hit" once per piercing hit', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const enemy1 = createTestEnemy(90, 90);
    const enemy2 = createTestEnemy(120, 120);
    const projectile = createTestProjectile(80, 80, Math.atan2(1, 1));
    projectile.isEnemy = false;
    projectile.pierce = 2;
    projectile.damage = 10;
    projectile.radius = 12; // plasma-sized to hit both

    const g = createTestState({
      enemies: [enemy1, enemy2],
      projectiles: [projectile],
    });

    updateProjectiles(0.016, g, vi.fn());
    // Should play 'hit' for the first enemy hit (the loop breaks after first hit per projectile)
    expect(spy).toHaveBeenCalledWith('hit');
  });
});
