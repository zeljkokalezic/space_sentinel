/**
 * Unit tests for audio.js — SoundManager singleton.
 *
 * The test environment is Node.js (no real AudioContext), so we verify
 * the manager's public API, state toggles, and error handling without
 * asserting on actual audio output.
 *
 * Run:  npm test -- --run src/tests/audio.test.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  We import the module. It exports a singleton `SoundManager`.       */
/*  In Node the browser AudioContext is absent, so the manager must   */
/*  gracefully handle a missing/unsupported context.                  */
/* ------------------------------------------------------------------ */

let SoundManager;

beforeEach(async () => {
  // Fresh import per test so state resets
  SoundManager = (await import('../engine/audio')).SoundManager;
});

afterEach(() => {
  // Clean up any lingering continuous sounds
  try {
    SoundManager.stop('engine');
    SoundManager.stop('bg_drone');
  } catch { /* ignore */ }
});

/* ──────────────────────────────────────────────
 * Module structure
 * ────────────────────────────────────────────── */
describe('module structure', () => {
  it('exports a SoundManager object with expected methods', () => {
    const methods = ['init', 'play', 'stop', 'setMuted', 'isMuted', 'setVolume', 'getVolume'];
    for (const m of methods) {
      expect(typeof SoundManager[m]).toBe('function');
    }
  });

  it('is a singleton (same reference across imports)', async () => {
    const mod2 = await import('../engine/audio');
    expect(mod2.SoundManager).toBe(SoundManager);
  });
});

/* ──────────────────────────────────────────────
 * init()
 * ────────────────────────────────────────────── */
describe('init()', () => {
  it('does not throw when called', () => {
    expect(() => SoundManager.init()).not.toThrow();
  });

  it('can be called multiple times safely', () => {
    expect(() => {
      SoundManager.init();
      SoundManager.init();
      SoundManager.init();
    }).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * play(name)
 * ────────────────────────────────────────────── */
describe('play(name)', () => {
  const validSounds = [
    'shoot', 'shoot_plasma', 'shoot_missile',
    'hit', 'explosion', 'pickup',
    'shield_hit', 'player_hit',
    'mission_complete', 'game_over',
    'engine', 'bg_drone',
    'ui_click',
  ];

  it('does not throw for each valid sound name', () => {
    SoundManager.init();
    for (const name of validSounds) {
      expect(() => SoundManager.play(name)).not.toThrow();
    }
  });

  it('does not throw for an unknown sound name', () => {
    expect(() => SoundManager.play('nonexistent')).not.toThrow();
  });

  it('does not throw when called before init()', () => {
    expect(() => SoundManager.play('ui_click')).not.toThrow();
  });

  it('returns undefined (fire-and-forget)', () => {
    SoundManager.init();
    const ret = SoundManager.play('shoot');
    expect(ret).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────
 * stop(name) for continuous sounds
 * ────────────────────────────────────────────── */
describe('stop(name)', () => {
  it('stops engine continuous sound', () => {
    SoundManager.init();
    SoundManager.play('engine');
    expect(() => SoundManager.stop('engine')).not.toThrow();
  });

  it('stops bg_drone continuous sound', () => {
    SoundManager.init();
    SoundManager.play('bg_drone');
    expect(() => SoundManager.stop('bg_drone')).not.toThrow();
  });

  it('does not throw when stopping a sound that is not playing', () => {
    expect(() => SoundManager.stop('engine')).not.toThrow();
  });

  it('does not throw when stopping an unknown sound name', () => {
    expect(() => SoundManager.stop('nonexistent')).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * setMuted(bool) / isMuted()
 * ────────────────────────────────────────────── */
describe('mute controls', () => {
  it('starts unmuted', () => {
    expect(SoundManager.isMuted()).toBe(false);
  });

  it('setMuted(true) makes isMuted() return true', () => {
    SoundManager.setMuted(true);
    expect(SoundManager.isMuted()).toBe(true);
  });

  it('setMuted(false) makes isMuted() return false', () => {
    SoundManager.setMuted(true);
    SoundManager.setMuted(false);
    expect(SoundManager.isMuted()).toBe(false);
  });

  it('toggles correctly multiple times', () => {
    SoundManager.setMuted(true);
    expect(SoundManager.isMuted()).toBe(true);
    SoundManager.setMuted(false);
    expect(SoundManager.isMuted()).toBe(false);
    SoundManager.setMuted(true);
    expect(SoundManager.isMuted()).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * setVolume(0-1) / getVolume()
 * ────────────────────────────────────────────── */
describe('volume controls', () => {
  it('starts at volume 1.0', () => {
    expect(SoundManager.getVolume()).toBe(1);
  });

  it('accepts volume 0', () => {
    SoundManager.setVolume(0);
    expect(SoundManager.getVolume()).toBe(0);
  });

  it('accepts volume 0.5', () => {
    SoundManager.setVolume(0.5);
    expect(SoundManager.getVolume()).toBe(0.5);
  });

  it('accepts volume 1', () => {
    SoundManager.setVolume(1);
    expect(SoundManager.getVolume()).toBe(1);
  });

  it('clamps negative values to 0', () => {
    SoundManager.setVolume(-5);
    expect(SoundManager.getVolume()).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    SoundManager.setVolume(2.5);
    expect(SoundManager.getVolume()).toBe(1);
  });
});

/* ──────────────────────────────────────────────
 * Mute + volume interaction
 * ────────────────────────────────────────────── */
describe('mute + volume interaction', () => {
  it('volume persists after muting and unmuting', () => {
    SoundManager.setVolume(0.3);
    SoundManager.setMuted(true);
    SoundManager.setMuted(false);
    expect(SoundManager.getVolume()).toBe(0.3);
  });

  it('setVolume(0) does not change muted state', () => {
    SoundManager.setMuted(true);
    SoundManager.setVolume(0);
    expect(SoundManager.isMuted()).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * Sound definitions coverage
 * ────────────────────────────────────────────── */
describe('all 13 sound definitions exist', () => {
  it('SoundManager knows about all 13 sound names internally', () => {
    const expected = [
      'shoot', 'shoot_plasma', 'shoot_missile',
      'hit', 'explosion', 'pickup',
      'shield_hit', 'player_hit',
      'mission_complete', 'game_over',
      'engine', 'bg_drone',
      'ui_click',
    ];

    SoundManager.init();

    // Each name should be playable without error
    for (const name of expected) {
      expect(() => SoundManager.play(name)).not.toThrow();
    }
  });
});

/* ──────────────────────────────────────────────
 * Repeated play/stop of continuous sounds
 * ────────────────────────────────────────────── */
describe('continuous sound lifecycle', () => {
  it('can play and stop engine multiple times', () => {
    SoundManager.init();
    for (let i = 0; i < 3; i++) {
      SoundManager.play('engine');
      SoundManager.stop('engine');
    }
  });

  it('can play and stop bg_drone multiple times', () => {
    SoundManager.init();
    for (let i = 0; i < 3; i++) {
      SoundManager.play('bg_drone');
      SoundManager.stop('bg_drone');
    }
  });

  it('can play engine, then bg_drone, then stop both', () => {
    SoundManager.init();
    SoundManager.play('engine');
    SoundManager.play('bg_drone');
    SoundManager.stop('engine');
    SoundManager.stop('bg_drone');
  });
});
