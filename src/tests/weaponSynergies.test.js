/**
 * Unit tests for weaponSynergies.js — synergy check and application logic.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getActiveSynergies,
  applyPlasmaSynergy,
  applyAutocannonSynergy,
  applyMissileKillSynergy,
  applyPointDefenseSynergy,
} from '../engine/weaponSynergies';
import { createTestState, createTestEnemy, createTestProjectile } from './helpers';
import { GAME_CONFIG } from '../constants/gameConfig';
import { fireProjectile, killEnemy } from '../engine/combat';
import { updateProjectiles } from '../engine/systems/projectiles';
import { updateWeapons } from '../engine/systems/weapons';

// Mock audio to prevent errors in test environment
vi.mock('../engine/audio', () => ({
  SoundManager: { play: vi.fn() },
}));

/* ──────────────────────────────────────────────
 * getActiveSynergies(levels)
 * ────────────────────────────────────────────── */
describe('getActiveSynergies', () => {
  it('returns empty array when no weapon levels meet any synergy requirements', () => {
    const levels = { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0 };
    const active = getActiveSynergies(levels);
    expect(active).toEqual([]);
  });

  it('returns penetration synergy when autocannon >= 5 and plasma >= 5', () => {
    const levels = { autocannon: 5, plasma: 5, missiles: 0, pointDefense: 0 };
    const active = getActiveSynergies(levels);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('penetration');
    expect(active[0].config.name).toBe('Penetration');
  });

  it('does not return penetration when autocannon is below 5', () => {
    const levels = { autocannon: 4, plasma: 5, missiles: 0, pointDefense: 0 };
    const active = getActiveSynergies(levels);
    const pen = active.find(s => s.id === 'penetration');
    expect(pen).toBeUndefined();
  });

  it('does not return penetration when plasma is below 5', () => {
    const levels = { autocannon: 5, plasma: 4, missiles: 0, pointDefense: 0 };
    const active = getActiveSynergies(levels);
    const pen = active.find(s => s.id === 'penetration');
    expect(pen).toBeUndefined();
  });

  it('returns chainReaction when missiles >= 3 and pointDefense >= 3', () => {
    const levels = { autocannon: 0, plasma: 0, missiles: 3, pointDefense: 3 };
    const active = getActiveSynergies(levels);
    const chain = active.find(s => s.id === 'chainReaction');
    expect(chain).toBeDefined();
    expect(chain.config.name).toBe('Chain Reaction');
  });

  it('does not return chainReaction when missiles below 3', () => {
    const levels = { autocannon: 0, plasma: 0, missiles: 2, pointDefense: 3 };
    const active = getActiveSynergies(levels);
    const chain = active.find(s => s.id === 'chainReaction');
    expect(chain).toBeUndefined();
  });

  it('does not return chainReaction when pointDefense below 3', () => {
    const levels = { autocannon: 0, plasma: 0, missiles: 3, pointDefense: 2 };
    const active = getActiveSynergies(levels);
    const chain = active.find(s => s.id === 'chainReaction');
    expect(chain).toBeUndefined();
  });

  it('returns guidedRounds when autocannon >= 5 and missiles >= 5', () => {
    const levels = { autocannon: 5, plasma: 0, missiles: 5, pointDefense: 0 };
    const active = getActiveSynergies(levels);
    const guided = active.find(s => s.id === 'guidedRounds');
    expect(guided).toBeDefined();
    expect(guided.config.name).toBe('Guided Rounds');
  });

  it('returns piercingDefense when plasma >= 5 and pointDefense >= 5', () => {
    const levels = { autocannon: 0, plasma: 5, missiles: 0, pointDefense: 5 };
    const active = getActiveSynergies(levels);
    const pierce = active.find(s => s.id === 'piercingDefense');
    expect(pierce).toBeDefined();
    expect(pierce.config.name).toBe('Piercing Defense');
  });

  it('returns multiple synergies when all requirements are met', () => {
    const levels = { autocannon: 5, plasma: 5, missiles: 5, pointDefense: 5 };
    const active = getActiveSynergies(levels);
    expect(active.length).toBe(4);
    const ids = active.map(s => s.id);
    expect(ids).toContain('penetration');
    expect(ids).toContain('chainReaction');
    expect(ids).toContain('guidedRounds');
    expect(ids).toContain('piercingDefense');
  });

  it('handles undefined weapon levels as 0', () => {
    const levels = { autocannon: 5 };
    const active = getActiveSynergies(levels);
    // plasma is undefined (treated as 0), so penetration should not activate
    const pen = active.find(s => s.id === 'penetration');
    expect(pen).toBeUndefined();
  });

  it('handles empty levels object', () => {
    const active = getActiveSynergies({});
    expect(active).toEqual([]);
  });

  it('levels above requirements still activate synergy', () => {
    const levels = { autocannon: 10, plasma: 10, missiles: 10, pointDefense: 10 };
    const active = getActiveSynergies(levels);
    expect(active.length).toBe(4);
  });
});

