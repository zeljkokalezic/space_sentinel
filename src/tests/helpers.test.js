/**
 * Smoke test — verifies that the test infrastructure itself works.
 *
 * Run:  npm run test:run
 */
import { describe, it, expect } from 'vitest';
import {
  createTestState,
  createTestEnemy,
  createTestProjectile,
  createTestParticle,
  createTestPickup,
  getFixedTimestamp,
} from './helpers';

describe('test helpers', () => {
  it('createTestState returns a valid game state with fixed lastTime', () => {
    const state = createTestState();
    expect(state.lastTime).toBe(getFixedTimestamp());
    expect(state.player.hp).toBe(300);
    expect(state.player.maxHp).toBe(300);
    expect(state.enemies).toEqual([]);
    expect(state.projectiles).toEqual([]);
    expect(state.particles).toEqual([]);
    expect(state.pickups).toEqual([]);
    expect(state.level).toBe(1);
    expect(state.scrap).toBe(200);
  });

  it('createTestState accepts overrides', () => {
    const state = createTestState({ scrap: 500, level: 5 });
    expect(state.scrap).toBe(500);
    expect(state.level).toBe(5);
    // defaults preserved
    expect(state.player.hp).toBe(300);
  });

  it('createTestState merges player overrides', () => {
    const state = createTestState({ player: { hp: 100, shield: 50 } });
    expect(state.player.hp).toBe(100);
    expect(state.player.shield).toBe(50);
    // other player defaults preserved
    expect(state.player.maxHp).toBe(300);
    expect(state.player.speed).toBe(120);
  });

  it('createTestEnemy creates a fighter by default', () => {
    const enemy = createTestEnemy(100, 200);
    expect(enemy.type).toBe('fighter');
    expect(enemy.x).toBe(100);
    expect(enemy.y).toBe(200);
    expect(enemy.active).toBe(true);
    expect(enemy.hp).toBe(30);
    expect(enemy.maxHp).toBe(30);
    expect(enemy.shield).toBe(0);
    expect(enemy.maxShield).toBe(0);
    expect(enemy.fireCooldown).toBe(0);
  });

  it('createTestEnemy applies type-specific configs', () => {
    const heavy = createTestEnemy(0, 0, 'heavy');
    expect(heavy.type).toBe('heavy');
    expect(heavy.hp).toBe(100);
    expect(heavy.radius).toBe(25);
    expect(heavy.speed).toBe(50);

    const shielded = createTestEnemy(0, 0, 'shielded');
    expect(shielded.shield).toBe(80);
    expect(shielded.maxShield).toBe(80);

    const shooter = createTestEnemy(0, 0, 'shooter');
    expect(shooter.fireCooldown).toBe(1.5);
  });

  it('createTestProjectile creates a valid projectile', () => {
    const proj = createTestProjectile(0, 0, Math.PI / 4, 'autocannon');
    expect(proj.x).toBe(0);
    expect(proj.y).toBe(0);
    expect(proj.active).toBe(true);
    expect(proj.type).toBe('autocannon');
    expect(proj.isEnemy).toBe(false);
    expect(proj.pierce).toBe(0);
    expect(proj.hitList).toEqual([]);
    expect(proj.life).toBe(0);
    expect(proj.radius).toBe(5);
  });

  it('createTestProjectile sets isEnemy for enemy projectiles', () => {
    const enemyProj = createTestProjectile(0, 0, 0, 'enemy_bullet');
    expect(enemyProj.isEnemy).toBe(true);
  });

  it('createTestProjectile uses correct radius per type', () => {
    expect(createTestProjectile(0, 0, 0, 'plasma').radius).toBe(12);
    expect(createTestProjectile(0, 0, 0, 'missile').radius).toBe(8);
    expect(createTestProjectile(0, 0, 0, 'autocannon').radius).toBe(5);
  });

  it('createTestParticle creates a valid particle', () => {
    const particle = createTestParticle(50, 60);
    expect(particle.x).toBe(50);
    expect(particle.y).toBe(60);
    expect(particle.active).toBe(true);
    expect(particle.life).toBe(1.0);
    expect(particle.maxLife).toBe(1.0);
  });

  it('createTestPickup creates a valid pickup', () => {
    const pickup = createTestPickup(100, 200, 3);
    expect(pickup.x).toBe(100);
    expect(pickup.y).toBe(200);
    expect(pickup.value).toBe(3);
    expect(pickup.active).toBe(true);
    expect(pickup.radius).toBe(6);
  });
});
