import { describe, it, expect } from 'vitest';
import { tryFireEnemyWeapon } from '../../engine/systems/enemyFire';
import { updateAttackWarnings } from '../../engine/systems/attackWarnings';
import { createTestEnemy, createTestState } from '../helpers';

describe('tryFireEnemyWeapon', () => {
  it('does not fire a delayed shooter projectile after the enemy dies', () => {
    const g = createTestState({ spawnCooldown: 10 });
    const enemy = createTestEnemy(100, 0, 'shooter');
    enemy.fireCooldown = 0;

    tryFireEnemyWeapon(enemy, Math.PI, 100, 0.016, 1, g);
    enemy.active = false;
    enemy.hp = 0;
    updateAttackWarnings(10, g);

    expect(g.projectiles).toHaveLength(0);
    expect(g.attackWarnings).toHaveLength(0);
  });

  it('does not fire delayed missiles after the enemy dies', () => {
    const g = createTestState({ spawnCooldown: 10 });
    const enemy = createTestEnemy(100, 0, 'missile_boat');
    enemy.fireCooldown = 0;

    tryFireEnemyWeapon(enemy, Math.PI, 100, 0.016, 1, g);
    enemy.active = false;
    enemy.hp = 0;
    updateAttackWarnings(10, g);

    expect(g.projectiles).toHaveLength(0);
    expect(g.attackWarnings).toHaveLength(0);
  });
});
