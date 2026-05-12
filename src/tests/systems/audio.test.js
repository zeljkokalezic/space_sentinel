/**
 * Unit tests for systems/audio.js — Per-frame audio event detection.
 *
 * Mocks SoundManager so we can verify which sounds are played in response
 * to game state transitions (enemy deaths, pickups, player hits, etc.).
 *
 * Run:  npm test -- --run src/tests/systems/audio.test.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mock SoundManager before importing the system                       */
/* ------------------------------------------------------------------ */

const mockPlay = vi.fn();
const mockStop = vi.fn();

vi.doMock('../../engine/audio', () => ({
  SoundManager: {
    play: mockPlay,
    stop: mockStop,
  },
}));

let updateAudio;

beforeEach(async () => {
  vi.clearAllMocks();
  // Fresh import per test
  const mod = await import('../../engine/systems/audio');
  updateAudio = mod.updateAudio;
});

/* ------------------------------------------------------------------ */
/*  Helper: build a minimal game state                                 */
/* ------------------------------------------------------------------ */

function buildState(overrides = {}) {
  return {
    player: {
      x: 0, y: 0,
      hp: 300, maxHp: 300,
      shield: 20, maxShield: 20,
      radius: 38,
    },
    enemies: [],
    pickups: [],
    audio: { muted: false, volume: 0.5 },
    mission: null,
    ...overrides,
  };
}

/* ──────────────────────────────────────────────
 * 1. Module exports
 * ────────────────────────────────────────────── */
describe('module exports', () => {
  it('exports updateAudio as a function', async () => {
    const mod = await import('../../engine/systems/audio');
    expect(typeof mod.updateAudio).toBe('function');
  });
});

/* ──────────────────────────────────────────────
 * 2. Muted — skip all audio when muted
 * ────────────────────────────────────────────── */
describe('muted', () => {
  it('does nothing when g.audio.muted is true', () => {
    const g = buildState();
    g.audio.muted = true;
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('does play sounds when muted is false', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
    });
    // First frame — should start engine + bg_drone
    updateAudio(0.016, g);
    expect(mockPlay).toHaveBeenCalledWith('engine');
    expect(mockPlay).toHaveBeenCalledWith('bg_drone');
  });
});

/* ──────────────────────────────────────────────
 * 3. Continuous sounds (engine, bg_drone) start once
 * ────────────────────────────────────────────── */
describe('continuous sounds', () => {
  it('starts engine and bg_drone when a mission is active', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
    });
    updateAudio(0.016, g);
    expect(mockPlay).toHaveBeenCalledWith('engine');
    expect(mockPlay).toHaveBeenCalledWith('bg_drone');
  });

  it('does not restart engine/bg_drone on subsequent frames', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('engine');
    expect(mockPlay).not.toHaveBeenCalledWith('bg_drone');
  });

  it('does not start engine/bg_drone when no mission', () => {
    const g = buildState({ mission: null });
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('engine');
    expect(mockPlay).not.toHaveBeenCalledWith('bg_drone');
  });

  it('does not start engine/bg_drone when mission is completed', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 5, completed: true },
    });
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('engine');
    expect(mockPlay).not.toHaveBeenCalledWith('bg_drone');
  });
});

/* ──────────────────────────────────────────────
 * 4. Explosion — detects newly dead enemies
 * ────────────────────────────────────────────── */
describe('explosion detection', () => {
  it('plays explosion when an enemy transitions from active to dead', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      enemies: [
        { id: 1, active: true, hp: 10 },
        { id: 2, active: true, hp: 5 },
      ],
    });
    // Seed prev state
    updateAudio(0.016, g);
    vi.clearAllMocks();

    // Kill enemy 1
    g.enemies[0].active = false;
    g.enemies[0].hp = 0;
    updateAudio(0.016, g);
    expect(mockPlay).toHaveBeenCalledWith('explosion');
  });

  it('plays explosion for each enemy that died this frame', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      enemies: [
        { id: 1, active: true, hp: 10 },
        { id: 2, active: true, hp: 5 },
        { id: 3, active: true, hp: 8 },
      ],
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    // Kill enemies 1 and 3
    g.enemies[0].active = false;
    g.enemies[0].hp = 0;
    g.enemies[2].active = false;
    g.enemies[2].hp = 0;
    updateAudio(0.016, g);
    expect(mockPlay.mock.calls.filter(c => c[0] === 'explosion').length).toBe(2);
  });

  it('does not play explosion for enemies already dead in prev frame', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      enemies: [
        { id: 1, active: false, hp: 0 },
        { id: 2, active: true, hp: 5 },
      ],
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    // Enemy 1 still dead, enemy 2 still alive
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('explosion');
  });

  it('does not play explosion when enemy is still alive', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      enemies: [
        { id: 1, active: true, hp: 10 },
      ],
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('explosion');
  });
});

/* ──────────────────────────────────────────────
 * 5. Pickup — detects newly collected pickups
 * ────────────────────────────────────────────── */
describe('pickup detection', () => {
  it('plays pickup sound when a pickup transitions from active to collected', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      pickups: [
        { id: 1, active: true, value: 1 },
        { id: 2, active: true, value: 2 },
      ],
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    // Collect pickup 1
    g.pickups[0].active = false;
    updateAudio(0.016, g);
    expect(mockPlay).toHaveBeenCalledWith('pickup');
  });

  it('plays pickup for each pickup collected this frame', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      pickups: [
        { id: 1, active: true, value: 1 },
        { id: 2, active: true, value: 2 },
        { id: 3, active: true, value: 3 },
      ],
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    // Collect pickups 1 and 3
    g.pickups[0].active = false;
    g.pickups[2].active = false;
    updateAudio(0.016, g);
    expect(mockPlay.mock.calls.filter(c => c[0] === 'pickup').length).toBe(2);
  });

  it('does not play pickup for already-collected pickups', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      pickups: [
        { id: 1, active: false, value: 1 },
        { id: 2, active: true, value: 2 },
      ],
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    // Pickup 1 still collected, pickup 2 still active
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('pickup');
  });
});