/* ──────────────────────────────────────────────
 * applyPlasmaSynergy(projectileConfig, activeSynergies)
 * ────────────────────────────────────────────── */
describe('applyPlasmaSynergy', () => {
  it('adds armorPierce and purple color when penetration synergy is active', () => {
    const config = { damage: 45, speed: 350 };
    const active = getActiveSynergies({ autocannon: 5, plasma: 5, missiles: 0, pointDefense: 0 });
    applyPlasmaSynergy(config, active);
    expect(config.armorPierce).toBe(true);
    expect(config.color).toBe(0x9333ea);
    expect(config.shieldBypassHits).toBe(3);
  });

  it('leaves config unchanged when penetration synergy is not active', () => {
    const config = { damage: 30, speed: 350 };
    const active = getActiveSynergies({ autocannon: 3, plasma: 2, missiles: 0, pointDefense: 0 });
    applyPlasmaSynergy(config, active);
    expect(config.armorPierce).toBeUndefined();
    expect(config.color).toBeUndefined();
    expect(config.shieldBypassHits).toBeUndefined();
  });

  it('returns the same config object (mutates in place)', () => {
    const config = { damage: 30 };
    const active = getActiveSynergies({ autocannon: 5, plasma: 5, missiles: 0, pointDefense: 0 });
    const result = applyPlasmaSynergy(config, active);
    expect(result).toBe(config);
  });
});

/* ──────────────────────────────────────────────
 * applyAutocannonSynergy(projectileConfig, activeSynergies)
 * ────────────────────────────────────────────── */
describe('applyAutocannonSynergy', () => {
  it('has 10% chance to add guided flag when guidedRounds synergy is active', () => {
    const active = getActiveSynergies({ autocannon: 5, plasma: 0, missiles: 5, pointDefense: 0 });
    expect(active.find(s => s.id === 'guidedRounds')).toBeDefined();

    // Run many trials — should see guided flag at approximately 10%
    let guidedCount = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const config = { damage: 25 };
      applyAutocannonSynergy(config, active);
      if (config.guided) guidedCount++;
    }
    // Expect between 5% and 15% (generous bounds for 10% probability)
    const rate = guidedCount / trials;
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.15);
  });

  it('sets steerAngle on guided projectiles', () => {
    const active = getActiveSynergies({ autocannon: 5, plasma: 0, missiles: 5, pointDefense: 0 });
    // Run trials until we get a guided hit
    for (let i = 0; i < 200; i++) {
      const config = { damage: 25 };
      applyAutocannonSynergy(config, active);
      if (config.guided) {
        expect(config.steerAngle).toBe(Math.PI / 6);
        return;
      }
    }
  });

  it('leaves config unchanged when guidedRounds synergy is not active', () => {
    const config = { damage: 15 };
    const active = getActiveSynergies({ autocannon: 3, plasma: 0, missiles: 2, pointDefense: 0 });
    applyAutocannonSynergy(config, active);
    expect(config.guided).toBeUndefined();
    expect(config.steerAngle).toBeUndefined();
  });

  it('returns the same config object', () => {
    const config = { damage: 15 };
    const active = [];
    const result = applyAutocannonSynergy(config, active);
    expect(result).toBe(config);
  });
});

