import { describe, it, expect, vi } from 'vitest';
import { tryFireEnemyWeapon } from '../../engine/systems/enemyFire';
import { updateAttackWarnings } from '../../engine/systems/attackWarnings';
import { checkDirectionalShield, killEnemy } from '../../engine/combat';
import { spawnMiniInterceptors } from '../../engine/spawner';
import { createTestEnemy, createTestState } from '../helpers';

describe('Elite Variants', () => {
  describe('Sniper', () => {
    it('fires with extended warning duration (1.5s)', () => {
      const g = createTestState();
      const enemy = createTestEnemy(200, 0, 'shooter');
      enemy.eliteVariant = 'sniper';
      enemy.fireCooldown = 0;
      enemy.hp = 60;
      enemy.maxHp = 60;

      const fired = tryFireEnemyWeapon(enemy, Math.PI, 300, 0.016, 1, g);
      expect(fired).toBe(true);

      // Check warning was spawned with extended duration
      expect(g.attackWarnings).toHaveLength(1);
      expect(g.attackWarnings[0].life).toBe(1.5);
    });

    it('fires a high damage projectile (25 damage)', () => {
      const g = createTestState();
      const enemy = createTestEnemy(200, 0, 'shooter');
      enemy.eliteVariant = 'sniper';
      enemy.fireCooldown = 0;

      tryFireEnemyWeapon(enemy, Math.PI, 300, 0.016, 1, g);
      // Fire the warning callback
      updateAttackWarnings(10, g);

      expect(g.projectiles).toHaveLength(1);
      expect(g.projectiles[0].damage).toBe(25);
    });
  });

  describe('Tank', () => {
    it('has directional shields that absorb hits from correct side', () => {
      const enemy = createTestEnemy(0, 0, 'heavy');
      enemy.eliteVariant = 'tank';
      enemy.directionalShields = Array(8).fill(30);

      // Projectile coming from angle 0 (right side = side 0) with damage=50
      const absorbed = checkDirectionalShield(enemy, 50, 0, 50);
      expect(absorbed).toBe(true); // fully consumed (30-50=0)
      expect(enemy.directionalShields[0]).toBe(0);
      // Other shields still intact
      expect(enemy.directionalShields[1]).toBe(30);
    });

   it('does not absorb from depleted shield side', () => {
      const enemy = createTestEnemy(0, 0, 'heavy');
      enemy.eliteVariant = 'tank';
      enemy.directionalShields = Array(8).fill(30);

      // First hit with damage=50 fully consumes shield side (30-50=0)
      checkDirectionalShield(enemy, 50, 0, 50);
      // Second hit from same side should NOT absorb (shield already depleted)
      const absorbed = checkDirectionalShield(enemy, 50, 0, 50);
      expect(absorbed).toBe(false);
    });

    it('calculates correct side index from hit angle', () => {
      const enemy = createTestEnemy(0, 0, 'heavy');
      enemy.eliteVariant = 'tank';
      enemy.directionalShields = Array(8).fill(30);

      // Hit from top (angle PI/2) should be side 2
      checkDirectionalShield(enemy, 0, 50, 50);
      expect(enemy.directionalShields[2]).toBe(0);

      // Hit from left (angle PI) should be side 4
      checkDirectionalShield(enemy, -50, 0, 50);
      expect(enemy.directionalShields[4]).toBe(0);
    });

    it('returns false when enemy has no directionalShields', () => {
      const enemy = createTestEnemy(0, 0, 'fighter');
      const absorbed = checkDirectionalShield(enemy, 50, 0);
      expect(absorbed).toBe(false);
    });

    it('fires cannon like base heavy type', () => {
      const g = createTestState();
      const enemy = createTestEnemy(200, 0, 'heavy');
      enemy.eliteVariant = 'tank';
      enemy.fireCooldown = 0;
      enemy.directionalShields = Array(8).fill(30);

      const fired = tryFireEnemyWeapon(enemy, Math.PI, 300, 0.016, 1, g);
      expect(fired).toBe(true);
      expect(g.attackWarnings).toHaveLength(1);
    });
  });

  describe('Swarm Leader', () => {
    it('spawns mini-interceptors on death', () => {
      const g = createTestState();
      const enemy = createTestEnemy(100, 100, 'interceptor');
      enemy.eliteVariant = 'swarmLeader';
      enemy.active = true;
      enemy.hp = 1;
      enemy.maxHp = 1;

      killEnemy(g, enemy, null);

      // Swarm leader should be dead
      expect(enemy.active).toBe(false);

      // Should have spawned 2 mini-interceptors
      const minis = g.enemies.filter(e => e.type === 'mini_interceptor');
      expect(minis).toHaveLength(2);
    });

    it('mini-interceptors have correct stats', () => {
      const g = createTestState();
      spawnMiniInterceptors(g, 100, 100, 2);

      const minis = g.enemies.filter(e => e.type === 'mini_interceptor');
      expect(minis).toHaveLength(2);

      for (const mini of minis) {
        expect(mini.hp).toBe(20);
        expect(mini.maxHp).toBe(20);
        expect(mini.speed).toBe(200);
        expect(mini.radius).toBe(8);
        expect(mini.fireCooldown).toBe(0);
        expect(mini.formation).toBe('kamikaze');
      }
    });

    it('fires interceptor burst pattern', () => {
      const g = createTestState();
      const enemy = createTestEnemy(200, 0, 'interceptor');
      enemy.eliteVariant = 'swarmLeader';
      enemy.fireCooldown = 0;

      const fired = tryFireEnemyWeapon(enemy, Math.PI, 300, 0.016, 1, g);
      expect(fired).toBe(true);

      // Interceptor fires 3-shot burst, so 3 warnings
      expect(g.attackWarnings).toHaveLength(3);
    });
  });

  describe('Arsenal', () => {
    it('fires 2 missiles with spread', () => {
      const g = createTestState();
      const enemy = createTestEnemy(200, 0, 'missile_boat');
      enemy.eliteVariant = 'arsenal';
      enemy.fireCooldown = 0;

      const fired = tryFireEnemyWeapon(enemy, Math.PI, 300, 0.016, 1, g);
      expect(fired).toBe(true);

      // Arsenal fires 2 missiles with spread
      expect(g.attackWarnings).toHaveLength(2);
    });

    it('arsenal missiles deal 30 damage each', () => {
      const g = createTestState();
      const enemy = createTestEnemy(200, 0, 'missile_boat');
      enemy.eliteVariant = 'arsenal';
      enemy.fireCooldown = 0;

      tryFireEnemyWeapon(enemy, Math.PI, 300, 0.016, 1, g);
      updateAttackWarnings(10, g);

      expect(g.projectiles).toHaveLength(2);
      for (const proj of g.projectiles) {
        expect(proj.damage).toBe(30);
        expect(proj.type).toBe('enemy_missile');
      }
    });

    it('arsenal missiles have angle spread', () => {
      const g = createTestState();
      const enemy = createTestEnemy(200, 0, 'missile_boat');
      enemy.eliteVariant = 'arsenal';
      enemy.fireCooldown = 0;

      tryFireEnemyWeapon(enemy, Math.PI, 300, 0.016, 1, g);
      updateAttackWarnings(10, g);

      // Check that missiles have different angles (spread)
      const angles = g.projectiles.map(p => Math.atan2(p.vy, p.vx));
      expect(angles[0]).not.toBe(angles[1]);
    });
  });

  describe('Mini-interceptor', () => {
    it('does not fire weapons (kamikaze behavior)', () => {
      const g = createTestState();
      const enemy = {
        id: 999,
        x: 100, y: 100,
        hp: 20, maxHp: 20,
        shield: 0, maxShield: 0,
        speed: 200, radius: 8,
        color: 0xeab308,
        type: 'mini_interceptor',
        active: true,
        fireCooldown: 0,
      };

      // tryFireEnemyWeapon should return false for mini_interceptor
      // because fireCooldown === 0 but the type check won't match
      const fired = tryFireEnemyWeapon(enemy, Math.PI, 100, 0.016, 1, g);
      // Mini-interceptors don't have a matching type in tryFireEnemyWeapon
      expect(fired).toBe(false);
      expect(g.attackWarnings).toHaveLength(0);
      expect(g.projectiles).toHaveLength(0);
    });
  });

  describe('Elite variant spawning', () => {
    it('elite variants are tracked on kill_elite missions', () => {
      const g = createTestState({
        mission: { type: 'kill_elite', target: 1, current: 0, completed: false },
      });
      const enemy = createTestEnemy(100, 100, 'shooter');
      enemy.eliteVariant = 'sniper';
      enemy.active = true;
      enemy.hp = 1;

      let missionCompleted = false;
      killEnemy(g, enemy, () => { missionCompleted = true; });

      expect(g.mission.current).toBe(1);
      expect(missionCompleted).toBe(true);
    });
  });
});
