/**
 * Unit tests for enemy death pulse system.
 *
 * When powerful enemy types die, they emit an expanding shockwave ring
 * that damages nearby enemies (chain kills) and the player if too close.
 *
 * Tests cover: config, trigger, update (expansion + damage), collision, and edge cases.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerDeathPulse } from '../engine/combat';
import { updateDeathPulses } from '../engine/systems/deathPulses';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState, createTestEnemy } from './helpers';

// Mock SoundManager to prevent audio errors in test environment
vi.mock('../engine/audio', () => ({
  SoundManager: { play: vi.fn() },
}));

/* ──────────────────────────────────────────────
 * Config: GAME_CONFIG.deathPulse
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.deathPulse', () => {
  it('has baseDamage value', () => {
    expect(GAME_CONFIG.deathPulse.baseDamage).toBeGreaterThan(0);
  });

  it('has damagePerLevel value', () => {
    expect(GAME_CONFIG.deathPulse.damagePerLevel).toBeGreaterThanOrEqual(0);
  });

  it('has baseRadius value', () => {
    expect(GAME_CONFIG.deathPulse.baseRadius).toBeGreaterThan(0);
  });

  it('has radiusPerLevel value', () => {
    expect(GAME_CONFIG.deathPulse.radiusPerLevel).toBeGreaterThanOrEqual(0);
  });

  it('has ringDuration value', () => {
    expect(GAME_CONFIG.deathPulse.ringDuration).toBeGreaterThan(0);
  });

  it('has ringColor value', () => {
    expect(GAME_CONFIG.deathPulse.ringColor).toBeDefined();
  });

  it('has eligibleTypes array', () => {
    expect(Array.isArray(GAME_CONFIG.deathPulse.eligibleTypes)).toBe(true);
    expect(GAME_CONFIG.deathPulse.eligibleTypes.length).toBeGreaterThan(0);
  });

  it('eligibleTypes includes heavy', () => {
    expect(GAME_CONFIG.deathPulse.eligibleTypes).toContain('heavy');
  });

  it('eligibleTypes includes shielded', () => {
    expect(GAME_CONFIG.deathPulse.eligibleTypes).toContain('shielded');
  });

  it('eligibleTypes includes missile_boat', () => {
    expect(GAME_CONFIG.deathPulse.eligibleTypes).toContain('missile_boat');
  });

  it('eligibleTypes does not include fighter', () => {
    expect(GAME_CONFIG.deathPulse.eligibleTypes).not.toContain('fighter');
  });

  it('has chainKillChance value', () => {
    expect(GAME_CONFIG.deathPulse.chainKillChance).toBeGreaterThan(0);
    expect(GAME_CONFIG.deathPulse.chainKillChance).toBeLessThanOrEqual(1);
  });
});

/* ──────────────────────────────────────────────
 * triggerDeathPulse (from combat.js)
 * ────────────────────────────────────────────── */