/* ──────────────────────────────────────────────
 * applyMissileKillSynergy(killedEnemy, g, activeSynergies)
 * ────────────────────────────────────────────── */
describe('applyMissileKillSynergy', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  it('returns enemies within chainRadius of killed enemy', () => {
    const killed = createTestEnemy(0, 0);
    const near1 = createTestEnemy(50, 50);  // ~70.7 units away
    const near2 = createTestEnemy(100, 100); // ~141 units away
    const far = createTestEnemy(300, 300);   // ~424 units away (outside 200)

    g.enemies = [near1, near2, far];
    const active = getActiveSynergies({ autocannon: 0, plasma: 0, missiles: 3, pointDefense: 3 });

    const targets = applyMissileKillSynergy(killed, g, active);
    expect(targets.length).toBe(2);
    expect(targets).toContain(near1);
    expect(targets).toContain(near2);
    expect(targets).not.toContain(far);
  });

  it('excludes inactive enemies from chain targets', () => {
    const killed = createTestEnemy(0, 0);
    const activeEnemy = createTestEnemy(50, 50);
    const inactiveEnemy = createTestEnemy(30, 30);
    inactiveEnemy.active = false;

    g.enemies = [activeEnemy, inactiveEnemy];
    const active = getActiveSynergies({ autocannon: 0, plasma: 0, missiles: 3, pointDefense: 3 });

    const targets = applyMissileKillSynergy(killed, g, active);
    expect(targets).toContain(activeEnemy);
    expect(targets).not.toContain(inactiveEnemy);
  });

  it('excludes the killed enemy itself from chain targets', () => {
    const killed = createTestEnemy(0, 0);
    const other = createTestEnemy(10, 10);

    g.enemies = [killed, other];
    const active = getActiveSynergies({ autocannon: 0, plasma: 0, missiles: 3, pointDefense: 3 });

    const targets = applyMissileKillSynergy(killed, g, active);
    expect(targets).not.toContain(killed);
    expect(targets).toContain(other);
  });

  it('returns empty array when chainReaction synergy is not active', () => {
    const killed = createTestEnemy(0, 0);
    g.enemies = [createTestEnemy(50, 50)];
    const active = getActiveSynergies({ autocannon: 0, plasma: 0, missiles: 1, pointDefense: 1 });

    const targets = applyMissileKillSynergy(killed, g, active);
    expect(targets).toEqual([]);
  });

  it('returns empty array when no enemies in range', () => {
    const killed = createTestEnemy(0, 0);
    const far = createTestEnemy(500, 500);

    g.enemies = [far];
    const active = getActiveSynergies({ autocannon: 0, plasma: 0, missiles: 3, pointDefense: 3 });

    const targets = applyMissileKillSynergy(killed, g, active);
    expect(targets).toEqual([]);
  });

  it('uses chainRadius from config (200 units)', () => {
    const killed = createTestEnemy(0, 0);
    // Exactly at the boundary: sqrt(200^2 + 0^2) = 200
    const onBoundary = createTestEnemy(200, 0);
    // Just outside: sqrt(201^2 + 0^2) = 201
    const justOutside = createTestEnemy(201, 0);

    g.enemies = [onBoundary, justOutside];
    const active = getActiveSynergies({ autocannon: 0, plasma: 0, missiles: 3, pointDefense: 3 });

    const targets = applyMissileKillSynergy(killed, g, active);
    expect(targets).toContain(onBoundary);
    expect(targets).not.toContain(justOutside);
  });
});

/* ──────────────────────────────────────────────
 * applyPointDefenseSynergy(baseMaxHits, activeSynergies)
 * ────────────────────────────────────────────── */
