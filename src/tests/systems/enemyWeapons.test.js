import { describe, it, expect } from 'vitest';
import { tryFireEnemyWeapon } from '../../engine/systems/enemyFire';
import { updateAttackWarnings } from '../../engine/systems/attackWarnings';
import { createTestEnemy, createTestState } from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

describe('Heavy enemy weapon', () => {
  it('fires a single slow cannon projectile', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'heavy');
    enemy.fireCooldown = 0;

    const dist = 200;
    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const result = tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g);

    expect(result).toBe(true);
    expect(g.attackWarnings).toHaveLength(1);
    expect(enemy.warningTimer).toBeGreaterThan(0);
    expect(enemy.fireCooldown).toBeGreaterThan(0);

    // Fire the projectile by expiring the warning
    updateAttackWarnings(10, g);
    expect(g.projectiles).toHaveLength(1);
    expect(g.projectiles[0].type).toBe('enemy_cannon');
    expect(g.projectiles[0].damage).toBe(GAME_CONFIG.enemyWeapons.heavy.damage);
    expect(g.projectiles[0].vx).toBeCloseTo(Math.cos(angle) * GAME_CONFIG.enemyWeapons.heavy.projectileSpeed, 2);
    expect(g.projectiles[0].vy).toBeCloseTo(Math.sin(angle) * GAME_CONFIG.enemyWeapons.heavy.projectileSpeed, 2);
  });

  it('does not fire when out of range', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'heavy');
    enemy.fireCooldown = 0;

    const dist = g.player.radius * GAME_CONFIG.enemyWeapons.heavy.rangeMult + 1000;
    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const result = tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g);

    expect(result).toBe(false);
    expect(g.attackWarnings).toHaveLength(0);
  });

  it('does not fire during cooldown', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'heavy');
    enemy.fireCooldown = 2.0;

    const dist = 200;
    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const result = tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g);

    expect(result).toBe(false);
    expect(g.attackWarnings).toHaveLength(0);
  });

  it('does not fire delayed cannon after enemy dies', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'heavy');
    enemy.fireCooldown = 0;

    tryFireEnemyWeapon(enemy, Math.PI, 200, 0.016, 1, g);
    enemy.active = false;
    enemy.hp = 0;
    updateAttackWarnings(10, g);

    expect(g.projectiles).toHaveLength(0);
    expect(g.attackWarnings).toHaveLength(0);
  });
});

describe('Interceptor enemy weapon', () => {
  it('fires 3 shots with spread', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'interceptor');
    enemy.fireCooldown = 0;

    const dist = 200;
    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const result = tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g);

    expect(result).toBe(true);
    expect(g.attackWarnings).toHaveLength(3);
    expect(enemy.warningTimer).toBeGreaterThan(0);
    expect(enemy.fireCooldown).toBeGreaterThan(0);

    // Fire all projectiles by expiring warnings
    updateAttackWarnings(10, g);
    expect(g.projectiles).toHaveLength(3);

    for (let i = 0; i < 3; i++) {
      expect(g.projectiles[i].type).toBe('enemy_bullet');
      expect(g.projectiles[i].damage).toBe(GAME_CONFIG.enemyWeapons.interceptor.damage);
    }

    // Verify spread: angles should differ
    const angles = g.projectiles.map(p => Math.atan2(p.vy, p.vx));
    const spread = Math.max(...angles) - Math.min(...angles);
    expect(spread).toBeGreaterThan(0.1);
  });

  it('does not fire when out of range', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'interceptor');
    enemy.fireCooldown = 0;

    const dist = g.player.radius * GAME_CONFIG.enemyWeapons.interceptor.rangeMult + 1000;
    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const result = tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g);

    expect(result).toBe(false);
    expect(g.attackWarnings).toHaveLength(0);
  });

  it('does not fire delayed burst after enemy dies', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'interceptor');
    enemy.fireCooldown = 0;

    tryFireEnemyWeapon(enemy, Math.PI, 200, 0.016, 1, g);
    enemy.active = false;
    enemy.hp = 0;
    updateAttackWarnings(10, g);

    expect(g.projectiles).toHaveLength(0);
    expect(g.attackWarnings).toHaveLength(0);
  });
});

