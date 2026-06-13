/**
 * Unit tests for adaptiveDifficulty.ts — pressure calculation, spawn rate reduction,
 * aggression increase, and rampage mode activation.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePressure,
  updateAdaptiveDifficulty,
  getAdaptiveSpawnCooldown,
  getAdaptiveAggression,
  recordMissionCompletion,
  resetRampageStreak,
} from '../engine/adaptiveDifficulty';
import { createTestState, createTestEnemy, createTestProjectile } from './helpers';
import { tryFireEnemyWeapon } from '../engine/systems/enemyFire';
import { killEnemy } from '../engine/combat';
import { GAME_CONFIG } from '../constants/gameConfig';

/* ──────────────────────────────────────────────
 * calculatePressure(g)
 * ────────────────────────────────────────────── */
describe('calculatePressure', () => {
  it('returns 0 when no enemies, full HP, no projectiles', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });
    const pressure = calculatePressure(g);
    expect(pressure).toBe(0);
  });

  it('returns 1 when max enemies, 0 HP, max projectiles, nearest threat at player', () => {
    // 0 HP player → hpDeficit = 1 (0.30 contribution)
    // Enemy at player position → nearestThreatRatio = 1 (0.15 contribution)
    // Enough enemies to saturate enemyRatio → 1 (0.30 contribution)
    // Enough projectiles to saturate projectileRatio → 1 (0.25 contribution)
    const g = createTestState({
      level: 1,
      wave: 1,
      player: { hp: 0, maxHp: 300, x: 0, y: 0 },
    });
    // maxExpectedEnemies = max(5, 1*3 + 1*2) = 5
    // Push 5 enemies at player position
    for (let i = 0; i < 5; i++) {
      g.enemies.push(createTestEnemy(0, 0));
    }
    // maxExpectedProjectiles = max(10, 1*4 + 1*3) = 10
    // Push 10 enemy projectiles
    for (let i = 0; i < 10; i++) {
      g.projectiles.push(createTestProjectile(100, 100, 0, 'enemy_bullet'));
    }
    const pressure = calculatePressure(g);
    expect(pressure).toBeCloseTo(1, 4);
  });

  it('scales with enemy count', () => {
    const g = createTestState({
      level: 2,
      wave: 1,
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });
    // maxExpectedEnemies = max(5, 2*3 + 1*2) = 8
    g.enemies.push(createTestEnemy(500, 500));
    const p1 = calculatePressure(g);
    g.enemies.push(createTestEnemy(600, 600));
    g.enemies.push(createTestEnemy(700, 700));
    g.enemies.push(createTestEnemy(800, 800));
    g.enemies.push(createTestEnemy(900, 900));
    g.enemies.push(createTestEnemy(1000, 1000));
    g.enemies.push(createTestEnemy(1100, 1100));
    g.enemies.push(createTestEnemy(1200, 1200));
    const p2 = calculatePressure(g);
    expect(p2).toBeGreaterThan(p1);
  });

  it('scales with HP deficit', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
    });
    g.player.hp = 300;
    const fullHpPressure = calculatePressure(g);

    g.player.hp = 150;
    const halfHpPressure = calculatePressure(g);

    g.player.hp = 0;
    const zeroHpPressure = calculatePressure(g);

    expect(halfHpPressure).toBeGreaterThan(fullHpPressure);
    expect(zeroHpPressure).toBeGreaterThan(halfHpPressure);
  });

  it('scales with incoming projectile count', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      level: 2,
      wave: 1,
    });
    // maxExpectedProjectiles = max(10, 2*4 + 1*3) = 11
    const p0 = calculatePressure(g);
    expect(p0).toBe(0);

    g.projectiles.push(createTestProjectile(100, 100, 0, 'enemy_bullet'));
    g.projectiles.push(createTestProjectile(200, 200, 0, 'enemy_bullet'));
    g.projectiles.push(createTestProjectile(300, 300, 0, 'enemy_bullet'));
    const p3 = calculatePressure(g);
    expect(p3).toBeGreaterThan(p0);
  });

  it('ignores player projectiles (isEnemy=false) in incoming count', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
    });
    g.projectiles.push(createTestProjectile(100, 100, 0, 'autocannon'));
    g.projectiles.push(createTestProjectile(200, 200, 0, 'plasma'));
    const pressure = calculatePressure(g);
    expect(pressure).toBe(0);
  });

  it('scales with nearest threat proximity', () => {
    const g = createTestState({
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });
    // Enemy far away
    g.enemies.push(createTestEnemy(3900, 3900));
    const farPressure = calculatePressure(g);

    g.enemies = [];
    // Enemy close
    g.enemies.push(createTestEnemy(50, 50));
    const nearPressure = calculatePressure(g);

    expect(nearPressure).toBeGreaterThan(farPressure);
  });

  it('ignores inactive enemies', () => {
    const g = createTestState({
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });
    g.enemies.push(createTestEnemy(50, 50));
    g.enemies[0].active = false;
    const pressure = calculatePressure(g);
    expect(pressure).toBe(0);
  });

  it('clamps pressure to [0, 1]', () => {
    const g = createTestState({
      level: 100,
      wave: 50,
      player: { hp: -1000, maxHp: 300, x: 0, y: 0 },
    });
    // Over-saturate enemies
    for (let i = 0; i < 500; i++) {
      g.enemies.push(createTestEnemy(0, 0));
    }
    // Over-saturate projectiles
    for (let i = 0; i < 500; i++) {
      g.projectiles.push(createTestProjectile(10, 10, 0, 'enemy_bullet'));
    }
    const pressure = calculatePressure(g);
    expect(pressure).toBeGreaterThanOrEqual(0);
    expect(pressure).toBeLessThanOrEqual(1);
  });
});