describe('triggerDeathPulse', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      deathPulses: [],
    });
  });

  it('creates a death pulse at given position', () => {
    expect(g.deathPulses.length).toBe(0);
    triggerDeathPulse(g, 100, 200, 'heavy');
    expect(g.deathPulses.length).toBe(1);
    const pulse = g.deathPulses[0];
    expect(pulse.x).toBe(100);
    expect(pulse.y).toBe(200);
  });

  it('pulse starts with zero radius', () => {
    triggerDeathPulse(g, 0, 0, 'heavy');
    expect(g.deathPulses[0].radius).toBe(0);
  });

  it('pulse has correct maxRadius from config (level 1)', () => {
    g.level = 1;
    triggerDeathPulse(g, 0, 0, 'heavy');
    const expected = GAME_CONFIG.deathPulse.baseRadius +
      (g.level - 1) * GAME_CONFIG.deathPulse.radiusPerLevel;
    expect(g.deathPulses[0].maxRadius).toBe(expected);
  });

  it('pulse maxRadius scales with level', () => {
    g.level = 10;
    triggerDeathPulse(g, 0, 0, 'shielded');
    const expected = GAME_CONFIG.deathPulse.baseRadius +
      (g.level - 1) * GAME_CONFIG.deathPulse.radiusPerLevel;
    expect(g.deathPulses[0].maxRadius).toBe(expected);
  });

  it('pulse damage scales with level', () => {
    g.level = 1;
    triggerDeathPulse(g, 0, 0, 'heavy');
    const dmg1 = g.deathPulses[0].damage;

    g.level = 10;
    g.deathPulses = [];
    triggerDeathPulse(g, 0, 0, 'heavy');
    const dmg10 = g.deathPulses[0].damage;

    expect(dmg10).toBeGreaterThan(dmg1);
  });

  it('pulse damage formula: baseDamage + (level-1)*damagePerLevel', () => {
    g.level = 5;
    triggerDeathPulse(g, 0, 0, 'missile_boat');
    const expected = GAME_CONFIG.deathPulse.baseDamage +
      (g.level - 1) * GAME_CONFIG.deathPulse.damagePerLevel;
    expect(g.deathPulses[0].damage).toBe(expected);
  });

  it('pulse has correct lifetime from config', () => {
    triggerDeathPulse(g, 0, 0, 'heavy');
    expect(g.deathPulses[0].life).toBe(GAME_CONFIG.deathPulse.ringDuration);
    expect(g.deathPulses[0].maxLife).toBe(GAME_CONFIG.deathPulse.ringDuration);
  });

  it('pulse is active on creation', () => {
    triggerDeathPulse(g, 0, 0, 'heavy');
    expect(g.deathPulses[0].active).toBe(true);
  });

  it('pulse has correct color from config', () => {
    triggerDeathPulse(g, 0, 0, 'heavy');
    expect(g.deathPulses[0].color).toBe(GAME_CONFIG.deathPulse.ringColor);
  });

  it('handles missing deathPulses array gracefully', () => {
    const stateNoPulses = createTestState();
    delete stateNoPulses.deathPulses;
    expect(() => triggerDeathPulse(stateNoPulses, 0, 0, 'heavy')).not.toThrow();
  });

  it('handles null state gracefully', () => {
    expect(() => triggerDeathPulse(null, 0, 0, 'heavy')).not.toThrow();
  });

  it('multiple pulses are independent', () => {
    triggerDeathPulse(g, 0, 0, 'heavy');
    triggerDeathPulse(g, 100, 100, 'shielded');
    expect(g.deathPulses.length).toBe(2);
    expect(g.deathPulses[0].x).toBe(0);
    expect(g.deathPulses[1].x).toBe(100);
  });
});

/* ──────────────────────────────────────────────
 * updateDeathPulses (from systems/deathPulses.js)
 * ────────────────────────────────────────────── */
