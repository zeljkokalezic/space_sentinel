/**
 * Unit tests for systems/weapons.js — updateWeapons(dt, g)
 *
 * Covers: autocannon firing, plasma firing, missile firing, point defense,
 * cooldowns, auto-aim gating, weapon levels (multishot / damage scaling),
 * and shield regeneration.
 *
 * Run:  npm run test:run -- src/tests/systems/weapons.test.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateWeapons } from '../../engine/systems/weapons';
import { createTestState, createTestEnemy, createTestProjectile } from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

/* ──────────────────────────────────────────────
 * Shared helpers
 * ────────────────────────────────────────────── */
const C = GAME_CONFIG;

/**
 * Build a state with autocannon level 1 and cooldowns cleared, so the
 * autocannon will fire on the very first call.
 */
function stateWithAutocannon(overrides = {}) {
  return createTestState({
    levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
    ...overrides,
  });
}

/**
 * Build a state with plasma level 1 and cooldowns cleared.
 */
function stateWithPlasma(overrides = {}) {
  return createTestState({
    levels: { autocannon: 0, plasma: 1, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
    ...overrides,
  });
}

/**
 * Build a state with missiles level 1 and cooldowns cleared.
 */
function stateWithMissiles(overrides = {}) {
  return createTestState({
    levels: { autocannon: 0, plasma: 0, missiles: 1, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
    ...overrides,
  });
}

/**
 * Build a state with pointDefense level 1 and cooldowns cleared.
 */
function stateWithPointDefense(overrides = {}) {
  return createTestState({
    levels: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 1, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
    ...overrides,
  });
}

/* ══════════════════════════════════════════════
 * 1. Autocannon firing
 * ══════════════════════════════════════════════ */
describe('autocannon firing', () => {
  it('creates one projectile when autocannon level is 1', () => {
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('projectile has type "autocannon"', () => {
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].type).toBe('autocannon');
  });

  it('projectile has correct base damage (level 1 = baseDamage + 1 * damagePerLevel)', () => {
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    const expectedDmg = C.weapons.autocannon.baseDamage + 1 * C.weapons.autocannon.damagePerLevel;
    expect(g.projectiles[0].damage).toBe(expectedDmg);
  });

  it('projectile has no pierce (autocannon pierce = 0)', () => {
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].pierce).toBe(0);
  });

  it('projectile is active on creation', () => {
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].active).toBe(true);
  });

  it('projectile speed is within baseSpeed ± speedVariance', () => {
    const g = stateWithAutocannon();
    g.player.aimAngle = 0;
    updateWeapons(0.016, g);
    const p = g.projectiles[0];
    const speed = Math.hypot(p.vx, p.vy);
    expect(speed).toBeGreaterThanOrEqual(C.weapons.autocannon.speed);
    expect(speed).toBeLessThanOrEqual(C.weapons.autocannon.speed + C.weapons.autocannon.speedVariance);
  });

  it('projectile spawns offset from player in aim direction', () => {
    const g = stateWithAutocannon({ player: { ...createTestState().player, aimAngle: 0 } });
    g.player.aimAngle = 0;
    updateWeapons(0.016, g);
    // At angle 0, projectile should be to the right of player (x > 0)
    expect(g.projectiles[0].x).toBeGreaterThan(0);
  });

  it('sets cooldown after firing', () => {
    const g = stateWithAutocannon();
    expect(g.cooldowns.autocannon).toBe(0);
    updateWeapons(0.016, g);
    expect(g.cooldowns.autocannon).toBeGreaterThan(0);
  });

  it('cooldown value respects minCooldown floor', () => {
    // Very high autocannon level — cooldown should not go below minCooldown
    const g = stateWithAutocannon({
      levels: { autocannon: 50, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g);
    expect(g.cooldowns.autocannon).toBeGreaterThanOrEqual(C.weapons.autocannon.minCooldown);
  });

  it('damage scales with level', () => {
    const g1 = stateWithAutocannon({
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g1);
    const dmg1 = g1.projectiles[0].damage;

    const g2 = stateWithAutocannon({
      levels: { autocannon: 5, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g2);
    const dmg5 = g2.projectiles[0].damage;

    expect(dmg5).toBeGreaterThan(dmg1);
    expect(dmg5).toBe(C.weapons.autocannon.baseDamage + 5 * C.weapons.autocannon.damagePerLevel);
  });

  it('cooldown decreases as level increases', () => {
    const g1 = stateWithAutocannon({
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g1);
    const cd1 = g1.cooldowns.autocannon;

    const g2 = stateWithAutocannon({
      levels: { autocannon: 5, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g2);
    const cd5 = g2.cooldowns.autocannon;

    expect(cd5).toBeLessThan(cd1);
  });

  it('does not fire when autocannon level is 0', () => {
    const g = createTestState();
    g.levels.autocannon = 0;
    g.cooldowns.autocannon = 0;
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });
});

/* ══════════════════════════════════════════════
 * 2. Plasma firing
 * ══════════════════════════════════════════════ */
describe('plasma firing', () => {
  it('creates one projectile when plasma level is 1', () => {
    const g = stateWithPlasma();
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('projectile has type "plasma"', () => {
    const g = stateWithPlasma();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].type).toBe('plasma');
  });

  it('projectile has correct damage (level 1)', () => {
    const g = stateWithPlasma();
    updateWeapons(0.016, g);
    const expectedDmg = C.weapons.plasma.baseDamage + 1 * C.weapons.plasma.damagePerLevel;
    expect(g.projectiles[0].damage).toBe(expectedDmg);
  });

  it('projectile has correct radius (12 for plasma)', () => {
    const g = stateWithPlasma();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].radius).toBe(12);
  });

  it('projectile has pierce = 1 + floor(level / 2)', () => {
    // Level 1: pierce = 1 + floor(1/2) = 1
    const g1 = stateWithPlasma();
    updateWeapons(0.016, g1);
    expect(g1.projectiles[0].pierce).toBe(1);

    // Level 4: pierce = 1 + floor(4/2) = 3
    const g4 = stateWithPlasma({
      levels: { autocannon: 0, plasma: 4, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g4);
    expect(g4.projectiles[0].pierce).toBe(3);
  });

  it('projectile speed equals baseSpeed (no variance)', () => {
    const g = stateWithPlasma();
    g.player.aimAngle = 0;
    updateWeapons(0.016, g);
    const speed = Math.hypot(g.projectiles[0].vx, g.projectiles[0].vy);
    expect(speed).toBeCloseTo(C.weapons.plasma.baseSpeed);
  });

  it('sets cooldown after firing', () => {
    const g = stateWithPlasma();
    updateWeapons(0.016, g);
    expect(g.cooldowns.plasma).toBeGreaterThan(0);
  });

  it('damage scales with level', () => {
    const g1 = stateWithPlasma();
    updateWeapons(0.016, g1);

    const g5 = stateWithPlasma({
      levels: { autocannon: 0, plasma: 5, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g5);

    expect(g5.projectiles[0].damage).toBeGreaterThan(g1.projectiles[0].damage);
    expect(g5.projectiles[0].damage).toBe(C.weapons.plasma.baseDamage + 5 * C.weapons.plasma.damagePerLevel);
  });

  it('does not fire when plasma level is 0', () => {
    const g = createTestState();
    g.player.aimAngle = 0;
    g.levels.plasma = 0;
    g.cooldowns.plasma = 0;
    g.levels.autocannon = 0;
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });
});

/* ══════════════════════════════════════════════
 * 3. Missile firing
 * ══════════════════════════════════════════════ */
describe('missile firing', () => {
  it('creates one missile when missile level is 1', () => {
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('creates two missiles when missile level is 2', () => {
    const g = stateWithMissiles({
      levels: { autocannon: 0, plasma: 0, missiles: 2, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(2);
  });

  it('creates five missiles when missile level is 5', () => {
    const g = stateWithMissiles({
      levels: { autocannon: 0, plasma: 0, missiles: 5, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(5);
  });

  it('projectile has type "missile"', () => {
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].type).toBe('missile');
  });

  it('projectile has correct radius (8 for missile)', () => {
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].radius).toBe(8);
  });

  it('projectile has pierce = 0', () => {
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].pierce).toBe(0);
  });

  it('missiles are distributed in a 360-degree ring (2 missiles = opposite directions)', () => {
    const g = stateWithMissiles({
      levels: { autocannon: 0, plasma: 0, missiles: 2, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g);
    // 2 missiles: angles 0 and PI
    const angle1 = Math.atan2(g.projectiles[0].vy, g.projectiles[0].vx);
    const angle2 = Math.atan2(g.projectiles[1].vy, g.projectiles[1].vx);
    // They should be roughly opposite (difference ~ PI)
    const diff = Math.abs(angle1 - angle2);
    expect(diff).toBeCloseTo(Math.PI, 1);
  });

  it('missile speed equals baseSpeed', () => {
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    const speed = Math.hypot(g.projectiles[0].vx, g.projectiles[0].vy);
    expect(speed).toBeCloseTo(C.weapons.missiles.baseSpeed);
  });

  it('missile damage scales with level', () => {
    const g1 = stateWithMissiles();
    updateWeapons(0.016, g1);

    const g3 = stateWithMissiles({
      levels: { autocannon: 0, plasma: 0, missiles: 3, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g3);

    expect(g3.projectiles[0].damage).toBeGreaterThan(g1.projectiles[0].damage);
    expect(g3.projectiles[0].damage).toBe(C.weapons.missiles.baseDamage + 3 * C.weapons.missiles.damagePerLevel);
  });

  it('missile targets an active enemy when enemies exist', () => {
    const enemy = createTestEnemy(100, 100);
    const g = stateWithMissiles({ enemies: [enemy] });
    updateWeapons(0.016, g);
    expect(g.projectiles[0].target).toBe(enemy);
  });

  it('missile target is null when no active enemies', () => {
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].target).toBeNull();
  });

  it('sets cooldown after firing', () => {
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    expect(g.cooldowns.missiles).toBeGreaterThan(0);
  });

  it('missile cooldown respects minCooldown floor at high levels', () => {
    const g = stateWithMissiles({
      levels: { autocannon: 0, plasma: 0, missiles: 50, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
    });
    updateWeapons(0.016, g);
    expect(g.cooldowns.missiles).toBeGreaterThanOrEqual(C.weapons.missiles.minCooldown);
  });

  it('missiles fire without autoAim requirement (no hasTarget gate)', () => {
    // Missiles fire even when autoAim > 0 and no enemies exist
    const g = stateWithMissiles({
      levels: { autocannon: 0, plasma: 0, missiles: 1, pointDefense: 0, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [],
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('does not fire when missile level is 0', () => {
    const g = createTestState();
    g.player.aimAngle = 0;
    g.levels.missiles = 0;
    g.cooldowns.missiles = 0;
    g.levels.autocannon = 0;
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });
});

/* ══════════════════════════════════════════════
 * 4. Point defense
 * ══════════════════════════════════════════════ */
describe('point defense', () => {
  it('destroys nearby enemy missiles within range', () => {
    const enemyMissile = createTestProjectile(100, 100, 0);
    enemyMissile.type = 'enemy_missile';
    enemyMissile.isEnemy = true;
    const g = stateWithPointDefense({ projectiles: [enemyMissile] });
    updateWeapons(0.016, g);
    expect(enemyMissile.active).toBe(false);
  });

  it('does not destroy enemy missiles outside range', () => {
    const enemyMissile = createTestProjectile(1000, 1000, 0);
    enemyMissile.type = 'enemy_missile';
    enemyMissile.isEnemy = true;
    const g = stateWithPointDefense({ projectiles: [enemyMissile] });
    updateWeapons(0.016, g);
    expect(enemyMissile.active).toBe(true);
  });

  it('damages nearby enemies when no enemy missiles in range', () => {
    const enemy = createTestEnemy(100, 100);
    const g = stateWithPointDefense({ enemies: [enemy] });
    const initialHp = enemy.hp;
    updateWeapons(0.016, g);
    const expectedDmg = C.weapons.pointDefense.baseDamage + 1 * C.weapons.pointDefense.damagePerLevel;
    expect(enemy.hp).toBe(initialHp - expectedDmg);
  });

  it('does not damage enemies outside range', () => {
    const enemy = createTestEnemy(1000, 1000);
    const g = stateWithPointDefense({ enemies: [enemy] });
    const initialHp = enemy.hp;
    updateWeapons(0.016, g);
    expect(enemy.hp).toBe(initialHp);
  });

  it('prioritizes enemy missiles over enemies', () => {
    const enemyMissile = createTestProjectile(100, 100, 0);
    enemyMissile.type = 'enemy_missile';
    enemyMissile.isEnemy = true;
    const enemy = createTestEnemy(50, 50);
    const g = stateWithPointDefense({
      enemies: [enemy],
      projectiles: [enemyMissile],
    });
    const initialEnemyHp = enemy.hp;
    updateWeapons(0.016, g);
    // Level 1 pointDefense has maxHits = 1, so it only intercepts the missile
    expect(enemyMissile.active).toBe(false);
    expect(enemy.hp).toBe(initialEnemyHp);
  });

  it('sets cooldown only when something was hit', () => {
    const g = stateWithPointDefense({ enemies: [], projectiles: [] });
    updateWeapons(0.016, g);
    expect(g.cooldowns.pointDefense).toBe(0);
  });

  it('sets cooldown when enemy is hit', () => {
    const enemy = createTestEnemy(100, 100);
    const g = stateWithPointDefense({ enemies: [enemy] });
    updateWeapons(0.016, g);
    expect(g.cooldowns.pointDefense).toBeGreaterThan(0);
  });

  it('sets cooldown when enemy missile is intercepted', () => {
    const enemyMissile = createTestProjectile(100, 100, 0);
    enemyMissile.type = 'enemy_missile';
    enemyMissile.isEnemy = true;
    const g = stateWithPointDefense({ projectiles: [enemyMissile] });
    updateWeapons(0.016, g);
    expect(g.cooldowns.pointDefense).toBeGreaterThan(0);
  });

  it('does not fire when pointDefense level is 0', () => {
    const g = createTestState();
    g.levels.pointDefense = 0;
    g.cooldowns.pointDefense = 0;
    const enemy = createTestEnemy(100, 100);
    g.enemies = [enemy];
    const initialHp = enemy.hp;
    updateWeapons(0.016, g);
    expect(enemy.hp).toBe(initialHp);
  });

  it('point defense range increases with level', () => {
    // Level 1: range = 250 + 1*10 = 260
    // Level 5: range = 250 + 5*10 = 300
    const enemy = createTestEnemy(280, 0); // distance 280 from player at (0,0)
    // At level 1 (range 260), enemy is outside range
    const g1 = stateWithPointDefense({ enemies: [createTestEnemy(280, 0)] });
    updateWeapons(0.016, g1);
    expect(g1.enemies[0].hp).toBe(30); // untouched

    // At level 5 (range 300), enemy is within range
    const g5 = stateWithPointDefense({
      levels: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 5, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [createTestEnemy(280, 0)],
    });
    updateWeapons(0.016, g5);
    expect(g5.enemies[0].hp).toBeLessThan(30); // damaged
  });

  it('point defense damage increases with level', () => {
    const enemy1 = createTestEnemy(100, 100);
    const g1 = stateWithPointDefense({ enemies: [enemy1] });
    updateWeapons(0.016, g1);
    const dmg1 = 30 - enemy1.hp;

    const enemy5 = createTestEnemy(100, 100);
    const g5 = stateWithPointDefense({
      levels: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 5, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [enemy5],
    });
    updateWeapons(0.016, g5);
    const dmg5 = 30 - enemy5.hp;

    expect(dmg5).toBeGreaterThan(dmg1);
    expect(dmg5).toBe(C.weapons.pointDefense.baseDamage + 5 * C.weapons.pointDefense.damagePerLevel);
  });

  it('max hits increases with level (maxHitsPer2Levels)', () => {
    // Level 1: maxHits = 1 + floor(1/2) = 1
    // Level 4: maxHits = 1 + floor(4/2) = 3
    const enemies = [
      createTestEnemy(50, 0),
      createTestEnemy(60, 0),
      createTestEnemy(70, 0),
      createTestEnemy(80, 0),
    ];
    const g4 = stateWithPointDefense({
      levels: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 4, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies,
    });
    updateWeapons(0.016, g4);
    // maxHits = 3, so 3 enemies should be damaged
    const damaged = g4.enemies.filter(e => e.hp < 30);
    expect(damaged.length).toBe(3);
  });

  it('point defense damages shield first, then HP', () => {
    const enemy = createTestEnemy(100, 100, 'shielded');
    enemy.shield = 20;
    enemy.hp = 40;
    const g = stateWithPointDefense({ enemies: [enemy] });
    // Damage at level 1 = 50 + 20 = 70
    updateWeapons(0.016, g);
    // Shield absorbs 20, remaining 50 to HP
    expect(enemy.shield).toBe(0);
    expect(enemy.hp).toBe(-10);
  });

  it('creates laser and damage effects when hitting enemy', () => {
    const enemy = createTestEnemy(100, 100);
    const g = stateWithPointDefense({ enemies: [enemy] });
    updateWeapons(0.016, g);
    const laserEffects = g.effects.filter(e => e.type === 'laser');
    const dmgEffects = g.effects.filter(e => e.type === 'dmg');
    expect(laserEffects.length).toBeGreaterThanOrEqual(1);
    expect(dmgEffects.length).toBeGreaterThanOrEqual(1);
  });

  it('creates CRIT damage effect when intercepting enemy missile', () => {
    const enemyMissile = createTestProjectile(100, 100, 0);
    enemyMissile.type = 'enemy_missile';
    enemyMissile.isEnemy = true;
    const g = stateWithPointDefense({ projectiles: [enemyMissile] });
    updateWeapons(0.016, g);
    // spawnDamageNumber creates a dmg effect with crit styling (gold color, bigger font)
    const critEffect = g.effects.find(e => e.type === 'dmg' && e.color === '#fbbf24');
    expect(critEffect).toBeDefined();
  });

  it('skips inactive enemies', () => {
    const enemy1 = createTestEnemy(50, 0);
    enemy1.active = false;
    const enemy2 = createTestEnemy(100, 0);
    const g = stateWithPointDefense({ enemies: [enemy1, enemy2] });
    const initialHp2 = enemy2.hp;
    updateWeapons(0.016, g);
    expect(enemy2.hp).toBeLessThan(initialHp2);
  });
});

/* ══════════════════════════════════════════════
 * 5. Cooldowns prevent rapid firing
 * ══════════════════════════════════════════════ */
describe('cooldowns prevent rapid firing', () => {
  it('autocannon does not fire when cooldown > 0', () => {
    const g = stateWithAutocannon();
    g.cooldowns.autocannon = 0.5;
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });

  it('plasma does not fire when cooldown > 0', () => {
    const g = stateWithPlasma();
    g.cooldowns.plasma = 1.0;
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });

  it('missiles do not fire when cooldown > 0', () => {
    const g = stateWithMissiles();
    g.cooldowns.missiles = 2.0;
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });

  it('point defense does not fire when cooldown > 0', () => {
    const enemy = createTestEnemy(100, 100);
    const g = stateWithPointDefense({ enemies: [enemy] });
    g.cooldowns.pointDefense = 1.0;
    const initialHp = enemy.hp;
    updateWeapons(0.016, g);
    expect(enemy.hp).toBe(initialHp);
  });

  it('autocannon fires immediately when cooldown is exactly 0', () => {
    const g = stateWithAutocannon();
    g.cooldowns.autocannon = 0;
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('autocannon fires when cooldown is negative', () => {
    const g = stateWithAutocannon();
    g.cooldowns.autocannon = -1;
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('multiple weapons can fire in the same frame', () => {
    const g = createTestState({
      levels: { autocannon: 1, plasma: 1, missiles: 1, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(3); // 1 autocannon + 1 plasma + 1 missile
    expect(g.cooldowns.autocannon).toBeGreaterThan(0);
    expect(g.cooldowns.plasma).toBeGreaterThan(0);
    expect(g.cooldowns.missiles).toBeGreaterThan(0);
  });
});

/* ══════════════════════════════════════════════
 * 6. Auto-aim behavior
 * ══════════════════════════════════════════════ */
describe('auto-aim behavior', () => {
  it('autocannon fires when autoAim = 0 and no enemies (hasTarget = true)', () => {
    const g = stateWithAutocannon({
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [],
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('autocannon does NOT fire when autoAim > 0 and no enemies', () => {
    const g = stateWithAutocannon({
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [],
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });

  it('autocannon fires when autoAim > 0 and enemies exist', () => {
    const g = stateWithAutocannon({
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [createTestEnemy(200, 200)],
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('plasma does NOT fire when autoAim > 0 and no enemies', () => {
    const g = stateWithPlasma({
      levels: { autocannon: 0, plasma: 1, missiles: 0, pointDefense: 0, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [],
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });

  it('plasma fires when autoAim > 0 and enemies exist', () => {
    const g = stateWithPlasma({
      levels: { autocannon: 0, plasma: 1, missiles: 0, pointDefense: 0, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [createTestEnemy(300, 300)],
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('auto-aim uses nearest enemy (skips inactive)', () => {
    const inactiveEnemy = createTestEnemy(50, 50);
    inactiveEnemy.active = false;
    const activeEnemy = createTestEnemy(500, 500);
    const g = stateWithAutocannon({
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [inactiveEnemy, activeEnemy],
    });
    updateWeapons(0.016, g);
    // Should fire because there is at least one active enemy
    expect(g.projectiles.length).toBe(1);
  });

  it('autocannon and plasma both blocked by autoAim when no enemies', () => {
    const g = createTestState({
      levels: { autocannon: 1, plasma: 1, missiles: 0, pointDefense: 0, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      enemies: [],
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });

  it('missiles fire regardless of autoAim setting (no hasTarget gate)', () => {
    const g = stateWithMissiles({
      levels: { autocannon: 0, plasma: 0, missiles: 1, pointDefense: 0, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [],
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('point defense fires regardless of autoAim setting (no hasTarget gate)', () => {
    const enemy = createTestEnemy(100, 100);
    const g = stateWithPointDefense({
      levels: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 1, autoAim: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      enemies: [enemy],
    });
    const initialHp = enemy.hp;
    updateWeapons(0.016, g);
    expect(enemy.hp).toBeLessThan(initialHp);
  });
});

/* ══════════════════════════════════════════════
 * 7. Weapon levels increase projectile count (multishot)
 * ══════════════════════════════════════════════ */
describe('weapon levels — multishot', () => {
  describe('autocannon', () => {
    it('level 1 fires 1 shot', () => {
      const g = stateWithAutocannon({
        levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      expect(g.projectiles.length).toBe(1);
    });

    it('level 3 fires 2 shots (1 + floor(3/3))', () => {
      const g = stateWithAutocannon({
        levels: { autocannon: 3, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      expect(g.projectiles.length).toBe(2);
    });

    it('level 6 fires 3 shots (1 + floor(6/3))', () => {
      const g = stateWithAutocannon({
        levels: { autocannon: 6, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      expect(g.projectiles.length).toBe(3);
    });

    it('level 9 fires 4 shots (1 + floor(9/3))', () => {
      const g = stateWithAutocannon({
        levels: { autocannon: 9, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      expect(g.projectiles.length).toBe(4);
    });

    it('multishot projectiles all have correct type and damage', () => {
      const g = stateWithAutocannon({
        levels: { autocannon: 3, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      const expectedDmg = C.weapons.autocannon.baseDamage + 3 * C.weapons.autocannon.damagePerLevel;
      for (const p of g.projectiles) {
        expect(p.type).toBe('autocannon');
        expect(p.damage).toBe(expectedDmg);
      }
    });
  });

  describe('plasma', () => {
    it('level 1 fires 1 shot', () => {
      const g = stateWithPlasma({
        levels: { autocannon: 0, plasma: 1, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      expect(g.projectiles.length).toBe(1);
    });

    it('level 3 fires 2 shots (1 + floor(3/3))', () => {
      const g = stateWithPlasma({
        levels: { autocannon: 0, plasma: 3, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      expect(g.projectiles.length).toBe(2);
    });

    it('level 6 fires 3 shots (1 + floor(6/3))', () => {
      const g = stateWithPlasma({
        levels: { autocannon: 0, plasma: 6, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      expect(g.projectiles.length).toBe(3);
    });

    it('multishot plasma projectiles all have correct pierce', () => {
      const g = stateWithPlasma({
        levels: { autocannon: 0, plasma: 4, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      });
      updateWeapons(0.016, g);
      const expectedPierce = 1 + Math.floor(4 / 2);
      for (const p of g.projectiles) {
        expect(p.pierce).toBe(expectedPierce);
      }
    });
  });
});

/* ══════════════════════════════════════════════
 * 8. Shield regeneration
 * ══════════════════════════════════════════════ */
describe('shield regeneration', () => {
  it('regenerates shield when shieldRegen cooldown <= 0 and shield < maxShield', () => {
    const g = stateWithAutocannon();
    g.player.shield = 10;
    g.player.maxShield = 20;
    g.cooldowns.shieldRegen = 0;
    updateWeapons(0.016, g);
    expect(g.player.shield).toBe(10 + C.shield.regenAmount);
  });

  it('does not regenerate when shield is at max', () => {
    const g = stateWithAutocannon();
    g.player.shield = 20;
    g.player.maxShield = 20;
    g.cooldowns.shieldRegen = 0;
    updateWeapons(0.016, g);
    expect(g.player.shield).toBe(20);
  });

  it('does not regenerate when shieldRegen cooldown > 0', () => {
    const g = stateWithAutocannon();
    g.player.shield = 10;
    g.player.maxShield = 20;
    g.cooldowns.shieldRegen = 1.0;
    updateWeapons(0.016, g);
    expect(g.player.shield).toBe(10);
  });

  it('shield does not exceed maxShield after regen', () => {
    const g = stateWithAutocannon();
    g.player.shield = 19;
    g.player.maxShield = 20;
    g.cooldowns.shieldRegen = 0;
    // regenAmount = 2, so 19 + 2 = 21, but capped at 20
    updateWeapons(0.016, g);
    expect(g.player.shield).toBe(20);
  });

  it('shieldRegen cooldown is set after regenerating', () => {
    const g = stateWithAutocannon();
    g.player.shield = 10;
    g.player.maxShield = 20;
    g.cooldowns.shieldRegen = 0;
    updateWeapons(0.016, g);
    expect(g.cooldowns.shieldRegen).toBe(C.shield.regenCooldown);
  });

  it('shieldRegen cooldown decreases by dt each frame', () => {
    const g = stateWithAutocannon();
    g.cooldowns.shieldRegen = 0.5;
    updateWeapons(0.016, g);
    expect(g.cooldowns.shieldRegen).toBeCloseTo(0.5 - 0.016);
  });
});

/* ══════════════════════════════════════════════
 * 9. Aim angle affects projectile direction
 * ══════════════════════════════════════════════ */
describe('aim angle affects projectile direction', () => {
  it('autocannon projectile direction matches aimAngle = 0 (right)', () => {
    const g = stateWithAutocannon();
    g.player.aimAngle = 0;
    updateWeapons(0.016, g);
    expect(g.projectiles[0].vx).toBeGreaterThan(0);
    expect(g.projectiles[0].vy).toBeCloseTo(0, 0);
  });

  it('autocannon projectile direction matches aimAngle = PI/2 (up)', () => {
    const g = stateWithAutocannon();
    g.player.aimAngle = Math.PI / 2;
    updateWeapons(0.016, g);
    expect(g.projectiles[0].vx).toBeCloseTo(0, 0);
    expect(g.projectiles[0].vy).toBeGreaterThan(0);
  });

  it('autocannon projectile direction matches aimAngle = PI (left)', () => {
    const g = stateWithAutocannon();
    g.player.aimAngle = Math.PI;
    updateWeapons(0.016, g);
    expect(g.projectiles[0].vx).toBeLessThan(0);
    expect(g.projectiles[0].vy).toBeCloseTo(0, 0);
  });

  it('plasma projectile direction matches aimAngle = -PI/4', () => {
    const g = stateWithPlasma();
    g.player.aimAngle = -Math.PI / 4;
    updateWeapons(0.016, g);
    const angle = Math.atan2(g.projectiles[0].vy, g.projectiles[0].vx);
    expect(angle).toBeCloseTo(-Math.PI / 4, 5);
  });
});

/* ══════════════════════════════════════════════
 * 10. Edge cases
 * ══════════════════════════════════════════════ */
describe('edge cases', () => {
  it('no weapons fire when all levels are 0', () => {
    const g = createTestState({
      levels: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
    });
    updateWeapons(0.016, g);
    expect(g.projectiles.length).toBe(0);
  });

  it('dt = 0 still allows weapons to fire (cooldown check uses <= 0)', () => {
    const g = stateWithAutocannon();
    updateWeapons(0, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('large dt still allows one fire per call', () => {
    const g = stateWithAutocannon();
    updateWeapons(10, g);
    expect(g.projectiles.length).toBe(1);
  });

  it('projectile hitList starts empty', () => {
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].hitList).toEqual([]);
  });

  it('projectile life starts at 0', () => {
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].life).toBe(0);
  });

  it('projectile is not marked as enemy', () => {
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].isEnemy).toBe(false);
  });

  it('plasma projectile is not marked as enemy', () => {
    const g = stateWithPlasma();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].isEnemy).toBe(false);
  });

  it('missile projectile is not marked as enemy', () => {
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    expect(g.projectiles[0].isEnemy).toBe(false);
  });

  it('autocannon projectile position is offset from player by ~50 units in aim direction', () => {
    const g = stateWithAutocannon();
    g.player.aimAngle = 0;
    g.player.x = 0;
    g.player.y = 0;
    updateWeapons(0.016, g);
    // bx = player.x + cos(0) * 50 + perpX * 0 = 50
    expect(g.projectiles[0].x).toBeCloseTo(50, 0);
    expect(g.projectiles[0].y).toBeCloseTo(0, 0);
  });

  it('plasma projectile position is offset from player by ~50 units in aim direction', () => {
    const g = stateWithPlasma();
    g.player.aimAngle = 0;
    g.player.x = 0;
    g.player.y = 0;
    updateWeapons(0.016, g);
    expect(g.projectiles[0].x).toBeCloseTo(50, 0);
    expect(g.projectiles[0].y).toBeCloseTo(0, 0);
  });

  it('missile projectile origin is at player position (not offset)', () => {
    const g = stateWithMissiles();
    g.player.x = 100;
    g.player.y = 200;
    updateWeapons(0.016, g);
    expect(g.projectiles[0].x).toBe(100);
    expect(g.projectiles[0].y).toBe(200);
  });
});

/* ══════════════════════════════════════════════
 * 7. Weapon fire sounds
 * ══════════════════════════════════════════════ */
describe('weapon fire sounds', () => {
  let SoundManager;
  let updateWeapons;

  beforeEach(async () => {
    ({ SoundManager } = await import('../../engine/audio'));
    ({ updateWeapons } = await import('../../engine/systems/weapons'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays "shoot" when autocannon fires', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const g = stateWithAutocannon();
    updateWeapons(0.016, g);
    expect(spy).toHaveBeenCalledWith('shoot');
  });

  it('plays "shoot_plasma" when plasma fires', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const g = stateWithPlasma();
    updateWeapons(0.016, g);
    expect(spy).toHaveBeenCalledWith('shoot_plasma');
  });

  it('plays "shoot_missile" when missiles fire', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const g = stateWithMissiles();
    updateWeapons(0.016, g);
    expect(spy).toHaveBeenCalledWith('shoot_missile');
  });

  it('does not play any sound when no weapon fires (cooldown active)', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const g = stateWithAutocannon({ cooldowns: { autocannon: 99, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 } });
    updateWeapons(0.016, g);
    expect(spy).not.toHaveBeenCalled();
  });
});