/* ──────────────────────────────────────────────
 * updateAdaptiveDifficulty(dt, g)
 * ────────────────────────────────────────────── */
describe('updateAdaptiveDifficulty', () => {
  it('does nothing if adaptiveDifficulty is undefined', () => {
    const g = createTestState();
    delete g.adaptiveDifficulty;
    expect(() => updateAdaptiveDifficulty(0.016, g)).not.toThrow();
  });

  it('populates pressureScore and pressureHistory', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });
    updateAdaptiveDifficulty(0.016, g);
    expect(g.adaptiveDifficulty.pressureScore).toBe(0);
    expect(g.adaptiveDifficulty.pressureHistory.length).toBe(1);
  });

  it('trims pressureHistory to 60 entries', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
    });
    for (let i = 0; i < 80; i++) {
      updateAdaptiveDifficulty(0.016, g);
    }
    expect(g.adaptiveDifficulty.pressureHistory.length).toBe(60);
  });

  it('reduces spawn rate after 3s of high pressure (>0.7)', () => {
    const g = createTestState({
      level: 1,
      wave: 1,
      player: { hp: 0, maxHp: 300, x: 0, y: 0 },
    });
    // Saturate enemies and projectiles to force high pressure
    for (let i = 0; i < 5; i++) g.enemies.push(createTestEnemy(0, 0));
    for (let i = 0; i < 10; i++) g.projectiles.push(createTestProjectile(10, 10, 0, 'enemy_bullet'));

    // Simulate 3.1 seconds at ~60fps
    for (let i = 0; i < 195; i++) {
      updateAdaptiveDifficulty(0.016, g);
    }

    expect(g.adaptiveDifficulty.spawnRateMult).toBeLessThan(1);
    expect(g.adaptiveDifficulty.spawnRateMult).toBeGreaterThanOrEqual(0.5);
  });

  it('does NOT reduce spawn rate before 3s threshold', () => {
    const g = createTestState({
      level: 1,
      wave: 1,
      player: { hp: 0, maxHp: 300, x: 0, y: 0 },
    });
    for (let i = 0; i < 5; i++) g.enemies.push(createTestEnemy(0, 0));
    for (let i = 0; i < 10; i++) g.projectiles.push(createTestProjectile(10, 10, 0, 'enemy_bullet'));

    // Simulate only 2 seconds
    for (let i = 0; i < 120; i++) {
      updateAdaptiveDifficulty(0.016, g);
    }

    expect(g.adaptiveDifficulty.spawnRateMult).toBe(1);
  });

  it('increases aggression after 5s of low pressure (<0.3)', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    // Simulate 5.1 seconds of zero pressure
    for (let i = 0; i < 320; i++) {
      updateAdaptiveDifficulty(0.016, g);
    }

    expect(g.adaptiveDifficulty.enemyAggressionMult).toBeGreaterThan(1);
    expect(g.adaptiveDifficulty.enemyAggressionMult).toBeLessThanOrEqual(1.2);
  });

  it('does NOT increase aggression before 5s threshold', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    // Simulate only 4 seconds
    for (let i = 0; i < 250; i++) {
      updateAdaptiveDifficulty(0.016, g);
    }

    expect(g.adaptiveDifficulty.enemyAggressionMult).toBe(1);
  });

  it('resets spawnRateMult when pressure drops from high', () => {
    const g = createTestState({
      level: 1,
      wave: 1,
      player: { hp: 0, maxHp: 300, x: 0, y: 0 },
    });
    for (let i = 0; i < 5; i++) g.enemies.push(createTestEnemy(0, 0));
    for (let i = 0; i < 10; i++) g.projectiles.push(createTestProjectile(10, 10, 0, 'enemy_bullet'));

    // Build up high pressure for 3.1s
    for (let i = 0; i < 195; i++) updateAdaptiveDifficulty(0.016, g);
    expect(g.adaptiveDifficulty.spawnRateMult).toBeLessThan(1);

    // Now remove all threats
    g.enemies = [];
    g.projectiles = [];
    g.player.hp = 300;

    // Run a few frames to reset
    for (let i = 0; i < 10; i++) updateAdaptiveDifficulty(0.016, g);

    expect(g.adaptiveDifficulty.spawnRateMult).toBe(1);
  });

  it('resets enemyAggressionMult when pressure rises from low', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    // Build low pressure for 5.1s
    for (let i = 0; i < 320; i++) updateAdaptiveDifficulty(0.016, g);
    expect(g.adaptiveDifficulty.enemyAggressionMult).toBeGreaterThan(1);

    // Add threats to raise pressure
    for (let i = 0; i < 5; i++) g.enemies.push(createTestEnemy(0, 0));
    for (let i = 0; i < 10; i++) g.projectiles.push(createTestProjectile(10, 10, 0, 'enemy_bullet'));
    g.player.hp = 0;

    // Run a few frames
    for (let i = 0; i < 10; i++) updateAdaptiveDifficulty(0.016, g);

    expect(g.adaptiveDifficulty.enemyAggressionMult).toBe(1);
  });
});

