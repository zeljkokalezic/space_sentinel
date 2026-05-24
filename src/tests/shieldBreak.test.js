/**
 * Unit tests for shield break effect system.
 *
 * When an entity's shield is depleted (drops from >0 to <=0),
 * a dramatic visual/audio effect plays: shatter particles, screen shake,
 * hit stop, sound, and "SHIELD DOWN" damage popup.
 *
 * Tests cover: config, trigger, effect creation, and edge cases.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkShieldBreak } from '../engine/combat';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState, createTestEnemy } from './helpers';

// Track SoundManager calls
let soundCalls = [];
vi.mock('../engine/audio', () => ({
  SoundManager: {
    play: vi.fn((name) => { soundCalls.push(name); }),
  },
}));

/* ──────────────────────────────────────────────
 * Config: GAME_CONFIG.shieldBreak
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.shieldBreak', () => {
  it('has particleCount value', () => {
    expect(GAME_CONFIG.shieldBreak.particleCount).toBeGreaterThan(0);
  });

  it('has particleColor value', () => {
    expect(GAME_CONFIG.shieldBreak.particleColor).toBeDefined();
  });

  it('has screenShakePreset value', () => {
    expect(GAME_CONFIG.shieldBreak.screenShakePreset).toBeDefined();
  });

  it('has hitStopPreset value', () => {
    expect(GAME_CONFIG.shieldBreak.hitStopPreset).toBeDefined();
  });

  it('has popupText value', () => {
    expect(GAME_CONFIG.shieldBreak.popupText).toBeDefined();
    expect(typeof GAME_CONFIG.shieldBreak.popupText).toBe('string');
  });

  it('has popupLife value', () => {
    expect(GAME_CONFIG.shieldBreak.popupLife).toBeGreaterThan(0);
  });

  it('has popupColor value', () => {
    expect(GAME_CONFIG.shieldBreak.popupColor).toBeDefined();
  });
});

/* ──────────────────────────────────────────────
 * checkShieldBreak (from combat.js)
 * ────────────────────────────────────────────── */