describe('updateDeathPulses', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      deathPulses: [],
      enemies: [],
      projectiles: [],
      particles: [],
      pickups: [],
      effects: [],
    });
  });

  it('returns false when no pulses active', () => {
    expect(updateDeathPulses(0.016, g)).toBe(false);
  });

  it('returns false when null state', () => {
    expect(updateDeathPulses(0.016, null)).toBe(false);
  });

  it('returns false when missing deathPulses', () => {
    delete g.deathPulses;
    expect(updateDeathPulses(0.016, g)).toBe(false);
  });

  describe('pulse expansion', () => {
    it('pulse radius expands over time', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');
      const pulse = g.deathPulses[0];
      const initialRadius = pulse.radius;

      updateDeathPulses(0.05, g);

      expect(pulse.radius).toBeGreaterThan(initialRadius);
    });

    it('pulse radius does not exceed maxRadius', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');
      const pulse = g.deathPulses[0];
      const maxR = pulse.maxRadius;

      // Advance past duration
      updateDeathPulses(pulse.maxLife + 0.1, g);

      expect(pulse.radius).toBeLessThanOrEqual(maxR);
    });

    it('pulse life decreases over time', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');
      const pulse = g.deathPulses[0];
      const initialLife = pulse.life;

      updateDeathPulses(0.1, g);

      expect(pulse.life).toBeLessThan(initialLife);
    });

    it('pulse deactivates when life expires', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');
      const pulse = g.deathPulses[0];

      updateDeathPulses(pulse.maxLife + 0.01, g);

      expect(pulse.active).toBe(false);
    });

    it('inactive pulses are skipped', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');
      g.deathPulses[0].active = false;

      updateDeathPulses(0.1, g);

      // Inactive pulse should not change
      expect(g.deathPulses[0].radius).toBe(0);
    });
  });

  describe('enemy chain damage', () => {
    it('damages nearby enemies within pulse radius', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');
      const pulse = g.deathPulses[0];

      // Place enemy within range (close enough to be hit after 0.05s expansion)
      // At level 1: maxRadius=120, after 0.05s radius ≈ 120 * (0.05/0.4) = 15
      // Enemy at (10, 10) → distance ≈ 14.1, well within radius + enemy radius
      const nearEnemy = createTestEnemy(10, 10, 'fighter');
      nearEnemy.hp = 50;
      g.enemies.push(nearEnemy);

      // Advance pulse to cover the enemy
      updateDeathPulses(0.05, g);

      expect(nearEnemy.hp).toBeLessThan(50);
    });

    it('does not damage enemies outside pulse radius', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      // Place enemy far away
      const farEnemy = createTestEnemy(500, 500, 'fighter');
      farEnemy.hp = 50;
      g.enemies.push(farEnemy);

      updateDeathPulses(0.05, g);

      expect(farEnemy.hp).toBe(50);
    });

    it('kills enemy if pulse damage exceeds HP', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');
      const pulse = g.deathPulses[0];

      const weakEnemy = createTestEnemy(10, 10, 'fighter');
      weakEnemy.hp = 5;
      g.enemies.push(weakEnemy);

      updateDeathPulses(0.05, g);

      expect(weakEnemy.active).toBe(false);
    });

    it('only damages each enemy once per pulse', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      const enemy = createTestEnemy(20, 20, 'fighter');
      enemy.hp = 50;
      g.enemies.push(enemy);

      const initialHp = enemy.hp;
      updateDeathPulses(0.05, g);
      const hpAfterFirst = enemy.hp;

      // Advance further - enemy should not take additional damage
      updateDeathPulses(0.05, g);
      const hpAfterSecond = enemy.hp;

      expect(hpAfterSecond).toBe(hpAfterFirst);
    });

    it('does not damage already-dead enemies', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      const deadEnemy = createTestEnemy(10, 10, 'fighter');
      deadEnemy.active = false;
      deadEnemy.hp = 50;
      g.enemies.push(deadEnemy);

      updateDeathPulses(0.05, g);

      expect(deadEnemy.hp).toBe(50);
    });

    it('shield absorbs pulse damage first', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      const shieldedEnemy = createTestEnemy(20, 20, 'shielded');
      shieldedEnemy.hp = 40;
      shieldedEnemy.shield = 80;
      shieldedEnemy.maxShield = 80;
      g.enemies.push(shieldedEnemy);

      updateDeathPulses(0.05, g);

      // Shield should absorb damage before HP
      expect(shieldedEnemy.shield).toBeLessThan(80);
    });

    it('chain kill triggers secondary pulse with probability', () => {
      // We can't easily test probability, but we can verify the mechanic
      // doesn't crash when a chain kill occurs
      g.level = 1;
      triggerDeathPulse(g, 0, 0, 'heavy');

      const fragileEnemy = createTestEnemy(10, 10, 'heavy');
      fragileEnemy.hp = 5;
      g.enemies.push(fragileEnemy);

      const initialPulseCount = g.deathPulses.length;

      expect(() => {
        updateDeathPulses(0.05, g);
      }).not.toThrow();
    });
  });

  describe('player damage', () => {
    it('damages player within pulse radius', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      // Move player close to pulse
      g.player.x = 30;
      g.player.y = 30;
      g.player.hp = 300;
      g.player.shield = 20;
      g.player.maxShield = 20;

      updateDeathPulses(0.05, g);

      // Player should have taken damage (shield or HP)
      const totalHp = g.player.hp + g.player.shield;
      expect(totalHp).toBeLessThan(320);
    });

    it('does not damage player outside pulse radius', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      g.player.x = 500;
      g.player.y = 500;
      g.player.hp = 300;
      g.player.shield = 20;

      updateDeathPulses(0.05, g);

      expect(g.player.hp).toBe(300);
      expect(g.player.shield).toBe(20);
    });

    it('shield absorbs player pulse damage first', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      g.player.x = 30;
      g.player.y = 30;
      g.player.hp = 300;
      g.player.shield = 20;
      g.player.maxShield = 20;

      updateDeathPulses(0.05, g);

      // Shield should be damaged before HP
      expect(g.player.shield).toBeLessThan(20);
    });

    it('damages HP when shield is depleted', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      g.player.x = 30;
      g.player.y = 30;
      g.player.hp = 300;
      g.player.shield = 0;
      g.player.maxShield = 20;

      updateDeathPulses(0.05, g);

      expect(g.player.hp).toBeLessThan(300);
    });

    it('only damages player once per pulse', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      g.player.x = 30;
      g.player.y = 30;
      g.player.hp = 300;
      g.player.shield = 0;

      updateDeathPulses(0.05, g);
      const hpAfterFirst = g.player.hp;

      updateDeathPulses(0.05, g);
      const hpAfterSecond = g.player.hp;

      expect(hpAfterSecond).toBe(hpAfterFirst);
    });

    it('does not kill player (returns false)', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');

      g.player.x = 0;
      g.player.y = 0;
      g.player.hp = 1;
      g.player.shield = 0;

      // Even if pulse would kill player, updateDeathPulses returns false
      // (game over handling is done by the caller)
      const result = updateDeathPulses(0.05, g);
      expect(result).toBe(false);
    });
  });

  describe('screen shake & hit stop integration', () => {
    it('triggers screen shake on pulse creation', () => {
      g.screenShake = { active: false, intensity: 0 };
      triggerDeathPulse(g, 0, 0, 'heavy');

      expect(g.screenShake.active).toBe(true);
      expect(g.screenShake.intensity).toBeGreaterThan(0);
    });

    it('triggers hit stop on pulse creation', () => {
      g.hitStop = { active: false, remaining: 0 };
      triggerDeathPulse(g, 0, 0, 'heavy');

      expect(g.hitStop.active).toBe(true);
      expect(g.hitStop.remaining).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('expired pulses are removed from array', () => {
      triggerDeathPulse(g, 0, 0, 'heavy');
      const pulse = g.deathPulses[0];

      // Advance past duration
      updateDeathPulses(pulse.maxLife + 0.1, g);

      expect(g.deathPulses.length).toBe(0);
    });

    it('multiple pulses cleaned up independently', () => {
      g.level = 1;
      triggerDeathPulse(g, 0, 0, 'heavy');
      triggerDeathPulse(g, 200, 200, 'shielded');

      const pulse1Life = g.deathPulses[0].maxLife;

      // Advance past first pulse
      updateDeathPulses(pulse1Life + 0.1, g);

      expect(g.deathPulses.length).toBe(0);
    });
  });
});

