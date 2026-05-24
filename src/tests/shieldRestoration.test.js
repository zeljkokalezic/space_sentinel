/**
 * Unit tests for shield restoration celebration system.
 *
 * When the player's shield fully regenerates from depleted state,
 * a satisfying celebration plays: blue ring particles, expanding shield ring,
 * "SHIELD UP" popup, screen flash, screen shake, hit stop, and chime sound.
 *
 * Tests cover: config, trigger, effect creation, weapons integration, and edge cases.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerShieldRestoration } from '../engine/combat';
import { updateWeapons } from '../engine/systems/weapons';
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
 * Config: GAME_CONFIG.shieldRestoration
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.shieldRestoration', () => {
  it('has popupLife value', () => {
    expect(GAME_CONFIG.shieldRestoration.popupLife).toBeGreaterThan(0);
  });

  it('has popupColor value', () => {
    expect(typeof GAME_CONFIG.shieldRestoration.popupColor).toBe('string');
  });

  it('has screenShakePreset value', () => {
    expect(GAME_CONFIG.shieldRestoration.screenShakePreset).toBeDefined();
  });

  it('has hitStopPreset value', () => {
    expect(GAME_CONFIG.shieldRestoration.hitStopPreset).toBeDefined();
  });

  it('has flashDuration value', () => {
    expect(GAME_CONFIG.shieldRestoration.flashDuration).toBeGreaterThan(0);
  });

  it('has flashAlpha value', () => {
    expect(GAME_CONFIG.shieldRestoration.flashAlpha).toBeGreaterThan(0);
  });

  it('has particleCount value', () => {
    expect(GAME_CONFIG.shieldRestoration.particleCount).toBeGreaterThan(0);
  });

  it('has particleColor value', () => {
    expect(GAME_CONFIG.shieldRestoration.particleColor).toBeDefined();
  });

  it('has ringMaxRadius value', () => {
    expect(GAME_CONFIG.shieldRestoration.ringMaxRadius).toBeGreaterThan(0);
  });

  it('has ringDuration value', () => {
    expect(GAME_CONFIG.shieldRestoration.ringDuration).toBeGreaterThan(0);
  });

  it('has ringColor value', () => {
    expect(GAME_CONFIG.shieldRestoration.ringColor).toBeDefined();
  });
});

/* ──────────────────────────────────────────────
 * triggerShieldRestoration (from combat.js)
 * ────────────────────────────────────────────── */
describe('triggerShieldRestoration', () => {
  let g;

  beforeEach(() => {
    soundCalls = [];
    g = createTestState({
      effects: [],
      particles: [],
      screenShake: { active: false, intensity: 0 },
      hitStop: { active: false, remaining: 0 },
      screenFlash: { active: false, remaining: 0, color: '#ffffff' },
    });
  });

  describe('effect creation', () => {
    it('creates a "shield_up" popup effect', () => {
      triggerShieldRestoration(g);

      const popup = g.effects.find(e => e.type === 'shield_up');
      expect(popup).toBeDefined();
      expect(popup.text).toBe('SHIELD UP');
      expect(popup.x).toBe(g.player.x);
      expect(popup.y).toBe(g.player.y - 40);
      expect(popup.life).toBe(GAME_CONFIG.shieldRestoration.popupLife);
      expect(popup.color).toBe(GAME_CONFIG.shieldRestoration.popupColor);
    });

    it('creates a "shield_ring" expanding ring effect', () => {
      triggerShieldRestoration(g);

      const ring = g.effects.find(e => e.type === 'shield_ring');
      expect(ring).toBeDefined();
      expect(ring.x).toBe(g.player.x);
      expect(ring.y).toBe(g.player.y);
      expect(ring.radius).toBe(0);
      expect(ring.maxRadius).toBe(GAME_CONFIG.shieldRestoration.ringMaxRadius);
      expect(ring.life).toBe(GAME_CONFIG.shieldRestoration.ringDuration);
      expect(ring.color).toBe(GAME_CONFIG.shieldRestoration.ringColor);
    });

    it('creates particle burst around player', () => {
      triggerShieldRestoration(g);

      expect(g.particles.length).toBe(GAME_CONFIG.shieldRestoration.particleCount);
      for (const p of g.particles) {
        expect(p.x).toBe(g.player.x);
        expect(p.y).toBe(g.player.y);
        expect(p.color).toBe(GAME_CONFIG.shieldRestoration.particleColor);
        expect(p.active).toBe(true);
      }
    });

    it('particles have varying velocities in a ring pattern', () => {
      triggerShieldRestoration(g);

      const movingParticles = g.particles.filter(p => p.vx !== 0 || p.vy !== 0);
      expect(movingParticles.length).toBe(g.particles.length);
    });

    it('triggers screen shake', () => {
      triggerShieldRestoration(g);

      expect(g.screenShake.active).toBe(true);
      expect(g.screenShake.intensity).toBeGreaterThan(0);
    });

    it('triggers hit stop', () => {
      triggerShieldRestoration(g);

      expect(g.hitStop.active).toBe(true);
      expect(g.hitStop.remaining).toBeGreaterThan(0);
    });

    it('triggers screen flash with correct properties', () => {
      triggerShieldRestoration(g);

      expect(g.screenFlash.active).toBe(true);
      expect(g.screenFlash.remaining).toBe(GAME_CONFIG.shieldRestoration.flashDuration);
      expect(g.screenFlash.alpha).toBe(GAME_CONFIG.shieldRestoration.flashAlpha);
      expect(g.screenFlash.color).toBe(GAME_CONFIG.shieldRestoration.flashColor);
    });

    it('plays shield_restore sound', () => {
      triggerShieldRestoration(g);

      expect(soundCalls).toContain('shield_restore');
    });
  });

  describe('edge cases', () => {
    it('handles null game state gracefully', () => {
      expect(() => triggerShieldRestoration(null)).not.toThrow();
    });

    it('handles missing effects array', () => {
      delete g.effects;
      expect(() => triggerShieldRestoration(g)).not.toThrow();
    });

    it('handles missing particles array', () => {
      delete g.particles;
      expect(() => triggerShieldRestoration(g)).not.toThrow();
    });

    it('handles missing screenShake state', () => {
      delete g.screenShake;
      expect(() => triggerShieldRestoration(g)).not.toThrow();
    });

    it('handles missing hitStop state', () => {
      delete g.hitStop;
      expect(() => triggerShieldRestoration(g)).not.toThrow();
    });

    it('handles missing screenFlash state', () => {
      delete g.screenFlash;
      expect(() => triggerShieldRestoration(g)).not.toThrow();
      expect(g.screenFlash).toBeDefined(); // Should be created
    });
  });

  describe('config-driven behavior', () => {
    it('uses configured particle count', () => {
      triggerShieldRestoration(g);
      expect(g.particles.length).toBe(GAME_CONFIG.shieldRestoration.particleCount);
    });

    it('uses configured screen shake preset', () => {
      triggerShieldRestoration(g);
      const expectedIntensity = GAME_CONFIG.screenShake.presets[GAME_CONFIG.shieldRestoration.screenShakePreset];
      expect(g.screenShake.intensity).toBe(expectedIntensity);
    });

    it('uses configured hit stop preset', () => {
      triggerShieldRestoration(g);
      const expectedDuration = GAME_CONFIG.hitStop.presets[GAME_CONFIG.shieldRestoration.hitStopPreset];
      expect(g.hitStop.remaining).toBe(expectedDuration);
    });
  });
});

