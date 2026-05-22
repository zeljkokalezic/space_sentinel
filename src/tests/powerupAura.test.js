/**
 * Unit tests for power-up pickup aura ring system.
 *
 * When the player collects a power-up, an expanding energy ring radiates
 * from the player position with a floating buff name text.
 *
 * Tests cover: config, trigger, update, and edge cases.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPowerupAura } from '../engine/combat';
import { updatePowerupAuras } from '../engine/systems/particles';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';

// Track SoundManager calls
let soundCalls = [];
vi.mock('../engine/audio', () => ({
  SoundManager: {
    play: vi.fn((name) => { soundCalls.push(name); }),
  },
}));

/* ──────────────────────────────────────────────
 * Config: GAME_CONFIG.powerupAura
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.powerupAura', () => {
  it('has enabled flag', () => {
    expect(GAME_CONFIG.powerupAura.enabled).toBe(true);
  });

  it('has expandSpeed value', () => {
    expect(GAME_CONFIG.powerupAura.expandSpeed).toBeGreaterThan(0);
  });

  it('has maxRadius value', () => {
    expect(GAME_CONFIG.powerupAura.maxRadius).toBeGreaterThan(0);
  });

  it('has ringDuration value', () => {
    expect(GAME_CONFIG.powerupAura.ringDuration).toBeGreaterThan(0);
  });

  it('has lineWidth value', () => {
    expect(GAME_CONFIG.powerupAura.lineWidth).toBeGreaterThan(0);
  });

  it('has textDuration value', () => {
    expect(GAME_CONFIG.powerupAura.textDuration).toBeGreaterThan(0);
  });

  it('has textFloatSpeed value', () => {
    expect(GAME_CONFIG.powerupAura.textFloatSpeed).toBeGreaterThan(0);
  });

  it('has textFontSize value', () => {
    expect(GAME_CONFIG.powerupAura.textFontSize).toBeGreaterThan(0);
  });

  it('has maxAuras value', () => {
    expect(GAME_CONFIG.powerupAura.maxAuras).toBeGreaterThan(0);
  });
});

/* ──────────────────────────────────────────────
 * triggerPowerupAura (from combat.js)
 * ────────────────────────────────────────────── */
describe('triggerPowerupAura', () => {
  let g;

  beforeEach(() => {
    soundCalls = [];
    g = createTestState({
      player: { x: 100, y: 200, vx: 0, vy: 0, radius: 38, hp: 300, maxHp: 300, shield: 20, maxShield: 20, speed: 120, magnetRadius: 150, yaw: Math.PI / 2 },
      powerupAuras: [],
    });
  });

  describe('basic trigger', () => {
    it('creates an aura effect', () => {
      triggerPowerupAura(g, 'rapidFire', '#fbbf24', 100, 200);

      expect(g.powerupAuras.length).toBe(1);
      const aura = g.powerupAuras[0];
      expect(aura.active).toBe(true);
      expect(aura.x).toBe(100);
      expect(aura.y).toBe(200);
      expect(aura.color).toBe('#fbbf24');
      expect(aura.type).toBe('rapidFire');
    });

    it('initializes ring at radius 0', () => {
      triggerPowerupAura(g, 'shieldBoost', '#3b82f6', 100, 200);

      const aura = g.powerupAuras[0];
      expect(aura.ringRadius).toBe(0);
      expect(aura.ringMaxRadius).toBe(GAME_CONFIG.powerupAura.maxRadius);
      expect(aura.ringLife).toBe(GAME_CONFIG.powerupAura.ringDuration);
    });

    it('initializes text at player position', () => {
      triggerPowerupAura(g, 'damageSurge', '#ef4444', 100, 200);

      const aura = g.powerupAuras[0];
      expect(aura.textY).toBe(200);
      expect(aura.textLife).toBe(GAME_CONFIG.powerupAura.textDuration);
    });

    it('formats buff name from camelCase', () => {
      triggerPowerupAura(g, 'rapidFire', '#fbbf24', 100, 200);
      expect(g.powerupAuras[0].name).toBe('Rapid Fire');

      triggerPowerupAura(g, 'shieldBoost', '#3b82f6', 100, 200);
      expect(g.powerupAuras[1].name).toBe('Shield Boost');

      triggerPowerupAura(g, 'damageSurge', '#ef4444', 100, 200);
      expect(g.powerupAuras[2].name).toBe('Damage Surge');

      triggerPowerupAura(g, 'timeSlow', '#a855f7', 100, 200);
      expect(g.powerupAuras[3].name).toBe('Time Slow');
    });

    it('gets icon from powerup config', () => {
      triggerPowerupAura(g, 'rapidFire', '#fbbf24', 100, 200);
      expect(g.powerupAuras[0].icon).toBe('⚡');

      triggerPowerupAura(g, 'shieldBoost', '#3b82f6', 100, 200);
      expect(g.powerupAuras[1].icon).toBe('🛡');
    });
  });

  describe('max concurrent auras', () => {
    it('enforces maxAuras limit', () => {
      const maxAuras = GAME_CONFIG.powerupAura.maxAuras;
      for (let i = 0; i < maxAuras; i++) {
        triggerPowerupAura(g, 'rapidFire', '#fbbf24', 100, 200);
      }
      expect(g.powerupAuras.length).toBe(maxAuras);

      // Adding one more should remove the oldest
      triggerPowerupAura(g, 'shieldBoost', '#3b82f6', 100, 200);
      expect(g.powerupAuras.length).toBe(maxAuras);
      // The oldest (rapidFire) should have been removed
      expect(g.powerupAuras[0].type).toBe('rapidFire'); // second one
      expect(g.powerupAuras[g.powerupAuras.length - 1].type).toBe('shieldBoost'); // newest
    });
  });

  describe('edge cases', () => {
    it('handles null game state gracefully', () => {
      expect(() => triggerPowerupAura(null, 'rapidFire', '#fbbf24', 0, 0)).not.toThrow();
    });

    it('handles missing powerupAuras array', () => {
      delete g.powerupAuras;
      triggerPowerupAura(g, 'rapidFire', '#fbbf24', 100, 200);
      expect(g.powerupAuras).toBeDefined();
      expect(g.powerupAuras.length).toBe(1);
    });

    it('handles unknown power-up type gracefully', () => {
      triggerPowerupAura(g, 'unknownType', '#ffffff', 100, 200);
      const aura = g.powerupAuras[0];
      expect(aura.icon).toBe('✦'); // default icon
      expect(aura.name).toBeDefined();
    });

    it('does nothing when config is disabled', () => {
      const originalEnabled = GAME_CONFIG.powerupAura.enabled;
      GAME_CONFIG.powerupAura.enabled = false;
      triggerPowerupAura(g, 'rapidFire', '#fbbf24', 100, 200);
      expect(g.powerupAuras.length).toBe(0);
      GAME_CONFIG.powerupAura.enabled = originalEnabled;
    });
  });
});

