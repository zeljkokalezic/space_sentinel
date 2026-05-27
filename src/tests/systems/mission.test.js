/**
 * Unit tests for systems/mission.js
 *
 * Covers:
 * - checkMissionProgress (survive missions, early returns)
 * - createCompleteMission (rewards, effects, map updates, victory flag, level increment)
 * - updateTransition (countdown, map/victory routing, state cleanup)
 * - SoundManager.play('mission_complete') on mission completion
 * - triggerGameOver / SoundManager.play('game_over') on player death
 *
 * Run:  npm run test:run -- src/tests/systems/mission.test.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ──────────────────────────────────────────────
 * Mock SoundManager so we can assert .play() calls
 * vi.hoisted ensures mockPlay exists before vi.mock hoisting
 * ────────────────────────────────────────────── */
const mockPlay = vi.hoisted(() => vi.fn());
vi.mock('../../engine/audio', () => ({
  SoundManager: { play: mockPlay },
}));
import {
  checkMissionProgress,
  createCompleteMission,
  updateTransition,
  triggerGameOver,
} from '../../engine/systems/mission';
import { createTestState, createTestEnemy } from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

/* ──────────────────────────────────────────────
 * Mock window for node environment
 * ────────────────────────────────────────────── */
beforeEach(() => {
  Object.defineProperty(global, 'window', {
    value: { innerWidth: 1280, innerHeight: 720 },
    writable: true,
    configurable: true,
  });
  // Mock localStorage for auto-save in mission completion
     const store = {};
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: (key) => store[key] ?? null,
          setItem: (key, val) => { store[key] = String(val); },
          removeItem: (key) => { delete store[key]; },
          clear: () => { for (const k of Object.keys(store)) delete store[k]; },
        },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  mockPlay.mockClear();
});

/* ──────────────────────────────────────────────
 * 1. checkMissionProgress — survive missions
 * ────────────────────────────────────────────── */
