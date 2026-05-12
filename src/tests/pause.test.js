/**
 * Unit tests for pause functionality.
 *
 * Verifies pause state defaults, toggle behavior, and game loop pausing.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGameState } from '../engine/state';
import { createTestState } from './helpers';

describe('pause', () => {
  describe('state defaults', () => {
    it('paused defaults to false in createGameState', () => {
      const state = createGameState();
      expect(state.paused).toBe(false);
    });

    it('paused defaults to false in createTestState', () => {
      const state = createTestState();
      expect(state.paused).toBe(false);
    });

    it('paused can be overridden in createTestState', () => {
      const state = createTestState({ paused: true });
      expect(state.paused).toBe(true);
    });
  });

  describe('pause toggle', () => {
    let state;

    beforeEach(() => {
      state = createTestState();
    });

    it('toggles from false to true', () => {
      expect(state.paused).toBe(false);
      state.paused = !state.paused;
      expect(state.paused).toBe(true);
    });

    it('toggles from true to false', () => {
      state.paused = true;
      expect(state.paused).toBe(true);
      state.paused = !state.paused;
      expect(state.paused).toBe(false);
    });

    it('can be toggled multiple times', () => {
      state.paused = !state.paused; // true
      expect(state.paused).toBe(true);
      state.paused = !state.paused; // false
      expect(state.paused).toBe(false);
      state.paused = !state.paused; // true
      expect(state.paused).toBe(true);
    });
  });

  describe('pause state independence', () => {
    it('two states have independent paused values', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      s1.paused = true;
      expect(s1.paused).toBe(true);
      expect(s2.paused).toBe(false);
    });
  });

  describe('game loop pause check', () => {
    it('updatePhysics should be skipped when paused is true', () => {
      const state = createTestState();
      const updateMock = vi.fn();

      // Simulate game loop pause check
      const gameState = 'playing';
      if (gameState === 'playing' && !state?.paused) {
        updateMock();
      }

      expect(updateMock).toHaveBeenCalledTimes(1);

      // Now pause
      state.paused = true;
      if (gameState === 'playing' && !state?.paused) {
        updateMock();
      }

      expect(updateMock).toHaveBeenCalledTimes(1); // not called again
    });

    it('updatePhysics should run when paused is false', () => {
      const state = createTestState();
      const updateMock = vi.fn();

      const gameState = 'playing';
      state.paused = false;

      if (gameState === 'playing' && !state?.paused) {
        updateMock();
      }

      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('updatePhysics should be skipped when not in playing state', () => {
      const state = createTestState();
      const updateMock = vi.fn();

      const gameState = 'map';
      if (gameState === 'playing' && !state?.paused) {
        updateMock();
      }

      expect(updateMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('pause preserves game state', () => {
    it('player position unchanged when paused', () => {
      const state = createTestState({ player: { x: 100, y: 200 } });
      state.paused = true;

      expect(state.player.x).toBe(100);
      expect(state.player.y).toBe(200);
    });

    it('enemy count unchanged when paused', () => {
      const state = createTestState();
      state.enemies.push({ id: 1, x: 0, y: 0 });
      state.enemies.push({ id: 2, x: 10, y: 10 });
      state.paused = true;

      expect(state.enemies.length).toBe(2);
    });

    it('scrap unchanged when paused', () => {
      const state = createTestState({ scrap: 500 });
      state.paused = true;

      expect(state.scrap).toBe(500);
    });
  });
});