/* ──────────────────────────────────────────────
 * updatePowerupAuras (from particles.js)
 * ────────────────────────────────────────────── */
describe('updatePowerupAuras', () => {
  let g;

  beforeEach(() => {
    g = createTestState({
      player: { x: 0, y: 0, vx: 0, vy: 0, radius: 38, hp: 300, maxHp: 300, shield: 20, maxShield: 20, speed: 120, magnetRadius: 150, yaw: Math.PI / 2 },
      powerupAuras: [{
        active: true,
        x: 0, y: 0,
        color: '#fbbf24',
        type: 'rapidFire',
        icon: '⚡',
        name: 'Rapid Fire',
        ringRadius: 0,
        ringMaxRadius: 150,
        ringLife: 0.8,
        ringMaxLife: 0.8,
        textY: 0,
        textLife: 1.5,
        textMaxLife: 1.5,
      }],
    });
  });

  describe('ring expansion', () => {
    it('expands ring radius over time', () => {
      const aura = g.powerupAuras[0];
      const initialRadius = aura.ringRadius;

      updatePowerupAuras(0.1, g);

      expect(aura.ringRadius).toBeGreaterThan(initialRadius);
    });

    it('caps ring at maxRadius', () => {
      const aura = g.powerupAuras[0];

      // Simulate enough time to exceed max radius
      updatePowerupAuras(1.0, g);

      expect(aura.ringRadius).toBeLessThanOrEqual(aura.ringMaxRadius);
    });

    it('ring stops expanding when ringLife expires', () => {
      const aura = g.powerupAuras[0];

      // Let ring expire
      updatePowerupAuras(1.0, g);

      // Ring should have stopped expanding
      const radiusAfter = aura.ringRadius;
      updatePowerupAuras(0.5, g);
      expect(aura.ringRadius).toBe(radiusAfter);
    });
  });

  describe('text float', () => {
    it('floats text upward over time', () => {
      const aura = g.powerupAuras[0];
      const initialTextY = aura.textY;

      updatePowerupAuras(0.1, g);

      expect(aura.textY).toBeGreaterThan(initialTextY);
    });

    it('text continues floating after ring expires', () => {
      const aura = g.powerupAuras[0];

      // Let ring expire but text should still be alive
      updatePowerupAuras(1.0, g);

      expect(aura.ringLife).toBe(0);
      expect(aura.textLife).toBeGreaterThan(0);
      expect(aura.textY).toBeGreaterThan(0);
    });
  });

  describe('deactivation', () => {
    it('deactivates when both ring and text expire', () => {
      const aura = g.powerupAuras[0];

      // Let everything expire
      updatePowerupAuras(2.0, g);

      expect(aura.active).toBe(false);
    });

    it('stays active while text is still alive', () => {
      const aura = g.powerupAuras[0];

      // Ring expires first (0.8s) but text lasts (1.5s)
      updatePowerupAuras(1.0, g);

      expect(aura.active).toBe(true);
    });

    it('cleans up dead auras from array', () => {
      expect(g.powerupAuras.length).toBe(1);

      // Let everything expire
      updatePowerupAuras(2.0, g);

      // Dead auras should be cleaned up
      expect(g.powerupAuras.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles null game state gracefully', () => {
      expect(() => updatePowerupAuras(0.016, null)).not.toThrow();
    });

    it('handles missing powerupAuras array', () => {
      delete g.powerupAuras;
      expect(() => updatePowerupAuras(0.016, g)).not.toThrow();
    });

    it('handles empty powerupAuras array', () => {
      g.powerupAuras = [];
      expect(() => updatePowerupAuras(0.016, g)).not.toThrow();
      expect(g.powerupAuras.length).toBe(0);
    });

    it('skips inactive auras', () => {
      g.powerupAuras[0].active = false;
      updatePowerupAuras(0.016, g);
      // Inactive aura should be cleaned up
      expect(g.powerupAuras.length).toBe(0);
    });
  });
});