describe('Fighter enemy weapon', () => {
  it('fires a single aimed bullet', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'fighter');
    enemy.fireCooldown = 0;

    const dist = 200;
    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const result = tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g);

    expect(result).toBe(true);
    expect(g.attackWarnings).toHaveLength(1);
    expect(enemy.warningTimer).toBeGreaterThan(0);
    expect(enemy.fireCooldown).toBeGreaterThan(0);

    // Fire the projectile by expiring the warning
    updateAttackWarnings(10, g);
    expect(g.projectiles).toHaveLength(1);
    expect(g.projectiles[0].type).toBe('enemy_bullet');
    expect(g.projectiles[0].damage).toBe(GAME_CONFIG.enemyWeapons.fighter.damage);
    expect(g.projectiles[0].vx).toBeCloseTo(Math.cos(angle) * GAME_CONFIG.enemyWeapons.fighter.projectileSpeed, 2);
    expect(g.projectiles[0].vy).toBeCloseTo(Math.sin(angle) * GAME_CONFIG.enemyWeapons.fighter.projectileSpeed, 2);
  });

  it('does not fire when out of range', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'fighter');
    enemy.fireCooldown = 0;

    const dist = g.player.radius * GAME_CONFIG.enemyWeapons.fighter.rangeMult + 1000;
    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const result = tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g);

    expect(result).toBe(false);
    expect(g.attackWarnings).toHaveLength(0);
  });

  it('does not fire delayed bullet after enemy dies', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'fighter');
    enemy.fireCooldown = 0;

    tryFireEnemyWeapon(enemy, Math.PI, 200, 0.016, 1, g);
    enemy.active = false;
    enemy.hp = 0;
    updateAttackWarnings(10, g);

    expect(g.projectiles).toHaveLength(0);
    expect(g.attackWarnings).toHaveLength(0);
  });
});

describe('Damage scaling with currentDiffMult', () => {
  it('heavy damage scales with difficulty multiplier', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'heavy');
    enemy.fireCooldown = 0;

    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    tryFireEnemyWeapon(enemy, angle, 200, 0.016, 1, g);
    updateAttackWarnings(10, g);
    const baseDamage = g.projectiles[0].damage;

    // Now test with diffMult = 2
    const g2 = createTestState();
    const enemy2 = createTestEnemy(200, 0, 'heavy');
    enemy2.fireCooldown = 0;
    tryFireEnemyWeapon(enemy2, angle, 200, 0.016, 2, g2);
    updateAttackWarnings(10, g2);

    expect(g2.projectiles[0].damage).toBeCloseTo(baseDamage * 2, 0);
  });

  it('interceptor damage scales with difficulty multiplier', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'interceptor');
    enemy.fireCooldown = 0;

    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    tryFireEnemyWeapon(enemy, angle, 200, 0.016, 1, g);
    updateAttackWarnings(10, g);
    const baseDamage = g.projectiles[0].damage;

    const g2 = createTestState();
    const enemy2 = createTestEnemy(200, 0, 'interceptor');
    enemy2.fireCooldown = 0;
    tryFireEnemyWeapon(enemy2, angle, 200, 0.016, 2, g2);
    updateAttackWarnings(10, g2);

    expect(g2.projectiles[0].damage).toBeCloseTo(baseDamage * 2, 0);
  });

  it('fighter damage scales with difficulty multiplier', () => {
    const g = createTestState();
    const enemy = createTestEnemy(200, 0, 'fighter');
    enemy.fireCooldown = 0;

    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    tryFireEnemyWeapon(enemy, angle, 200, 0.016, 1, g);
    updateAttackWarnings(10, g);
    const baseDamage = g.projectiles[0].damage;

    const g2 = createTestState();
    const enemy2 = createTestEnemy(200, 0, 'fighter');
    enemy2.fireCooldown = 0;
    tryFireEnemyWeapon(enemy2, angle, 200, 0.016, 2, g2);
    updateAttackWarnings(10, g2);

    expect(g2.projectiles[0].damage).toBeCloseTo(baseDamage * 2, 0);
  });
});