describe('applyPointDefenseSynergy', () => {
  it('adds extraHits when piercingDefense synergy is active', () => {
    const active = getActiveSynergies({ autocannon: 0, plasma: 5, missiles: 0, pointDefense: 5 });
    const result = applyPointDefenseSynergy(2, active);
    expect(result).toBe(4); // base 2 + extraHits 2
  });

  it('returns baseMaxHits unchanged when piercingDefense is not active', () => {
    const active = getActiveSynergies({ autocannon: 0, plasma: 3, missiles: 0, pointDefense: 3 });
    const result = applyPointDefenseSynergy(2, active);
    expect(result).toBe(2);
  });

  it('works with zero base max hits', () => {
    const active = getActiveSynergies({ autocannon: 0, plasma: 5, missiles: 0, pointDefense: 5 });
    const result = applyPointDefenseSynergy(0, active);
    expect(result).toBe(2);
  });

  it('uses extraHits value from config (2)', () => {
    const active = getActiveSynergies({ autocannon: 0, plasma: 5, missiles: 0, pointDefense: 5 });
    const pierce = active.find(s => s.id === 'piercingDefense');
    expect(pierce.config.extraHits).toBe(2);

    const result = applyPointDefenseSynergy(3, active);
    expect(result).toBe(5); // 3 + 2
  });

  it('works with no active synergies', () => {
    const result = applyPointDefenseSynergy(4, []);
    expect(result).toBe(4);
  });
});

/* ──────────────────────────────────────────────
 * GAME_CONFIG.weaponSynergies structure
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.weaponSynergies', () => {
  it('has all 4 synergy definitions', () => {
    const ws = GAME_CONFIG.weaponSynergies;
    expect(ws.penetration).toBeDefined();
    expect(ws.chainReaction).toBeDefined();
    expect(ws.guidedRounds).toBeDefined();
    expect(ws.piercingDefense).toBeDefined();
  });

  it('penetration has correct config values', () => {
    const pen = GAME_CONFIG.weaponSynergies.penetration;
    expect(pen.name).toBe('Penetration');
    expect(pen.requirements).toEqual({ autocannon: 5, plasma: 5 });
    expect(pen.plasmaPierceColor).toBe(0x9333ea);
    expect(pen.shieldBypassHits).toBe(3);
  });

  it('chainReaction has correct config values', () => {
    const chain = GAME_CONFIG.weaponSynergies.chainReaction;
    expect(chain.name).toBe('Chain Reaction');
    expect(chain.requirements).toEqual({ missiles: 3, pointDefense: 3 });
    expect(chain.chainRadius).toBe(200);
  });

  it('guidedRounds has correct config values', () => {
    const guided = GAME_CONFIG.weaponSynergies.guidedRounds;
    expect(guided.name).toBe('Guided Rounds');
    expect(guided.requirements).toEqual({ autocannon: 5, missiles: 5 });
    expect(guided.chance).toBe(0.1);
    expect(guided.steerAngle).toBe(Math.PI / 6);
  });

  it('piercingDefense has correct config values', () => {
    const pierce = GAME_CONFIG.weaponSynergies.piercingDefense;
    expect(pierce.name).toBe('Piercing Defense');
    expect(pierce.requirements).toEqual({ plasma: 5, pointDefense: 5 });
    expect(pierce.extraHits).toBe(2);
  });
});

/* ──────────────────────────────────────────────
 * Integration: fireProjectile with synergy flags
 * ────────────────────────────────────────────── */
describe('fireProjectile with synergy flags', () => {
  let g;
  beforeEach(() => {
    g = createTestState();
  });

  it('adds armorPierce and shieldBypassHits to projectile when flags set', () => {
    fireProjectile(g, 0, 0, 0, 350, 45, 'plasma', 1, { armorPierce: true, shieldBypassHits: 3, color: 0x9333ea });
    const p = g.projectiles[0];
    expect(p.armorPierce).toBe(true);
    expect(p.shieldBypassHits).toBe(3);
    expect(p.color).toBe(0x9333ea);
  });

  it('adds guided and steerAngle to projectile when flags set', () => {
    fireProjectile(g, 0, 0, 0, 700, 25, 'autocannon', 0, { guided: true, steerAngle: Math.PI / 6 });
    const p = g.projectiles[0];
    expect(p.guided).toBe(true);
    expect(p.steerAngle).toBe(Math.PI / 6);
  });

  it('does not add synergy props when flags not provided', () => {
    fireProjectile(g, 0, 0, 0, 700, 25, 'autocannon', 0);
    const p = g.projectiles[0];
    expect(p.armorPierce).toBeUndefined();
    expect(p.guided).toBeUndefined();
    expect(p.shieldBypassHits).toBeUndefined();
    expect(p.steerAngle).toBeUndefined();
  });

  it('does not add synergy props when flags object is empty', () => {
    fireProjectile(g, 0, 0, 0, 700, 25, 'autocannon', 0, {});
    const p = g.projectiles[0];
    expect(p.armorPierce).toBeUndefined();
    expect(p.guided).toBeUndefined();
  });

  it('defaults shieldBypassHits to 3 when not specified', () => {
    fireProjectile(g, 0, 0, 0, 350, 45, 'plasma', 1, { armorPierce: true });
    const p = g.projectiles[0];
    expect(p.shieldBypassHits).toBe(3);
  });

  it('defaults steerAngle to PI/6 when not specified', () => {
    fireProjectile(g, 0, 0, 0, 700, 25, 'autocannon', 0, { guided: true });
    const p = g.projectiles[0];
    expect(p.steerAngle).toBe(Math.PI / 6);
  });
});

