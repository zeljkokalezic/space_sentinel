/**
 * waveAnnounce.test.js — Wave announcer system tests.
 *
 * Tests wave announcement state, timer countdown, deactivation,
 * spawn blocking, and first-wave skip behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createGameState } from '../engine/state';
import { updateWaveAnnounce } from '../engine/systems/waveAnnounce';
import { spawnEnemy } from '../engine/spawner';
import { SoundManager } from '../engine/audio';
import { GAME_CONFIG } from '../constants/gameConfig';

/** Track SoundManager.play calls for assertion */
const playCalls = [];

describe('waveAnnounce state defaults', () => {
  it('waveAnnounce defaults to inactive with wave 1 and timer 0', () => {
    const g = createGameState();
    expect(g.waveAnnounce.active).toBe(false);
    expect(g.waveAnnounce.wave).toBe(1);
    expect(g.waveAnnounce.timer).toBe(0);
  });

  it('waveCount and enemiesSpawnedThisWave start at 0', () => {
    const g = createGameState();
    expect(g.waveCount).toBe(0);
    expect(g.enemiesSpawnedThisWave).toBe(0);
  });
});

describe('updateWaveAnnounce', () => {
  beforeEach(() => {
    // Mock SoundManager.play to avoid Web Audio issues
    vi.spyOn(SoundManager, 'play').mockImplementation((name) => {
      playCalls.push(name);
    });
    playCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when announcement is not active', () => {
    const g = createGameState();
    g.waveAnnounce.active = false;
    g.waveAnnounce.timer = 2;
    updateWaveAnnounce(0.1, g);
    expect(g.waveAnnounce.timer).toBe(2);
    expect(g.waveAnnounce.active).toBe(false);
    expect(playCalls).toEqual([]);
  });

  it('does nothing when waveAnnounce state is undefined', () => {
    const g = createGameState();
    delete g.waveAnnounce;
    updateWaveAnnounce(0.1, g);
    expect(() => updateWaveAnnounce(0.1, g)).not.toThrow();
  });

  it('decrements timer by dt each call', () => {
    const g = createGameState();
    g.waveAnnounce.active = true;
    g.waveAnnounce.timer = 2;

    updateWaveAnnounce(0.5, g);
    expect(g.waveAnnounce.timer).toBe(1.5);

    updateWaveAnnounce(0.5, g);
    expect(g.waveAnnounce.timer).toBe(1);
  });

  it('deactivates when timer reaches <= 0', () => {
    const g = createGameState();
    g.waveAnnounce.active = true;
    g.waveAnnounce.timer = 0.5;

    updateWaveAnnounce(0.5, g);
    expect(g.waveAnnounce.active).toBe(false);
    expect(g.waveAnnounce.timer).toBe(0);
  });

  it('deactivates when timer goes negative (overshoot)', () => {
    const g = createGameState();
    g.waveAnnounce.active = true;
    g.waveAnnounce.timer = 0.3;

    updateWaveAnnounce(0.5, g);
    expect(g.waveAnnounce.active).toBe(false);
    expect(g.waveAnnounce.timer).toBe(0); // clamped to 0
  });
});

describe('countdown beeps', () => {
  beforeEach(() => {
    vi.spyOn(SoundManager, 'play').mockImplementation((name) => {
      playCalls.push(name);
    });
    playCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays countdown_beep on integer boundary crossings', () => {
    const g = createGameState();
    g.waveAnnounce.active = true;
    g.waveAnnounce.timer = 2.0;

    // Timer at exactly 2.0, stepping by 0.05 — ceil stays 2, no beep
    updateWaveAnnounce(0.05, g);
    expect(playCalls).not.toContain('countdown_beep');

    // Reset and test boundary: 1.05 -> 0.95 (ceil 2 -> ceil 1)
    playCalls.length = 0;
    g.waveAnnounce.timer = 1.05;
    updateWaveAnnounce(0.15, g);
    expect(playCalls).toContain('countdown_beep');
  });

  it('plays wave_start when announcement completes', () => {
    const g = createGameState();
    g.waveAnnounce.active = true;
    g.waveAnnounce.timer = 0.1;

    playCalls.length = 0;
    updateWaveAnnounce(0.1, g);
    expect(playCalls).toContain('wave_start');
    expect(g.waveAnnounce.active).toBe(false);
  });

  it('does not play countdown_beep when crossing from 1 to 0', () => {
    const g = createGameState();
    g.waveAnnounce.active = true;
    g.waveAnnounce.timer = 0.5;

    playCalls.length = 0;
    updateWaveAnnounce(0.6, g);
    // Should play wave_start but NOT countdown_beep (currInt <= 0)
    expect(playCalls).toContain('wave_start');
    expect(playCalls).not.toContain('countdown_beep');
  });
});

describe('spawnEnemy wave tracking', () => {
  beforeEach(() => {
    vi.spyOn(SoundManager, 'play').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('increments enemiesSpawnedThisWave on each spawn', () => {
    const g = createGameState();
    g.level = 1;
    g.totalTime = 5;
    g.enemiesSpawnedThisWave = 0;

    spawnEnemy(g);
    expect(g.enemiesSpawnedThisWave).toBeGreaterThan(0);
  });

  it('triggers announcement after reaching enemiesPerWave threshold', () => {
    const g = createGameState();
    g.level = 1;
    g.totalTime = 5;
    g.waveCount = 1; // Simulate that wave 1 already completed
    g.enemiesSpawnedThisWave = GAME_CONFIG.waveAnnouncer.enemiesPerWave - 1;

    spawnEnemy(g);

    // After spawning, should have reached threshold and triggered announcement
    expect(g.waveAnnounce.active).toBe(true);
    expect(g.waveAnnounce.wave).toBe(2);
    expect(g.waveAnnounce.timer).toBe(GAME_CONFIG.waveAnnouncer.announcementDuration);
  });

  it('skips announcement for first wave (waveCount === 1)', () => {
    const g = createGameState();
    g.level = 1;
    g.totalTime = 5;
    g.waveCount = 0;
    g.enemiesSpawnedThisWave = GAME_CONFIG.waveAnnouncer.enemiesPerWave - 1;

    spawnEnemy(g);

    // waveCount becomes 1, which means first wave — no announcement
    expect(g.waveCount).toBe(1);
    expect(g.waveAnnounce.active).toBe(false);
  });

  it('resets enemiesSpawnedThisWave after wave completes', () => {
    const g = createGameState();
    g.level = 1;
    g.totalTime = 5;
    g.waveCount = 1;
    g.enemiesSpawnedThisWave = GAME_CONFIG.waveAnnouncer.enemiesPerWave - 1;

    spawnEnemy(g);
    expect(g.enemiesSpawnedThisWave).toBe(0);
  });
});

describe('spawn blocking during announcement', () => {
  beforeEach(() => {
    vi.spyOn(SoundManager, 'play').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spawnEnemy does nothing when waveAnnounce is active', () => {
    const g = createGameState();
    g.level = 1;
    g.totalTime = 5;
    g.waveAnnounce.active = true;
    g.waveAnnounce.timer = 2;
    const enemyCountBefore = g.enemies.length;

    spawnEnemy(g);
    expect(g.enemies.length).toBe(enemyCountBefore);
  });

  it('spawnEnemy works normally without waveAnnounce state (backwards compat)', () => {
    const g = createGameState();
    g.level = 1;
    g.totalTime = 5;
    delete g.waveAnnounce;
    const enemyCountBefore = g.enemies.length;

    spawnEnemy(g);
    expect(g.enemies.length).toBeGreaterThan(enemyCountBefore);
  });
});