/* ──────────────────────────────────────────────
 * getAdaptiveSpawnCooldown(g, baseCooldown)
 * ────────────────────────────────────────────── */
describe('getAdaptiveSpawnCooldown', () => {
  it('returns base cooldown when spawnRateMult is 1', () => {
    const g = createTestState();
    const result = getAdaptiveSpawnCooldown(g, 2);
    expect(result).toBe(2);
  });

  it('increases cooldown when spawnRateMult < 1 (high pressure)', () => {
    const g = createTestState();
    g.adaptiveDifficulty.spawnRateMult = 0.8;
    const result = getAdaptiveSpawnCooldown(g, 2);
    expect(result).toBeCloseTo(2.5, 4); // 2 / 0.8 = 2.5
  });

  it('returns base cooldown when spawnRateMult >= 1', () => {
    const g = createTestState();
    g.adaptiveDifficulty.spawnRateMult = 1.2;
    const result = getAdaptiveSpawnCooldown(g, 2);
    expect(result).toBe(2);
  });

  it('handles missing adaptiveDifficulty gracefully', () => {
    const g = createTestState();
    delete g.adaptiveDifficulty;
    const result = getAdaptiveSpawnCooldown(g, 2);
    expect(result).toBe(2);
  });
});

/* ──────────────────────────────────────────────
 * getAdaptiveAggression(g)
 * ────────────────────────────────────────────── */