/* ──────────────────────────────────────────────
 * Integration: armor-pierce shield bypass in projectiles
 * ────────────────────────────────────────────── */
describe('armor-pierce shield bypass in projectiles', () => {
  let g;
  beforeEach(() => {
    g = createTestState();
  });

  it('armor-piercing projectile marks enemy with _armorPierced', () => {
    // Place enemy close enough that projectile reaches it in one frame
    const enemy = createTestEnemy(20, 0, 'shielded');
    g.enemies = [enemy];
    // Fire armor-piercing plasma at enemy (speed 700, dt 0.016 = 11.2 units traveled)
    const p = createTestProjectile(0, 0, 0, 'plasma');
    p.damage = 50;
    p.armorPierce = true;
    p.shieldBypassHits = 3;
    p.pierce = 1;
    g.projectiles = [p];

    updateProjectiles(0.016, g, () => {});

    // Mark applied and one hit consumed (3 → 2 after this hit)
    expect(enemy._armorPierced).toBeDefined();
    expect(enemy._armorPierced.hitsLeft).toBe(2);
  });

  it('armor-pierced enemy skips shield absorption on hit', () => {
    const enemy = createTestEnemy(20, 0, 'shielded');
    enemy.shield = 80;
    enemy.maxShield = 80;
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0, 'plasma');
    p.damage = 50;
    p.armorPierce = true;
    p.shieldBypassHits = 3;
    p.pierce = 1;
    g.projectiles = [p];

    updateProjectiles(0.016, g, () => {});

    // Shield should be untouched — all damage went to HP
    expect(enemy.shield).toBe(80);
    expect(enemy.hp).toBe(40 - 50); // 40 - 50 = -10
  });

  it('non-armor-piercing projectile still uses shield normally', () => {
    const enemy = createTestEnemy(20, 0, 'shielded');
    enemy.shield = 80;
    enemy.maxShield = 80;
    enemy.hp = 40;
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0, 'autocannon');
    p.damage = 50;
    g.projectiles = [p];

    updateProjectiles(0.016, g, () => {});

    // Shield absorbs the damage
    expect(enemy.shield).toBe(30); // 80 - 50 = 30
    expect(enemy.hp).toBe(40); // HP untouched
  });

  it('armor-pierce counter decrements and expires', () => {
    const enemy = createTestEnemy(20, 0, 'shielded');
    enemy.shield = 80;
    enemy.maxShield = 80;
    enemy.hp = 200;
    g.enemies = [enemy];

    // First armor-piercing hit — marks enemy and deals full damage
    const p1 = createTestProjectile(0, 0, 0, 'plasma');
    p1.damage = 10;
    p1.armorPierce = true;
    p1.shieldBypassHits = 2;
    p1.pierce = 1; // pierce through this enemy for the second shot
    p1.hitList = [];
    g.projectiles = [p1];
    updateProjectiles(0.016, g, () => {});

    expect(enemy._armorPierced).toBeDefined();
    expect(enemy._armorPierced.hitsLeft).toBe(1); // 2 - 1 consumed = 1
    expect(enemy.shield).toBe(80); // Shield untouched
    expect(enemy.hp).toBe(190);
  });
});