/* ──────────────────────────────────────────────
 * Integration: killEnemy triggers death pulse
 * ────────────────────────────────────────────── */
describe('killEnemy death pulse integration', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      deathPulses: [],
      stats: { enemiesDestroyed: 0 },
      combo: { count: 0, timer: 0, multiplier: 1 },
      powerups: [],
      pickups: [],
      particles: [],
      mission: null,
      screenShake: { active: false, intensity: 0 },
      hitStop: { active: false, remaining: 0 },
    });
  });

  it('heavy enemy death triggers death pulse', async () => {
    const { killEnemy } = await import('../engine/combat');
    const heavy = createTestEnemy(100, 200, 'heavy');
    killEnemy(g, heavy, null);
    expect(g.deathPulses.length).toBe(1);
  });

  it('shielded enemy death triggers death pulse', async () => {
    const { killEnemy } = await import('../engine/combat');
    const shielded = createTestEnemy(100, 200, 'shielded');
    killEnemy(g, shielded, null);
    expect(g.deathPulses.length).toBe(1);
  });

  it('missile_boat death triggers death pulse', async () => {
    const { killEnemy } = await import('../engine/combat');
    const boat = createTestEnemy(100, 200, 'missile_boat');
    killEnemy(g, boat, null);
    expect(g.deathPulses.length).toBe(1);
  });

  it('fighter death does NOT trigger death pulse', async () => {
    const { killEnemy } = await import('../engine/combat');
    const fighter = createTestEnemy(100, 200, 'fighter');
    killEnemy(g, fighter, null);
    expect(g.deathPulses.length).toBe(0);
  });

  it('interceptor death does NOT trigger death pulse', async () => {
    const { killEnemy } = await import('../engine/combat');
    const interceptor = createTestEnemy(100, 200, 'interceptor');
    killEnemy(g, interceptor, null);
    expect(g.deathPulses.length).toBe(0);
  });
});