describe('getAdaptiveAggression', () => {
  it('returns 1 when no aggression boost', () => {
    const g = createTestState();
    expect(getAdaptiveAggression(g)).toBe(1);
  });

  it('returns the current enemyAggressionMult', () => {
    const g = createTestState();
    g.adaptiveDifficulty.enemyAggressionMult = 1.15;
    expect(getAdaptiveAggression(g)).toBe(1.15);
  });

  it('handles missing adaptiveDifficulty gracefully', () => {
    const g = createTestState();
    delete g.adaptiveDifficulty;
    expect(getAdaptiveAggression(g)).toBe(1);
  });
});

/* ──────────────────────────────────────────────
 * recordMissionCompletion(g)
 * ────────────────────────────────────────────── */
describe('recordMissionCompletion', () => {
  it('increments missionsHighHp when HP > 80%', () => {
    const g = createTestState({
      player: { hp: 250, maxHp: 300 }, // ~83%
    });
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(1);
  });

  it('does not increment missionsHighHp when HP <= 80%', () => {
    const g = createTestState({
      player: { hp: 240, maxHp: 300 }, // exactly 80%
    });
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(0);
  });

  it('activates rampage mode after 3 consecutive high-HP completions', () => {
    const g = createTestState({
      player: { hp: 270, maxHp: 300 }, // 90%
    });
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.rampageMode).toBe(false);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(1);

    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.rampageMode).toBe(false);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(2);

    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.rampageMode).toBe(true);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(3);
  });

  it('resets streak on non-high-HP completion', () => {
    const g = createTestState({
      player: { hp: 270, maxHp: 300 },
    });
    recordMissionCompletion(g);
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(2);

    // Now complete with low HP
    g.player.hp = 150;
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(0);
    expect(g.adaptiveDifficulty.rampageMode).toBe(false);
  });

  it('deactivates rampage mode when streak is broken', () => {
    const g = createTestState({
      player: { hp: 270, maxHp: 300 },
    });
    // Build up to rampage
    recordMissionCompletion(g);
    recordMissionCompletion(g);
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.rampageMode).toBe(true);

    // Break streak
    g.player.hp = 100;
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.rampageMode).toBe(false);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(0);
  });

  it('handles missing adaptiveDifficulty gracefully', () => {
    const g = createTestState();
    delete g.adaptiveDifficulty;
    expect(() => recordMissionCompletion(g)).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * resetRampageStreak(g)
 * ────────────────────────────────────────────── */
describe('resetRampageStreak', () => {
  it('resets missionsHighHp and rampageMode', () => {
    const g = createTestState();
    g.adaptiveDifficulty.missionsHighHp = 5;
    g.adaptiveDifficulty.rampageMode = true;

    resetRampageStreak(g);
    expect(g.adaptiveDifficulty.missionsHighHp).toBe(0);
    expect(g.adaptiveDifficulty.rampageMode).toBe(false);
  });

  it('handles missing adaptiveDifficulty gracefully', () => {
    const g = createTestState();
    delete g.adaptiveDifficulty;
    expect(() => resetRampageStreak(g)).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * Integration: full cycle
 * ────────────────────────────────────────────── */
describe('integration: full adaptive difficulty cycle', () => {
  it('transitions from low pressure → aggression → high pressure → spawn reduction', () => {
    const g = createTestState({
      level: 1,
      wave: 1,
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    // Phase 1: Low pressure for 5s → aggression
    for (let i = 0; i < 320; i++) {
      updateAdaptiveDifficulty(0.016, g);
    }
    expect(g.adaptiveDifficulty.enemyAggressionMult).toBeGreaterThan(1);
    expect(g.adaptiveDifficulty.spawnRateMult).toBe(1);

    // Phase 2: Add threats → high pressure for 3s → spawn reduction
    // Need enough frames to flush the 60-entry history buffer of zeros,
    // then accumulate 3s of high pressure. 500 frames = 8s total, more than enough.
    for (let i = 0; i < 5; i++) g.enemies.push(createTestEnemy(0, 0));
    for (let i = 0; i < 10; i++) g.projectiles.push(createTestProjectile(10, 10, 0, 'enemy_bullet'));
    g.player.hp = 0;

    for (let i = 0; i < 500; i++) {
      updateAdaptiveDifficulty(0.016, g);
    }
    expect(g.adaptiveDifficulty.spawnRateMult).toBeLessThan(1);
    // Aggression should reset when pressure is high
    expect(g.adaptiveDifficulty.enemyAggressionMult).toBe(1);
  });
});

/* ──────────────────────────────────────────────
 * Integration: adaptive difficulty wiring
 * ────────────────────────────────────────────── */
describe('integration: physics loop wiring', () => {
  it('getAdaptiveSpawnCooldown increases cooldown under high pressure', () => {
    const g = createTestState();
    // Simulate high pressure that has reduced spawnRateMult
    g.adaptiveDifficulty.spawnRateMult = 0.75;

    const baseCooldown = 2;
    const adjusted = getAdaptiveSpawnCooldown(g, baseCooldown);
    // 2 / 0.75 = 2.666...
    expect(adjusted).toBeCloseTo(2.6667, 3);
    expect(adjusted).toBeGreaterThan(baseCooldown);
  });

  it('getAdaptiveSpawnCooldown returns base when no high pressure', () => {
    const g = createTestState();
    g.adaptiveDifficulty.spawnRateMult = 1;

    const adjusted = getAdaptiveSpawnCooldown(g, 2);
    expect(adjusted).toBe(2);
  });

  it('getAdaptiveAggression returns elevated value after low pressure', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    // 5.1s of zero pressure
    for (let i = 0; i < 320; i++) updateAdaptiveDifficulty(0.016, g);

    const aggression = getAdaptiveAggression(g);
    expect(aggression).toBeGreaterThan(1);
    expect(aggression).toBeLessThanOrEqual(1.2);
  });

  it('updateAdaptiveDifficulty is safe to call every frame with varying dt', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    // Simulate varying delta times (30fps to 120fps)
    for (let i = 0; i < 100; i++) {
      const dt = 0.008 + Math.random() * 0.025;
      updateAdaptiveDifficulty(dt, g);
    }
    expect(g.adaptiveDifficulty.pressureScore).toBe(0);
    expect(g.adaptiveDifficulty.pressureHistory.length).toBeGreaterThanOrEqual(1);
  });

  it('pressure history trims correctly at different frame rates', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
    });

    // Run at 30fps (dt=0.033) — should still cap at 60 entries
    for (let i = 0; i < 100; i++) {
      updateAdaptiveDifficulty(0.033, g);
    }
    expect(g.adaptiveDifficulty.pressureHistory.length).toBe(60);
  });
});

describe('integration: enemy fire with adaptive aggression', () => {
  it('adaptiveAggression > 1 reduces fire cooldown on reset', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    // Create a shooter enemy with fire cooldown ready
    const enemy = createTestEnemy(200, 200, 'shooter');
    enemy.fireCooldown = 0; // Ready to fire
    g.enemies.push(enemy);

    // Call with adaptiveAggression = 1.2 (20% more aggressive)
    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const dist = Math.hypot(g.player.x - enemy.x, g.player.y - enemy.y);

    // The function should accept the 7th parameter without error
    expect(() => {
      tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g, 1.2);
    }).not.toThrow();

    // After firing, the cooldown should be reduced by aggression
    // shooter base cooldown is ~1.5s, with 1.2x aggression it should be ~1.25s
    expect(enemy.fireCooldown).toBeLessThan(GAME_CONFIG.enemyWeapons.shooter.cooldownMin + GAME_CONFIG.enemyWeapons.shooter.cooldownVariance);
  });

  it('adaptiveAggression = 1 has no effect on fire cooldown', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    const enemy = createTestEnemy(200, 200, 'fighter');
    enemy.fireCooldown = 0;
    g.enemies.push(enemy);

    const angle = Math.atan2(g.player.y - enemy.y, g.player.x - enemy.x);
    const dist = Math.hypot(g.player.x - enemy.x, g.player.y - enemy.y);

    // With aggression = 1, cooldown should be the base value
    tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g, 1);
    expect(enemy.fireCooldown).toBeGreaterThan(0);
  });

  it('default adaptiveAggression (undefined) does not cause errors', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      player: { hp: 300, maxHp: 300, x: 0, y: 0 },
    });

    const enemy = createTestEnemy(200, 200, 'fighter');
    enemy.fireCooldown = 0;
    g.enemies.push(enemy);

    const angle = 0;
    const dist = 282;

    // Call without 7th parameter — should default to 1
    expect(() => {
      tryFireEnemyWeapon(enemy, angle, dist, 0.016, 1, g);
    }).not.toThrow();
  });
});

