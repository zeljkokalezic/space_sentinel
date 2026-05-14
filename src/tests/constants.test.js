import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../constants/gameConfig';
import { UPGRADE_DATA } from '../constants/upgrades';

/* ------------------------------------------------------------------ */
/*  GAME_CONFIG structure & value validation                           */
/* ------------------------------------------------------------------ */

describe('GAME_CONFIG', () => {
  /* -------------------------------------------------------------- */
  /*  1. Top-level sections                                         */
  /* -------------------------------------------------------------- */

  it('has all required top-level sections', () => {
    const required = [
      'player', 'thrusters', 'magnet', 'weapons', 'shield',
      'enemies', 'world', 'escort', 'beacon', 'sabotage',
      'cleanup', 'transition', 'projectile', 'particles',
    ];
    for (const section of required) {
      expect(GAME_CONFIG[section]).toBeDefined();
    }
  });

  /* -------------------------------------------------------------- */
  /*  2. GAME_CONFIG.player fields                                  */
  /* -------------------------------------------------------------- */

  it('player has all required fields', () => {
    const required = [
      'radius', 'baseHp', 'baseShield', 'baseSpeed',
      'magnetRadius', 'turnSpeed', 'worldBounds',
    ];
    for (const field of required) {
      expect(GAME_CONFIG.player[field]).toBeDefined();
    }
  });

  /* -------------------------------------------------------------- */
  /*  3. GAME_CONFIG.weapons sub-keys                               */
  /* -------------------------------------------------------------- */

  it('weapons has autocannon, plasma, missiles, pointDefense', () => {
    const required = ['autocannon', 'plasma', 'missiles', 'pointDefense'];
    for (const weapon of required) {
      expect(GAME_CONFIG.weapons[weapon]).toBeDefined();
    }
  });

  /* -------------------------------------------------------------- */
  /*  4. GAME_CONFIG.weapons.autocannon fields                      */
  /* -------------------------------------------------------------- */

  it('weapons.autocannon has all required fields', () => {
    const required = [
      'baseDamage', 'damagePerLevel', 'baseCooldown', 'cooldownReduction',
      'shotsPerExtraLevels', 'speed', 'speedVariance', 'minCooldown',
    ];
    for (const field of required) {
      expect(GAME_CONFIG.weapons.autocannon[field]).toBeDefined();
    }
  });

  /* -------------------------------------------------------------- */
  /*  5. GAME_CONFIG.enemies fields                                 */
  /* -------------------------------------------------------------- */

  it('enemies has all required fields', () => {
    const required = [
      'spawnRadiusMin', 'spawnRadiusMax', 'baseSpawnRate',
      'eliteBonusBase', 'eliteBonusTimeFactor', 'eliteBonusMax',
    ];
    for (const field of required) {
      expect(GAME_CONFIG.enemies[field]).toBeDefined();
    }
  });

  /* -------------------------------------------------------------- */
  /*  6. GAME_CONFIG.escort fields                                  */
  /* -------------------------------------------------------------- */

  it('escort has all required fields', () => {
    const required = [
      'baseHp', 'hpPerLevel', 'baseSpeed', 'speedPerLevel',
      'baseLives', 'livesReductionPer4Levels', 'minLives',
      'spawnSpread', 'baseDistance', 'distancePerLevel',
      'respawnTimer', 'evasionCooldown', 'evasionThreatRadius',
      'destinationThreshold', 'worldBounds', 'ramDamage', 'respawnSpread',
    ];
    for (const field of required) {
      expect(GAME_CONFIG.escort[field]).toBeDefined();
    }
  });

  /* -------------------------------------------------------------- */
  /*  6b. GAME_CONFIG.beacon fields                                 */
  /* -------------------------------------------------------------- */

  it('beacon has all required fields', () => {
    const required = [
      'baseHp', 'hpPerLevel', 'spawnSpread', 'radius', 'defenseRadius', 'color',
    ];
    for (const field of required) {
      expect(GAME_CONFIG.beacon[field]).toBeDefined();
    }
  });

  /* -------------------------------------------------------------- */
  /*  6c. GAME_CONFIG.sabotage fields                               */
  /* -------------------------------------------------------------- */

  it('sabotage has all required fields', () => {
    const required = [
      'baseStructures', 'structuresPer2Levels', 'maxStructures',
      'structureHp', 'hpPerLevel', 'structureRadius', 'fireCooldown',
      'projectileDamage', 'projectileSpeed', 'spawnSpreadMin',
      'spawnSpreadMax', 'protectRadius', 'color', 'scrapPerDestroy',
    ];
    for (const field of required) {
      expect(GAME_CONFIG.sabotage[field]).toBeDefined();
    }
  });

  /* -------------------------------------------------------------- */
  /*  7. All numeric values are non-negative finite numbers         */
  /* -------------------------------------------------------------- */

  function assertPositiveNumbers(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (typeof value === 'number') {
        expect(value, `GAME_CONFIG.${currentPath}`).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(value), `GAME_CONFIG.${currentPath} is finite`).toBe(true);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        assertPositiveNumbers(value, currentPath);
      }
    }
  }

  it('all numeric values are non-negative finite numbers', () => {
    assertPositiveNumbers(GAME_CONFIG);
  });

  /* -------------------------------------------------------------- */
  /*  8. Logical constraints                                        */
  /* -------------------------------------------------------------- */

  it('spawnRadiusMin < spawnRadiusMax', () => {
    expect(GAME_CONFIG.enemies.spawnRadiusMin).toBeLessThan(GAME_CONFIG.enemies.spawnRadiusMax);
  });

  it('minCooldown < baseCooldown for all weapons that have both', () => {
    for (const [name, weapon] of Object.entries(GAME_CONFIG.weapons)) {
      if (weapon.minCooldown !== undefined && weapon.baseCooldown !== undefined) {
        expect(weapon.minCooldown, `${name}.minCooldown < baseCooldown`).toBeLessThan(weapon.baseCooldown);
      }
    }
  });

  it('minLives >= 1', () => {
    expect(GAME_CONFIG.escort.minLives).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  UPGRADE_DATA structure & value validation                          */
/* ------------------------------------------------------------------ */

describe('UPGRADE_DATA', () => {
  const keys = Object.keys(UPGRADE_DATA);

  /* -------------------------------------------------------------- */
  /*  9. Exactly 9 upgrade types                                    */
  /* -------------------------------------------------------------- */

  it('has exactly 9 upgrade types', () => {
    expect(keys).toHaveLength(9);
  });

  /* -------------------------------------------------------------- */
  /*  10. Upgrade type keys                                         */
  /* -------------------------------------------------------------- */

  it('has the expected upgrade type keys', () => {
    const expected = [
      'autoAim', 'autocannon', 'plasma', 'missiles',
      'hull', 'shield', 'thrusters', 'magnet', 'pointDefense',
    ];
    for (const type of expected) {
      expect(keys).toContain(type);
    }
  });

  /* -------------------------------------------------------------- */
  /*  11. Each upgrade has required fields with correct types        */
  /* -------------------------------------------------------------- */

  it('each upgrade has required fields with correct types and positive numeric values', () => {
    for (const [type, upgrade] of Object.entries(UPGRADE_DATA)) {
      // name: string
      expect(upgrade.name, `${type}.name is string`).toBeTypeOf('string');
      expect(upgrade.name.length, `${type}.name is non-empty`).toBeGreaterThan(0);

      // icon: function (React component), string, or object (lucide-react exports
      // resolve as plain objects in Node test env)
      expect(
        typeof upgrade.icon === 'function' ||
        typeof upgrade.icon === 'string' ||
        typeof upgrade.icon === 'object',
        `${type}.icon is function/string/object`,
      ).toBe(true);

      // desc (description): string
      expect(upgrade.desc, `${type}.desc is string`).toBeTypeOf('string');
      expect(upgrade.desc.length, `${type}.desc is non-empty`).toBeGreaterThan(0);

      // baseCost: number > 0
      expect(upgrade.baseCost, `${type}.baseCost is number`).toBeTypeOf('number');
      expect(upgrade.baseCost, `${type}.baseCost > 0`).toBeGreaterThan(0);

      // costMult: number > 0
      expect(upgrade.costMult, `${type}.costMult is number`).toBeTypeOf('number');
      expect(upgrade.costMult, `${type}.costMult > 0`).toBeGreaterThan(0);

      // maxLevel: number > 0
      expect(upgrade.maxLevel, `${type}.maxLevel is number`).toBeTypeOf('number');
      expect(upgrade.maxLevel, `${type}.maxLevel > 0`).toBeGreaterThan(0);
    }
  });

  /* -------------------------------------------------------------- */
  /*  12. Cost scaling: baseCost * costMult^(level-1) is increasing  */
  /* -------------------------------------------------------------- */

  it('cost scaling formula produces non-decreasing costs for each level up to maxLevel', () => {
    for (const [type, upgrade] of Object.entries(UPGRADE_DATA)) {
      let prevCost = upgrade.baseCost;

      for (let level = 2; level <= upgrade.maxLevel; level++) {
        const cost = upgrade.baseCost * Math.pow(upgrade.costMult, level - 1);
        expect(cost, `${type} cost at level ${level} >= level ${level - 1}`).toBeGreaterThanOrEqual(prevCost);
        prevCost = cost;
      }
    }
  });

  /* -------------------------------------------------------------- */
  /*  13. All upgrade names are unique                              */
  /* -------------------------------------------------------------- */

  it('all upgrade names are unique', () => {
    const names = Object.values(UPGRADE_DATA).map((u) => u.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  /* -------------------------------------------------------------- */
  /*  14. All upgrade type keys are unique                          */
  /* -------------------------------------------------------------- */

  it('all upgrade type keys are unique', () => {
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});
