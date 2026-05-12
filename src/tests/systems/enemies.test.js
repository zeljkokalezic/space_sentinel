/**
 * Unit tests for systems/enemies.js — updateEnemies(dt, g, currentDiffMult, completeMission, setGameState)
 *
 * Covers: enemy ram collision, shield_hit/player_hit sounds.
 *
 * Run:  npm run test:run -- src/tests/systems/enemies.test.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateEnemies } from '../../engine/systems/enemies';
import { createTestState, createTestEnemy } from '../helpers';

describe('enemy ram hit sounds', () => {
  let SoundManager;
  let updateEnemies;

  beforeEach(async () => {
    ({ SoundManager } = await import('../../engine/audio'));
    ({ updateEnemies } = await import('../../engine/systems/enemies'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays "shield_hit" when enemy rams player and shield absorbs damage', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    // Place enemy close enough to collide with player (player radius 38 + enemy radius 15 = 53)
    const enemy = createTestEnemy(40, 0);
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, shield: 20 },
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    expect(spy).toHaveBeenCalledWith('shield_hit');
  });

  it('plays "player_hit" when enemy rams player with no shield', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const enemy = createTestEnemy(40, 0);
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, shield: 0 },
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    expect(spy).toHaveBeenCalledWith('player_hit');
  });

  it('plays "shield_hit" even when shield only partially absorbs damage', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const enemy = createTestEnemy(40, 0);
    // Shield of 5 — heavy enough to absorb some, not all
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, shield: 5 },
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    expect(spy).toHaveBeenCalledWith('shield_hit');
  });

  it('does not play hit sound when enemy does not collide with player', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const enemy = createTestEnemy(1000, 1000);
    const g = createTestState({
      enemies: [enemy],
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not play sound for inactive enemies', () => {
    const spy = vi.spyOn(SoundManager, 'play');
    const enemy = createTestEnemy(40, 0);
    enemy.active = false;
    const g = createTestState({
      enemies: [enemy],
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    expect(spy).not.toHaveBeenCalled();
  });
});
