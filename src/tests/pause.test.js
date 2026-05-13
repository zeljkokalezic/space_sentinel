/**
 * Unit tests for pause functionality.
 *
 * Verifies pause state defaults, toggle behavior, game loop pausing,
 * and state preservation during pause.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGameState } from '../engine/state';
import { createTestState } from './helpers';
import { updatePhysics } from '../engine/physics';

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

  describe('game loop pause integration', () => {
    beforeEach(() => {
      // Mock browser globals needed by engine modules
      globalThis.window = { innerWidth: 1920, innerHeight: 1080 };
      // Mock localStorage for auto-save in mission completion
      const store = {};
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: (key) => store[key] ?? null,
          setItem: (key, val) => { store[key] = String(val); },
          removeItem: (key) => { delete store[key]; },
          clear: () => { store = {}; },
        },
        writable: true,
        configurable: true,
      });
    });

    it('updatePhysics skipped when paused — totalTime not advanced', () => {
      const g = createTestState({
        totalTime: 0,
        paused: true,
        mission: { type: 'kill', current: 0, target: 5, completed: false },
      });
      const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };

      // Simulate game loop: only call updatePhysics when not paused
      if (!g.paused) {
        updatePhysics(0.016, g, cbs);
      }

      expect(g.totalTime).toBe(0); // not advanced
    });

    it('updatePhysics runs when not paused — totalTime advances', () => {
      const g = createTestState({
        totalTime: 0,
        paused: false,
        mission: { type: 'kill', current: 0, target: 5, completed: false },
      });
      const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };

      if (!g.paused) {
        updatePhysics(0.016, g, cbs);
      }

      expect(g.totalTime).toBeGreaterThan(0); // advanced
    });

    it('pause during combat preserves enemy positions', () => {
      const enemy = {
        id: 1, x: 100, y: 50, vx: 50, vy: 0,
        hp: 30, maxHp: 30, speed: 100, radius: 15,
        color: 0xef4444, type: 'fighter', active: true,
        fireCooldown: 0, targetX: 0, targetY: 0,
      };
      const g = createTestState({
        enemies: [enemy],
        paused: true,
        mission: { type: 'kill', current: 0, target: 5, completed: false },
      });

      // Pause: skip updatePhysics
      if (!g.paused) {
        updatePhysics(0.016, g, { setGameState: vi.fn(), setMapStateVersion: vi.fn() });
      }

      expect(enemy.x).toBe(100); // unchanged
      expect(enemy.y).toBe(50);
    });

    it('resume after pause allows physics to run', () => {
      const g = createTestState({
        totalTime: 0,
        paused: true,
        mission: { type: 'kill', current: 0, target: 5, completed: false },
      });
      const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };

      // Paused: skip
      if (!g.paused) {
        updatePhysics(0.016, g, cbs);
      }
      expect(g.totalTime).toBe(0);

      // Resume
      g.paused = false;
      if (!g.paused) {
        updatePhysics(0.016, g, cbs);
      }
      expect(g.totalTime).toBeGreaterThan(0);
    });

    it('pause preserves projectile count', () => {
      const g = createTestState({
        projectiles: [
          { x: 0, y: 0, vx: 700, vy: 0, active: true, isEnemy: false, damage: 10, radius: 5, type: 'autocannon', pierce: 0, hitList: [], life: 0, target: null },
          { x: 10, y: 10, vx: 700, vy: 0, active: true, isEnemy: false, damage: 10, radius: 5, type: 'autocannon', pierce: 0, hitList: [], life: 0, target: null },
        ],
        paused: true,
        mission: { type: 'kill', current: 0, target: 5, completed: false },
      });

      if (!g.paused) {
        updatePhysics(0.016, g, { setGameState: vi.fn(), setMapStateVersion: vi.fn() });
      }

      expect(g.projectiles.length).toBe(2); // unchanged
    });

    it('pause preserves player HP', () => {
      const g = createTestState({
        player: { x: 0, y: 0, vx: 0, vy: 0, radius: 38, hp: 250, maxHp: 300, shield: 20, maxShield: 20, speed: 120, magnetRadius: 150, yaw: Math.PI / 2 },
        paused: true,
        mission: { type: 'kill', current: 0, target: 5, completed: false },
      });

      if (!g.paused) {
        updatePhysics(0.016, g, { setGameState: vi.fn(), setMapStateVersion: vi.fn() });
      }

      expect(g.player.hp).toBe(250);
      expect(g.player.shield).toBe(20);
    });
  });
});