/* ──────────────────────────────────────────────
 * 6. Player hit detection (hp or shield change)
 * ────────────────────────────────────────────── */
describe('player hit detection', () => {
  it('plays shield_hit when shield decreases', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      player: { ...buildState().player, hp: 300, shield: 20 },
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    g.player.shield = 10;
    updateAudio(0.016, g);
    expect(mockPlay).toHaveBeenCalledWith('shield_hit');
  });

  it('plays player_hit when hp decreases (and shield unchanged)', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      player: { ...buildState().player, hp: 300, shield: 0 },
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    g.player.hp = 250;
    updateAudio(0.016, g);
    expect(mockPlay).toHaveBeenCalledWith('player_hit');
  });

  it('plays shield_hit over player_hit when both shield and hp decrease', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      player: { ...buildState().player, hp: 300, shield: 20 },
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    g.player.shield = 15;
    g.player.hp = 280;
    updateAudio(0.016, g);
    expect(mockPlay).toHaveBeenCalledWith('shield_hit');
    expect(mockPlay).not.toHaveBeenCalledWith('player_hit');
  });

  it('does not play player_hit when hp/shield unchanged', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      player: { ...buildState().player, hp: 300, shield: 20 },
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    // No change
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('player_hit');
    expect(mockPlay).not.toHaveBeenCalledWith('shield_hit');
  });

  it('does not play player_hit when hp increases (healing)', () => {
    const g = buildState({
      mission: { type: 'kill', target: 5, current: 0 },
      player: { ...buildState().player, hp: 200, shield: 0 },
    });
    updateAudio(0.016, g);
    vi.clearAllMocks();

    g.player.hp = 250;
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('player_hit');
  });
});

/* ──────────────────────────────────────────────
 * 7. _prev state tracking
 * ────────────────────────────────────────────── */
describe('_prev state tracking', () => {
  it('initializes g.audio._prev on first call', () => {
    const g = buildState({
      enemies: [{ id: 1, active: true, hp: 10 }],
      pickups: [{ id: 1, active: true, value: 1 }],
      player: { ...buildState().player, hp: 300, shield: 20 },
      mission: { type: 'kill', target: 5, current: 0 },
    });
    expect(g.audio._prev).toBeUndefined();
    updateAudio(0.016, g);
    expect(g.audio._prev).toBeDefined();
  });

  it('stores previous frame enemy active states', () => {
    const g = buildState({
      enemies: [{ id: 1, active: true, hp: 10 }],
      mission: { type: 'kill', target: 5, current: 0 },
    });
    updateAudio(0.016, g);
    expect(g.audio._prev.enemyStates.get(1)).toBe(true);
  });

  it('stores previous frame pickup active states', () => {
    const g = buildState({
      pickups: [{ id: 1, active: true, value: 1 }],
      mission: { type: 'kill', target: 5, current: 0 },
    });
    updateAudio(0.016, g);
    expect(g.audio._prev.pickupStates.get(1)).toBe(true);
  });

  it('stores previous frame player hp and shield', () => {
    const g = buildState({
      player: { ...buildState().player, hp: 300, shield: 20 },
      mission: { type: 'kill', target: 5, current: 0 },
    });
    updateAudio(0.016, g);
    expect(g.audio._prev.playerHp).toBe(300);
    expect(g.audio._prev.playerShield).toBe(20);
  });

  it('persists _prev across frames', () => {
    const g = buildState({
      enemies: [{ id: 1, active: true, hp: 10 }],
      player: { ...buildState().player, hp: 300, shield: 20 },
      mission: { type: 'kill', target: 5, current: 0 },
    });
    updateAudio(0.016, g);
    const prevRef = g.audio._prev;

    // Change state
    g.enemies[0].active = false;
    g.player.hp = 250;

    updateAudio(0.016, g);
    // _prev is updated to current frame state after each call
    expect(g.audio._prev.playerHp).toBe(250);
    expect(g.audio._prev.playerShield).toBe(20);
    expect(g.audio._prev.enemyStates.get(1)).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 8. Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  it('handles empty enemies array', () => {
    const g = buildState({ enemies: [], mission: null });
    expect(() => updateAudio(0.016, g)).not.toThrow();
  });

  it('handles empty pickups array', () => {
    const g = buildState({ pickups: [], mission: null });
    expect(() => updateAudio(0.016, g)).not.toThrow();
  });

  it('handles missing _prev gracefully (first frame)', () => {
    const g = buildState({
      enemies: [{ id: 1, active: false, hp: 0 }],
      mission: null,
    });
    // First call, no _prev — should not detect explosions
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('explosion');
  });

  it('handles missing _prev for player hit detection', () => {
    const g = buildState({
      player: { ...buildState().player, hp: 200, shield: 0 },
      mission: null,
    });
    updateAudio(0.016, g);
    expect(mockPlay).not.toHaveBeenCalledWith('player_hit');
  });

  it('handles missing audio object gracefully', () => {
    const g = buildState({ audio: undefined });
    expect(() => updateAudio(0.016, g)).not.toThrow();
  });

  it('handles missing mission gracefully', () => {
    const g = buildState({ mission: undefined });
    expect(() => updateAudio(0.016, g)).not.toThrow();
  });
});