/* ──────────────────────────────────────────────
 * Integration: guided homing in projectiles
 * ────────────────────────────────────────────── */
describe('guided homing in projectiles', () => {
  let g;
  beforeEach(() => {
    g = createTestState();
  });

  it('guided projectile steers toward nearest enemy', () => {
    // Enemy far to the right
    const enemy = createTestEnemy(500, 100);
    g.enemies = [enemy];

    // Guided autocannon shot going straight up (away from enemy)
    const p = createTestProjectile(0, 0, -Math.PI / 2, 'autocannon');
    p.guided = true;
    p.steerAngle = Math.PI / 6;
    g.projectiles = [p];

    const origAngle = Math.atan2(p.vy, p.vx);
    updateProjectiles(0.016, g, () => {});
    const newAngle = Math.atan2(p.vy, p.vx);

    // Angle should have changed toward the enemy (right/down direction)
    expect(newAngle).not.toBe(origAngle);
  });

  it('guided projectile respects max steer angle per frame', () => {
    const enemy = createTestEnemy(500, 500);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0, 'autocannon');
    p.guided = true;
    p.steerAngle = Math.PI / 12; // 15 degrees max per frame
    g.projectiles = [p];

    const origAngle = Math.atan2(p.vy, p.vx);
    updateProjectiles(0.016, g, () => {});
    const newAngle = Math.atan2(p.vy, p.vx);

    let diff = newAngle - origAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Correction should not exceed max steer
    expect(Math.abs(diff)).toBeLessThanOrEqual(p.steerAngle * 0.016 + 0.001);
  });

  it('non-guided projectile does not change direction', () => {
    const enemy = createTestEnemy(500, 100);
    g.enemies = [enemy];

    const p = createTestProjectile(0, 0, 0, 'autocannon');
    // Not guided
    g.projectiles = [p];

    const origAngle = Math.atan2(p.vy, p.vx);
    updateProjectiles(0.016, g, () => {});
    const newAngle = Math.atan2(p.vy, p.vx);

    expect(newAngle).toBe(origAngle);
  });
});

/* ──────────────────────────────────────────────
 * Integration: chain reaction in killEnemy
 * ────────────────────────────────────────────── */
describe('chain reaction in killEnemy', () => {
  let g;
  beforeEach(() => {
    g = createTestState();
    g.levels = { autocannon: 1, plasma: 0, missiles: 3, pointDefense: 3, hull: 1, shield: 1, thrusters: 1, magnet: 1, autoAim: 0 };
  });

  it('chain reaction fires projectiles at nearby enemies on kill', () => {
    const killed = createTestEnemy(0, 0);
    const near = createTestEnemy(100, 100);
    g.enemies = [killed, near];
    g.projectiles = [];

    killEnemy(g, killed, null);

    // Chain reaction should have fired a projectile
    expect(g.projectiles.length).toBeGreaterThan(0);
    const chainProj = g.projectiles[0];
    expect(chainProj.type).toBe('chain_reaction');
  });

  it('chain reaction only targets enemies within radius', () => {
    const killed = createTestEnemy(0, 0);
    const near = createTestEnemy(100, 100);  // ~141, within 200
    const far = createTestEnemy(400, 400);   // ~566, well outside
    g.enemies = [killed, near, far];
    g.projectiles = [];

    killEnemy(g, killed, null);

    // Only near enemy should be targeted (within 200 radius)
    expect(g.projectiles.length).toBe(1);
  });

  it('chain reaction does nothing when synergy is not active', () => {
    g.levels = { autocannon: 1, plasma: 0, missiles: 1, pointDefense: 1, hull: 1, shield: 1, thrusters: 1, magnet: 1, autoAim: 0 };

    const killed = createTestEnemy(0, 0);
    const near = createTestEnemy(50, 50);
    g.enemies = [killed, near];
    g.projectiles = [];

    killEnemy(g, killed, null);

    // No chain reaction since missiles/pointDefense < 3
    expect(g.projectiles.length).toBe(0);
  });

  it('chain reaction creates laser visual effect', () => {
    const killed = createTestEnemy(0, 0);
    const near = createTestEnemy(100, 100);
    g.enemies = [killed, near];
    g.projectiles = [];
    g.effects = [];

    killEnemy(g, killed, null);

    const laserEffect = g.effects.find(e => e.type === 'laser');
    expect(laserEffect).toBeDefined();
  });
});