describe('integration: rampage mode scrap multiplier', () => {
  it('killEnemy applies 3x scrap in rampage mode', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      pickups: [],
      adaptiveDifficulty: {
        ...createTestState().adaptiveDifficulty,
        rampageMode: true,
      },
    });

    const enemy = createTestEnemy(100, 100, 'fighter');
    g.enemies.push(enemy);

    killEnemy(g, enemy, null);

    // Fighter base scrap = 1, with 3x rampage = 3
    const pickup = g.pickups.find(p => p.active);
    expect(pickup).toBeDefined();
    expect(pickup.value).toBe(3); // 1 * 3
  });

  it('killEnemy applies 3x scrap for heavy in rampage mode', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      pickups: [],
      adaptiveDifficulty: {
        ...createTestState().adaptiveDifficulty,
        rampageMode: true,
      },
    });

    const enemy = createTestEnemy(100, 100, 'heavy');
    g.enemies.push(enemy);

    killEnemy(g, enemy, null);

    // Heavy base scrap = 5, with 3x rampage = 15
    const pickup = g.pickups.find(p => p.active);
    expect(pickup).toBeDefined();
    expect(pickup.value).toBe(15); // 5 * 3
  });

  it('killEnemy does NOT multiply scrap when rampage mode is off', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      pickups: [],
      adaptiveDifficulty: {
        ...createTestState().adaptiveDifficulty,
        rampageMode: false,
      },
    });

    const enemy = createTestEnemy(100, 100, 'fighter');
    g.enemies.push(enemy);

    killEnemy(g, enemy, null);

    const pickup = g.pickups.find(p => p.active);
    expect(pickup).toBeDefined();
    expect(pickup.value).toBe(1); // base value, no multiplier
  });

  it('killEnemy handles missing adaptiveDifficulty gracefully', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      pickups: [],
    });
    delete g.adaptiveDifficulty;

    const enemy = createTestEnemy(100, 100, 'fighter');
    g.enemies.push(enemy);

    expect(() => killEnemy(g, enemy, null)).not.toThrow();

    const pickup = g.pickups.find(p => p.active);
    expect(pickup.value).toBe(1);
  });
});