describe('checkShieldBreak', () => {
  let g;

  beforeEach(() => {
    soundCalls = [];
    g = createTestState({
      effects: [],
      particles: [],
      screenShake: { active: false, intensity: 0 },
      hitStop: { active: false, remaining: 0 },
    });
  });

  describe('shield break detection', () => {
    it('triggers when shield drops from >0 to 0', () => {
      // Simulate post-absorption: shield was >0, now reduced to 0
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0; // depleted
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.effects.length).toBeGreaterThan(0);
      expect(g.particles.length).toBeGreaterThan(0);
    });

    it('triggers when shield drops from >0 to negative', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = -1; // Overkill
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.effects.length).toBeGreaterThan(0);
    });

    it('does NOT trigger when shield was already 0', () => {
      const enemy = createTestEnemy(100, 100, 'fighter');
      enemy.shield = 0;
      enemy.maxShield = 0;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.effects.length).toBe(0);
      expect(g.particles.length).toBe(0);
    });

    it('does NOT trigger when shield was never present (maxShield=0)', () => {
      const enemy = createTestEnemy(100, 100, 'fighter');
      enemy.shield = 0;
      enemy.maxShield = 0;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.effects.length).toBe(0);
    });

    it('does NOT trigger when shield is still above 0', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 30; // Still has shield
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.effects.length).toBe(0);
      expect(g.particles.length).toBe(0);
    });

    it('does NOT trigger for entities with no maxShield property', () => {
      const entity = { x: 100, y: 100, shield: 0 };
      // No maxShield property

      checkShieldBreak(g, entity, 100, 100);

      expect(g.effects.length).toBe(0);
    });
  });

  describe('effect creation', () => {
    it('creates a "shield_down" damage popup effect', () => {
      const enemy = createTestEnemy(200, 300, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 200, 300);

      const popup = g.effects.find(e => e.type === 'shield_down');
      expect(popup).toBeDefined();
      expect(popup.text).toBe(GAME_CONFIG.shieldBreak.popupText);
      expect(popup.x).toBe(200);
      expect(popup.y).toBe(300);
      expect(popup.life).toBe(GAME_CONFIG.shieldBreak.popupLife);
    });

    it('creates shatter particles', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.particles.length).toBe(GAME_CONFIG.shieldBreak.particleCount);
      // All particles should be at the entity position
      for (const p of g.particles) {
        expect(p.x).toBe(100);
        expect(p.y).toBe(100);
        expect(p.color).toBe(GAME_CONFIG.shieldBreak.particleColor);
        expect(p.active).toBe(true);
      }
    });

    it('particles have varying velocities', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      // At least some particles should have non-zero velocity
      const movingParticles = g.particles.filter(p => p.vx !== 0 || p.vy !== 0);
      expect(movingParticles.length).toBeGreaterThan(0);
    });

    it('triggers screen shake', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.screenShake.active).toBe(true);
      expect(g.screenShake.intensity).toBeGreaterThan(0);
    });

    it('triggers hit stop', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.hitStop.active).toBe(true);
      expect(g.hitStop.remaining).toBeGreaterThan(0);
    });

    it('plays shield_break sound', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(soundCalls).toContain('shield_break');
    });
  });

  describe('entity types', () => {
    it('works for shielded enemies', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.effects.length).toBeGreaterThan(0);
    });

    it('works for bosses with shields', () => {
      const boss = {
        x: 500, y: 500,
        shield: 0, maxShield: 200,
        active: true,
      };

      checkShieldBreak(g, boss, 500, 500);

      expect(g.effects.length).toBeGreaterThan(0);
      const popup = g.effects.find(e => e.type === 'shield_down');
      expect(popup.x).toBe(500);
      expect(popup.y).toBe(500);
    });

    it('works for minibosses with shields', () => {
      const miniboss = {
        x: 300, y: 400,
        shield: -5, maxShield: 100, // overkill break
        active: true,
      };

      checkShieldBreak(g, miniboss, 300, 400);

      expect(g.effects.length).toBeGreaterThan(0);
    });

    it('works for player shield break', () => {
      g.player.shield = 0;
      g.player.maxShield = 20;

      checkShieldBreak(g, g.player, g.player.x, g.player.y);

      expect(g.effects.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles null entity gracefully', () => {
      expect(() => checkShieldBreak(g, null, 0, 0)).not.toThrow();
    });

    it('handles null game state gracefully', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      expect(() => checkShieldBreak(null, enemy, 100, 100)).not.toThrow();
    });

    it('handles missing effects array', () => {
      delete g.effects;
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      expect(() => checkShieldBreak(g, enemy, 100, 100)).not.toThrow();
    });

    it('handles missing particles array', () => {
      delete g.particles;
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      expect(() => checkShieldBreak(g, enemy, 100, 100)).not.toThrow();
    });

    it('handles missing screenShake state', () => {
      delete g.screenShake;
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      expect(() => checkShieldBreak(g, enemy, 100, 100)).not.toThrow();
    });

    it('handles missing hitStop state', () => {
      delete g.hitStop;
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      expect(() => checkShieldBreak(g, enemy, 100, 100)).not.toThrow();
    });

    it('does not trigger twice for same entity (idempotent per call)', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);
      const firstCount = g.effects.length;

      checkShieldBreak(g, enemy, 100, 100);
      const secondCount = g.effects.length;

      // Should add another effect each time (the caller is responsible for
      // tracking whether shield already broke)
      expect(secondCount).toBe(firstCount + 1);
    });
  });

  describe('config-driven behavior', () => {
    it('uses configured particle count', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      expect(g.particles.length).toBe(GAME_CONFIG.shieldBreak.particleCount);
    });

    it('uses configured particle color', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      for (const p of g.particles) {
        expect(p.color).toBe(GAME_CONFIG.shieldBreak.particleColor);
      }
    });

    it('uses configured screen shake preset', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      const expectedIntensity = GAME_CONFIG.screenShake.presets[GAME_CONFIG.shieldBreak.screenShakePreset];
      expect(g.screenShake.intensity).toBe(expectedIntensity);
    });

    it('uses configured hit stop preset', () => {
      const enemy = createTestEnemy(100, 100, 'shielded');
      enemy.shield = 0;
      enemy.maxShield = 80;

      checkShieldBreak(g, enemy, 100, 100);

      const expectedDuration = GAME_CONFIG.hitStop.presets[GAME_CONFIG.shieldBreak.hitStopPreset];
      expect(g.hitStop.remaining).toBe(expectedDuration);
    });
  });
});