describe('checkMissionProgress', () => {
  it('does nothing when mission is null', () => {
    const g = createTestState();
    const complete = vi.fn();
    checkMissionProgress(1, g, complete);
    expect(complete).not.toHaveBeenCalled();
  });

  it('does nothing when mission is already completed', () => {
    const g = createTestState({
      mission: { type: 'survive', current: 5, target: 10, completed: true },
    });
    const complete = vi.fn();
    checkMissionProgress(1, g, complete);
    expect(complete).not.toHaveBeenCalled();
  });

  it('does nothing for non-survive mission types', () => {
    const g = createTestState({
      mission: { type: 'kill', current: 3, target: 5, completed: false },
    });
    const complete = vi.fn();
    checkMissionProgress(1, g, complete);
    expect(complete).not.toHaveBeenCalled();
    expect(g.mission.current).toBe(3);
  });

  it('increments current time for survive missions', () => {
    const g = createTestState({
      mission: { type: 'survive', current: 0, target: 10, completed: false },
    });
    const complete = vi.fn();
    checkMissionProgress(2.5, g, complete);
    expect(g.mission.current).toBe(2.5);
    expect(complete).not.toHaveBeenCalled();
  });

  it('triggers completeMission when current reaches target exactly', () => {
    const g = createTestState({
      mission: { type: 'survive', current: 5, target: 10, completed: false },
    });
    const complete = vi.fn();
    checkMissionProgress(5, g, complete);
    expect(g.mission.current).toBe(10);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('triggers completeMission when current exceeds target', () => {
    const g = createTestState({
      mission: { type: 'survive', current: 9, target: 10, completed: false },
    });
    const complete = vi.fn();
    checkMissionProgress(5, g, complete);
    expect(g.mission.current).toBe(14);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('does not trigger if current is still below target', () => {
    const g = createTestState({
      mission: { type: 'survive', current: 3, target: 10, completed: false },
    });
    const complete = vi.fn();
    checkMissionProgress(2, g, complete);
    expect(g.mission.current).toBe(5);
    expect(complete).not.toHaveBeenCalled();
  });

  it('accumulates time across multiple calls', () => {
    const g = createTestState({
      mission: { type: 'survive', current: 0, target: 10, completed: false },
    });
    const complete = vi.fn();

    checkMissionProgress(3, g, complete);
    expect(g.mission.current).toBe(3);
    expect(complete).not.toHaveBeenCalled();

    checkMissionProgress(4, g, complete);
    expect(g.mission.current).toBe(7);
    expect(complete).not.toHaveBeenCalled();

    checkMissionProgress(4, g, complete);
    expect(g.mission.current).toBe(11);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('does not call completeMission more than once in a single invocation', () => {
    const g = createTestState({
      mission: { type: 'survive', current: 9, target: 10, completed: false },
    });
    const complete = vi.fn();
    // dt large enough to overshoot
    checkMissionProgress(100, g, complete);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

/* ──────────────────────────────────────────────
 * 2. createCompleteMission — rewards and state
 * ────────────────────────────────────────────── */
describe('createCompleteMission', () => {
  it('awards mission reward as scrap', () => {
    const g = createTestState({
      scrap: 100,
      mission: { type: 'kill', current: 5, target: 5, reward: 50, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(g.scrap).toBe(150);
  });

  it('adds reward to totalScrapEarned', () => {
    const g = createTestState({
      totalScrapEarned: 500,
      mission: { type: 'kill', current: 5, target: 5, reward: 75, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(g.totalScrapEarned).toBe(575);
  });

  it('marks mission as completed', () => {
    const g = createTestState({
      mission: { type: 'kill', current: 5, target: 5, reward: 30, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(g.mission.completed).toBe(true);
  });

  it('pushes a mission_complete effect into g.effects', () => {
    const g = createTestState({
      mission: { type: 'kill', current: 5, target: 5, reward: 40, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    const effect = g.effects.find(e => e.type === 'mission_complete');
    expect(effect).toBeDefined();
    expect(effect.type).toBe('mission_complete');
    expect(effect.text).toBe('AREA CLEARED! +40 SCRAP');
    expect(effect.life).toBe(GAME_CONFIG.transition.duration);
  });

  it('places effect at center X and max(100, innerHeight/4) Y', () => {
    const g = createTestState({
      mission: { type: 'kill', current: 5, target: 5, reward: 10, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    const effect = g.effects.find(e => e.type === 'mission_complete');
    expect(effect.x).toBe(640); // 1280 / 2
    expect(effect.y).toBe(180); // 720 / 4 = 180, max(100, 180) = 180
  });

  it('uses 100 as minimum Y for effect position', () => {
    // Override window with small height
    Object.defineProperty(global, 'window', {
      value: { innerWidth: 800, innerHeight: 200 },
      writable: true,
      configurable: true,
    });
    const g = createTestState({
      mission: { type: 'kill', current: 5, target: 5, reward: 10, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    // innerHeight/4 = 50, max(100, 50) = 100
    const effect = g.effects.find(e => e.type === 'mission_complete');
    expect(effect.y).toBe(100);
  });

  it('sets transitionTimer to config duration', () => {
    const g = createTestState({
      mission: { type: 'kill', current: 5, target: 5, reward: 10, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(g.transitionTimer).toBe(GAME_CONFIG.transition.duration);
  });

  it('increments level', () => {
    const g = createTestState({
      level: 3,
      mission: { type: 'kill', current: 5, target: 5, reward: 10, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(g.level).toBe(4);
  });

  it('sets isVictory for kill_boss mission type', () => {
    const g = createTestState({
      isVictory: false,
      mission: { type: 'kill_boss', current: 1, target: 1, reward: 200, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(g.isVictory).toBe(true);
  });

  it('does not set isVictory for regular kill mission type', () => {
    const g = createTestState({
      isVictory: false,
      mission: { type: 'kill', current: 5, target: 5, reward: 30, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(g.isVictory).toBe(false);
  });

  it('does not set isVictory for survive mission type', () => {
    const g = createTestState({
      isVictory: false,
      mission: { type: 'survive', current: 10, target: 10, reward: 30, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(g.isVictory).toBe(false);
  });

  it('is idempotent — second call does nothing', () => {
    const g = createTestState({
      scrap: 100,
      totalScrapEarned: 0,
      level: 1,
      mission: { type: 'kill', current: 5, target: 5, reward: 50, completed: false },
    });
    const complete = createCompleteMission(g);

    complete();
    const scrapAfterFirst = g.scrap;
    const levelAfterFirst = g.level;

    complete();
    expect(g.scrap).toBe(scrapAfterFirst);
    expect(g.level).toBe(levelAfterFirst);
    expect(g.effects.filter(e => e.type === 'mission_complete')).toHaveLength(1);
  });

  /* ── Map node updates ── */
  describe('map node updates', () => {
    it('marks current map node as cleared', () => {
      const g = createTestState({
        level: 2,
        map: {
          currentNodeId: 'node_A',
          nodes: [
            { id: 'node_A', status: 'active' },
            { id: 'node_B', status: 'locked' },
          ],
          edges: [{ from: 'node_A', to: 'node_B' }],
        },
        mission: { type: 'kill', current: 5, target: 5, reward: 20, completed: false },
      });
      const complete = createCompleteMission(g);
      complete();
      expect(g.map.nodes[0].status).toBe('cleared');
    });

    it('marks reachable next nodes as available', () => {
      const g = createTestState({
        level: 2,
        map: {
          currentNodeId: 'node_A',
          nodes: [
            { id: 'node_A', status: 'active' },
            { id: 'node_B', status: 'locked' },
            { id: 'node_C', status: 'locked' },
          ],
          edges: [
            { from: 'node_A', to: 'node_B' },
            { from: 'node_A', to: 'node_C' },
          ],
        },
        mission: { type: 'kill', current: 5, target: 5, reward: 20, completed: false },
      });
      const complete = createCompleteMission(g);
      complete();
      expect(g.map.nodes[1].status).toBe('available');
      expect(g.map.nodes[2].status).toBe('available');
    });

    it('does not modify nodes when currentNodeId is absent', () => {
      const g = createTestState({
        map: {
          nodes: [{ id: 'node_A', status: 'active' }],
          edges: [],
        },
        mission: { type: 'kill', current: 5, target: 5, reward: 20, completed: false },
      });
      const complete = createCompleteMission(g);
      complete();
      expect(g.map.nodes[0].status).toBe('active');
    });

    it('does not modify nodes when currentNodeId does not match any node', () => {
      const g = createTestState({
        map: {
          currentNodeId: 'node_X',
          nodes: [{ id: 'node_A', status: 'active' }],
          edges: [],
        },
        mission: { type: 'kill', current: 5, target: 5, reward: 20, completed: false },
      });
      const complete = createCompleteMission(g);
      complete();
      expect(g.map.nodes[0].status).toBe('active');
    });

    it('does not crash when edge target node does not exist', () => {
      const g = createTestState({
        map: {
          currentNodeId: 'node_A',
          nodes: [{ id: 'node_A', status: 'active' }],
          edges: [{ from: 'node_A', to: 'node_GHOST' }],
        },
        mission: { type: 'kill', current: 5, target: 5, reward: 20, completed: false },
      });
      const complete = createCompleteMission(g);
      complete();
      expect(g.map.nodes[0].status).toBe('cleared');
    });
  });
});

/* ──────────────────────────────────────────────
 * 3. updateTransition — timer countdown and routing
 * ────────────────────────────────────────────── */
describe('updateTransition', () => {
  it('returns false when transitionTimer is undefined', () => {
    const g = createTestState();
    const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };
    const result = updateTransition(0.1, g, cbs);
    expect(result).toBe(false);
  });

  it('returns true when transitionTimer is set', () => {
    const g = createTestState({ transitionTimer: 3 });
    const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };
    const result = updateTransition(0.1, g, cbs);
    expect(result).toBe(true);
  });

  it('decrements transitionTimer by dt', () => {
    const g = createTestState({ transitionTimer: 3 });
    const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };
    updateTransition(0.5, g, cbs);
    expect(g.transitionTimer).toBe(2.5);
  });

  it('does not trigger state change while timer > 0', () => {
    const g = createTestState({ transitionTimer: 3 });
    const setGameState = vi.fn();
    const setMapStateVersion = vi.fn();
    updateTransition(1, g, { setGameState, setMapStateVersion });
    expect(setGameState).not.toHaveBeenCalled();
    expect(setMapStateVersion).not.toHaveBeenCalled();
    expect(g.transitionTimer).toBe(2);
  });

  it('switches to map state when timer reaches zero (non-victory)', () => {
    const g = createTestState({ transitionTimer: 1 });
    const setGameState = vi.fn();
    const setMapStateVersion = vi.fn();
    updateTransition(1, g, { setGameState, setMapStateVersion });
    expect(setGameState).toHaveBeenCalledWith('map');
    expect(g.transitionTimer).toBeUndefined();
  });

  it('switches to victory state when timer reaches zero and isVictory is true', () => {
    const g = createTestState({ transitionTimer: 1, isVictory: true });
    const setGameState = vi.fn();
    const setMapStateVersion = vi.fn();
    updateTransition(1, g, { setGameState, setMapStateVersion });
    expect(setGameState).toHaveBeenCalledWith('victory');
    expect(setMapStateVersion).not.toHaveBeenCalled();
    expect(g.transitionTimer).toBeUndefined();
  });

  it('calls setMapStateVersion on map transition', () => {
    const g = createTestState({ transitionTimer: 1 });
    const setGameState = vi.fn();
    const setMapStateVersion = vi.fn((_fn) => {
      // Simulate the functional updater pattern
    });
    updateTransition(1, g, { setGameState, setMapStateVersion });
    expect(setMapStateVersion).toHaveBeenCalledTimes(1);
  });

  it('clears enemies, projectiles, particles, pickups, and effects on transition end', () => {
    const g = createTestState({
      transitionTimer: 1,
      enemies: [createTestEnemy(100, 0)],
      projectiles: [{ x: 0, y: 0, type: 'autocannon', active: true }],
      particles: [{ x: 0, y: 0, life: 1, active: true }],
      pickups: [{ x: 0, y: 0, value: 1, active: true }],
      effects: [{ type: 'mission_complete', text: 'test', life: 3 }],
    });
    const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };
    updateTransition(1, g, cbs);
    expect(g.enemies).toEqual([]);
    expect(g.projectiles).toEqual([]);
    expect(g.particles).toEqual([]);
    expect(g.pickups).toEqual([]);
    expect(g.effects).toEqual([]);
  });

  it('deactivates escort on transition end', () => {
    const g = createTestState({
      transitionTimer: 1,
      escort: { active: true, x: 0, y: 0 },
    });
    const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };
    updateTransition(1, g, cbs);
    expect(g.escort.active).toBe(false);
  });

  it('completes transition across multiple frames', () => {
    const g = createTestState({ transitionTimer: 3 });
    const setGameState = vi.fn();
    const setMapStateVersion = vi.fn();

    updateTransition(1, g, { setGameState, setMapStateVersion });
    expect(setGameState).not.toHaveBeenCalled();
    expect(g.transitionTimer).toBe(2);

    updateTransition(1, g, { setGameState, setMapStateVersion });
    expect(setGameState).not.toHaveBeenCalled();
    expect(g.transitionTimer).toBe(1);

    updateTransition(1, g, { setGameState, setMapStateVersion });
    expect(setGameState).toHaveBeenCalledWith('map');
    expect(g.transitionTimer).toBeUndefined();
  });

  it('triggers immediately when dt overshoots the timer', () => {
    const g = createTestState({ transitionTimer: 1 });
    const setGameState = vi.fn();
    const setMapStateVersion = vi.fn();
    updateTransition(5, g, { setGameState, setMapStateVersion });
    expect(setGameState).toHaveBeenCalledWith('map');
    expect(g.transitionTimer).toBeUndefined();
    // Timer should be negative after subtraction but still triggers
  });

  it('transitionTimer becomes undefined after transition completes', () => {
    const g = createTestState({ transitionTimer: 2 });
    const cbs = { setGameState: vi.fn(), setMapStateVersion: vi.fn() };
    updateTransition(2, g, cbs);
    expect(g.transitionTimer).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────
 * 4. Integration: survive mission -> complete -> transition
 * ────────────────────────────────────────────── */
describe('integration: survive mission full flow', () => {
  it('survive mission completes and starts transition', () => {
    const g = createTestState({
      scrap: 100,
      level: 2,
      mission: { type: 'survive', current: 0, target: 10, reward: 50, completed: false },
      transitionTimer: undefined,
    });

    const completeFn = createCompleteMission(g);

    // Survive for 10 seconds
    checkMissionProgress(10, g, completeFn);

    // Mission should be completed
    expect(g.mission.completed).toBe(true);
    expect(g.scrap).toBe(150);
    expect(g.level).toBe(3);
    expect(g.transitionTimer).toBe(GAME_CONFIG.transition.duration);
  });

  it('full flow: survive -> complete -> transition to map', () => {
    const g = createTestState({
      scrap: 0,
      level: 1,
      mission: { type: 'survive', current: 0, target: 5, reward: 30, completed: false },
      transitionTimer: undefined,
      enemies: [createTestEnemy(100, 0)],
      projectiles: [],
      particles: [],
      pickups: [],
      effects: [],
      escort: { active: true },
    });

    const setGameState = vi.fn();
    const setMapStateVersion = vi.fn();
    const completeFn = createCompleteMission(g);

    // Survive 5 seconds
    checkMissionProgress(5, g, completeFn);

    // Verify mission completed before transition clears state
    expect(g.mission.completed).toBe(true);
    expect(g.scrap).toBe(30);
    expect(g.level).toBe(2);

    // Transition countdown
    updateTransition(GAME_CONFIG.transition.duration, g, { setGameState, setMapStateVersion });

    expect(setGameState).toHaveBeenCalledWith('map');
    expect(g.enemies).toEqual([]);
    expect(g.escort.active).toBe(false);
  });

  it('full flow: kill_boss -> complete -> transition to victory', () => {
    const g = createTestState({
      scrap: 0,
      level: 5,
      isVictory: false,
      mission: { type: 'kill_boss', current: 1, target: 1, reward: 500, completed: false },
      transitionTimer: undefined,
    });

    const setGameState = vi.fn();
    const setMapStateVersion = vi.fn();
    const completeFn = createCompleteMission(g);

    // Complete the boss mission manually (kill missions don't auto-complete via checkMissionProgress)
    completeFn();

    // Verify mission completed before transition clears state
    expect(g.mission.completed).toBe(true);
    expect(g.scrap).toBe(500);
    expect(g.isVictory).toBe(true);

    // Transition countdown
    updateTransition(GAME_CONFIG.transition.duration, g, { setGameState, setMapStateVersion });

    expect(setGameState).toHaveBeenCalledWith('victory');
    expect(setMapStateVersion).not.toHaveBeenCalled();
  });
});

/* ──────────────────────────────────────────────
 * 5. SoundManager.play('mission_complete') on completion
 * ────────────────────────────────────────────── */
describe('SoundManager.play on mission complete', () => {
  it('plays mission_complete sound when mission completes', () => {
    const g = createTestState({
      mission: { type: 'kill', current: 5, target: 5, reward: 30, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(mockPlay).toHaveBeenCalledWith('mission_complete');
  });

  it('does not play mission_complete sound on second (idempotent) call', () => {
    const g = createTestState({
      mission: { type: 'kill', current: 5, target: 5, reward: 30, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    const callsAfterFirst = mockPlay.mock.calls.length;
    complete();
    // Second call should not add any more calls
    expect(mockPlay.mock.calls.length).toBe(callsAfterFirst);
  });

  it('plays mission_complete sound for survive mission', () => {
    const g = createTestState({
      mission: { type: 'survive', current: 10, target: 10, reward: 30, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(mockPlay).toHaveBeenCalledWith('mission_complete');
  });

  it('plays mission_complete sound for kill_boss mission', () => {
    const g = createTestState({
      mission: { type: 'kill_boss', current: 1, target: 1, reward: 500, completed: false },
    });
    const complete = createCompleteMission(g);
    complete();
    expect(mockPlay).toHaveBeenCalledWith('mission_complete');
  });
});

/* ──────────────────────────────────────────────
 * 6. triggerGameOver — plays game_over sound
 * ────────────────────────────────────────────── */
describe('triggerGameOver', () => {
  it('plays game_over sound', () => {
    const g = createTestState();
    triggerGameOver(g);
    expect(mockPlay).toHaveBeenCalledWith('game_over');
  });

  it('can be called multiple times (e.g. from different death sources)', () => {
    const g = createTestState();
    triggerGameOver(g);
    triggerGameOver(g);
    expect(mockPlay).toHaveBeenCalledTimes(2);
    expect(mockPlay).toHaveBeenCalledWith('game_over');
  });
});