describe('integration: rampage mode activation flow', () => {
  it('3 consecutive high-HP completions activate rampage, then killEnemy gives 3x scrap', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      pickups: [],
      player: { hp: 270, maxHp: 300 }, // 90% HP
    });

    // Complete 3 missions with high HP
    recordMissionCompletion(g);
    recordMissionCompletion(g);
    recordMissionCompletion(g);

    expect(g.adaptiveDifficulty.rampageMode).toBe(true);

    // Now kill an enemy — should get 3x scrap
    const enemy = createTestEnemy(100, 100, 'interceptor');
    g.enemies.push(enemy);
    g.pickups = [];

    killEnemy(g, enemy, null);

    const pickup = g.pickups.find(p => p.active);
    expect(pickup).toBeDefined();
    expect(pickup.value).toBe(6); // interceptor base = 2, 2 * 3 = 6
  });

  it('low-HP completion deactivates rampage and removes 3x scrap', () => {
    const g = createTestState({
      enemies: [],
      projectiles: [],
      pickups: [],
      player: { hp: 270, maxHp: 300 },
    });

    // Activate rampage
    recordMissionCompletion(g);
    recordMissionCompletion(g);
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.rampageMode).toBe(true);

    // Break streak with low HP
    g.player.hp = 150;
    recordMissionCompletion(g);
    expect(g.adaptiveDifficulty.rampageMode).toBe(false);

    // Now kill an enemy — should get normal scrap
    const enemy = createTestEnemy(100, 100, 'fighter');
    g.enemies.push(enemy);
    g.pickups = [];

    killEnemy(g, enemy, null);

    const pickup = g.pickups.find(p => p.active);
    expect(pickup.value).toBe(1); // base value, no multiplier
  });
});