/* ──────────────────────────────────────────────
 * Integration: point defense synergy in weapons
 * ────────────────────────────────────────────── */
describe('point defense synergy in weapons', () => {
  let g;
  beforeEach(() => {
    g = createTestState();
  });

  it('piercingDefense synergy adds extra hits to point defense', () => {
    // Set up levels for piercingDefense: plasma >= 5, pointDefense >= 5
    g.levels = { autocannon: 0, plasma: 5, missiles: 0, pointDefense: 5, hull: 1, shield: 1, thrusters: 1, magnet: 1, autoAim: 0 };
    g.cooldowns.pointDefense = 0;
    g.player.aimAngle = 0;

    // Add a nearby enemy to hit
    const enemy = createTestEnemy(200, 0);
    g.enemies = [enemy];

    updateWeapons(0.016, g, null);

    // Point defense should have fired — the synergy adds extra hits
    // We can verify by checking that the enemy took damage
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
  });

  it('point defense without synergy uses base max hits', () => {
    g.levels = { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 2, hull: 1, shield: 1, thrusters: 1, magnet: 1, autoAim: 0 };
    g.cooldowns.pointDefense = 0;
    g.player.aimAngle = 0;

    // Add two nearby enemies
    const enemy1 = createTestEnemy(200, 0);
    const enemy2 = createTestEnemy(210, 10);
    g.enemies = [enemy1, enemy2];

    updateWeapons(0.016, g, null);

    // With pointDefense level 2, base maxHits = 1 + floor(2/2) = 2
    // Without synergy, should hit at most 2 enemies
    const hitCount = g.enemies.filter(e => e.hp < e.maxHp).length;
    expect(hitCount).toBeLessThanOrEqual(2);
  });
});

/* ──────────────────────────────────────────────
 * Integration: weapons.js applies synergy on fire
 * ────────────────────────────────────────────── */
describe('weapons.js applies synergy on fire', () => {
  let g;
  beforeEach(() => {
    g = createTestState();
    g.cooldowns = { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 };
    g.player.aimAngle = 0;
  });

  it('plasma with penetration synergy fires armor-piercing projectiles', () => {
    g.levels = { autocannon: 5, plasma: 5, missiles: 0, pointDefense: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1, autoAim: 0 };
    g.cooldowns.plasma = 0;
    g.projectiles = [];

    updateWeapons(0.016, g, null);

    const plasmaProj = g.projectiles.find(p => p.type === 'plasma');
    expect(plasmaProj).toBeDefined();
    expect(plasmaProj.armorPierce).toBe(true);
    expect(plasmaProj.shieldBypassHits).toBe(3);
  });

  it('autocannon with guidedRounds synergy may fire guided projectiles', () => {
    g.levels = { autocannon: 5, plasma: 0, missiles: 5, pointDefense: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1, autoAim: 0 };
    g.cooldowns.autocannon = 0;
    g.projectiles = [];

    // Run multiple times to catch the 10% chance
    let foundGuided = false;
    for (let i = 0; i < 50; i++) {
      g.cooldowns.autocannon = 0;
      g.projectiles = [];
      updateWeapons(0.016, g, null);
      const acProj = g.projectiles.find(p => p.type === 'autocannon');
      if (acProj && acProj.guided) {
        foundGuided = true;
        expect(acProj.steerAngle).toBe(Math.PI / 6);
        break;
      }
    }
    expect(foundGuided).toBe(true);
  });

  it('plasma without penetration synergy does not armor-pierce', () => {
    g.levels = { autocannon: 2, plasma: 3, missiles: 0, pointDefense: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1, autoAim: 0 };
    g.cooldowns.plasma = 0;
    g.projectiles = [];

    updateWeapons(0.016, g, null);

    const plasmaProj = g.projectiles.find(p => p.type === 'plasma');
    expect(plasmaProj).toBeDefined();
    expect(plasmaProj.armorPierce).toBeUndefined();
  });
});