/* ──────────────────────────────────────────────
 * Integration: weapons.js shield restoration detection
 * ────────────────────────────────────────────── */
describe('updateWeapons — shield restoration detection', () => {
  let g;

  beforeEach(() => {
    soundCalls = [];
    g = createTestState({
      effects: [],
      particles: [],
      screenShake: { active: false, intensity: 0 },
      hitStop: { active: false, remaining: 0 },
      screenFlash: { active: false, remaining: 0, color: '#ffffff' },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      levels: { autocannon: 1, plasma: 0, missiles: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1, pointDefense: 0, autoAim: 0 },
      projectiles: [],
    });
  });

  it('does NOT trigger when shield was never depleted', () => {
    g.player.shield = 10;
    g.player.maxShield = 20;
    g.cooldowns.shieldRegen = 0;

    updateWeapons(0.016, g);

    const popup = g.effects.find(e => e.type === 'shield_up');
    expect(popup).toBeUndefined();
    expect(soundCalls).not.toContain('shield_restore');
  });

  it('triggers when shield fully restores from depleted state', () => {
    // Simulate: shield was depleted, now regenerating
    g.player.shield = 0;
    g.player.maxShield = 2; // Small max so one regen tick fills it
    g.cooldowns.shieldRegen = 0;

    updateWeapons(0.016, g);

    const popup = g.effects.find(e => e.type === 'shield_up');
    expect(popup).toBeDefined();
    expect(popup.text).toBe('SHIELD UP');
    expect(soundCalls).toContain('shield_restore');
  });

  it('does NOT trigger again if called multiple times (idempotent per restoration)', () => {
    g.player.shield = 0;
    g.player.maxShield = 2;
    g.cooldowns.shieldRegen = 0;

    updateWeapons(0.016, g); // First call — triggers restoration

    // Shield is now full, no more regen possible
    updateWeapons(0.016, g); // Second call — should not trigger again

    const popups = g.effects.filter(e => e.type === 'shield_up');
    expect(popups.length).toBe(1);
  });

  it('tracks _shieldWasDepleted flag correctly', () => {
    g.player.shield = 0;
    g.player.maxShield = 4; // Needs 2 regen ticks to fill
    g.cooldowns.shieldRegen = 0;

    updateWeapons(0.016, g); // First regen: shield goes 0 → 2

    expect(g.player._shieldWasDepleted).toBe(true);
    expect(g.player.shield).toBe(2);

    // No celebration yet — not fully restored
    const popup1 = g.effects.find(e => e.type === 'shield_up');
    expect(popup1).toBeUndefined();

    g.cooldowns.shieldRegen = 0;
    updateWeapons(0.016, g); // Second regen: shield goes 2 → 4 (full)

    const popup2 = g.effects.find(e => e.type === 'shield_up');
    expect(popup2).toBeDefined();
    expect(g.player._shieldWasDepleted).toBe(false);
  });

  it('does NOT trigger when shield was never at 0', () => {
    g.player.shield = 10;
    g.player.maxShield = 20;
    g.cooldowns.shieldRegen = 0;
    g.player._shieldWasDepleted = false;

    updateWeapons(0.016, g);

    const popup = g.effects.find(e => e.type === 'shield_up');
    expect(popup).toBeUndefined();
  });

  it('respects shieldRegen cooldown', () => {
    g.player.shield = 0;
    g.player.maxShield = 2;
    g.cooldowns.shieldRegen = 1.0; // Cooldown active

    updateWeapons(0.016, g);

    // Shield should not have regenerated (cooldown > 0)
    expect(g.player.shield).toBe(0);
    const popup = g.effects.find(e => e.type === 'shield_up');
    expect(popup).toBeUndefined();
  });
});
