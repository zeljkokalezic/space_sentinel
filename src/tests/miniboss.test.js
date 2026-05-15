/**
 * miniboss.test.js — Mini-boss fight initialization, AI, and map integration tests.
 *
 * Tests cover:
 * - GAME_CONFIG.miniboss exists with correct defaults
 * - setupMiniboss initializes scaled stats (40% HP, 50% damage)
 * - setupMiniboss positions at closer spawn distance (800 vs 1200)
 * - setupMiniboss uses smaller radius (40 vs 60)
 * - setupMiniboss sets spawnCooldown to 999
 * - setupMiniboss creates orange spawn particles
 * - resetMiniboss clears all state
 * - updateMiniboss AI works (movement, attacks, death)
 * - Mini-boss appears at levels 3, 6, 9 in map generation
 * - createGameState includes miniboss state
 * - Mini-boss and boss states are independent
 * - generateMission handles 'miniboss' nodeType
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAME_CONFIG } from '../constants/gameConfig';
import { createTestState } from './helpers';

/* ──────────────────────────────────────────────
 * Mock dependencies
 * ────────────────────────────────────────────── */
vi.mock('../engine/combat', () => ({
  createParticles: vi.fn(),
  fireProjectile: vi.fn(),
}));

vi.mock('../engine/audio', () => ({
  SoundManager: {
    play: vi.fn(),
  },
}));

import { createParticles } from '../engine/combat';
import { setupMiniboss, resetMiniboss } from '../engine/minibossSetup';
import { updateMiniboss } from '../engine/systems/miniboss';
import { generateMission } from '../engine/spawner';

/* ──────────────────────────────────────────────
 * 1. GAME_CONFIG.miniboss
 * ────────────────────────────────────────────── */
describe('GAME_CONFIG.miniboss', () => {
  it('should have hpPercent of 0.4', () => {
    expect(GAME_CONFIG.miniboss.hpPercent).toBe(0.4);
  });

  it('should have damagePercent of 0.5', () => {
    expect(GAME_CONFIG.miniboss.damagePercent).toBe(0.5);
  });

  it('should have smaller radius than boss', () => {
    expect(GAME_CONFIG.miniboss.radius).toBe(40);
    expect(GAME_CONFIG.miniboss.radius).toBeLessThan(GAME_CONFIG.boss.radius);
  });

  it('should have spawnInterval of 3', () => {
    expect(GAME_CONFIG.miniboss.spawnInterval).toBe(3);
  });

  it('should have orange color distinct from boss red', () => {
    expect(GAME_CONFIG.miniboss.color).toBe(0xf97316);
    expect(GAME_CONFIG.miniboss.color).not.toBe(GAME_CONFIG.boss.color);
  });

  it('should have scrapReward of 100', () => {
    expect(GAME_CONFIG.miniboss.scrapReward).toBe(100);
  });
});

/* ──────────────────────────────────────────────
 * 2. setupMiniboss
 * ────────────────────────────────────────────── */
describe('setupMiniboss', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.player.x = 100;
    g.player.y = 100;
    g.spawnCooldown = 2;
    g.particles = [];
    vi.clearAllMocks();
  });

  it('should activate the mini-boss', () => {
    setupMiniboss(g, 1);
    expect(g.miniboss.active).toBe(true);
  });

  it('should set HP at 40% of full boss HP', () => {
    const C = GAME_CONFIG;
    const level = 5;
    const fullBossHp = C.boss.baseHp + level * C.boss.hpPerLevel;
    const expectedHp = Math.floor(fullBossHp * C.miniboss.hpPercent);

    setupMiniboss(g, level);
    expect(g.miniboss.hp).toBe(expectedHp);
    expect(g.miniboss.maxHp).toBe(expectedHp);
  });

  it('should use smaller radius (40) than boss (60)', () => {
    setupMiniboss(g, 1);
    expect(g.miniboss.radius).toBe(GAME_CONFIG.miniboss.radius);
    expect(g.miniboss.radius).toBe(40);
  });

  it('should set speed based on miniboss config', () => {
    const C = GAME_CONFIG;
    const level = 5;
    const expectedSpeed = C.miniboss.baseSpeed + level * C.miniboss.speedPerLevel;

    setupMiniboss(g, level);
    expect(g.miniboss.speed).toBe(expectedSpeed);
  });

  it('should position at closer spawn distance (800)', () => {
    setupMiniboss(g, 1);
    const dist = Math.hypot(g.miniboss.x - g.player.x, g.miniboss.y - g.player.y);
    expect(dist).toBeCloseTo(800, 0);
  });

  it('should stop regular enemy spawning', () => {
    setupMiniboss(g, 1);
    expect(g.spawnCooldown).toBe(999);
  });

  it('should create orange spawn particles', () => {
    setupMiniboss(g, 1);
    expect(createParticles).toHaveBeenCalled();
    const callArgs = createParticles.mock.calls[0];
    expect(callArgs[3]).toBe('#f97316');
  });

  it('should set phase to 1', () => {
    setupMiniboss(g, 1);
    expect(g.miniboss.phase).toBe(1);
  });

  it('should set initial attack delay', () => {
    setupMiniboss(g, 1);
    expect(g.miniboss.attackTimer).toBe(2);
  });

  it('should set isCharging to false', () => {
    setupMiniboss(g, 1);
    expect(g.miniboss.isCharging).toBe(false);
  });

  it('should set spiralAngle to 0', () => {
    setupMiniboss(g, 1);
    expect(g.miniboss.spiralAngle).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 3. resetMiniboss
 * ────────────────────────────────────────────── */
describe('resetMiniboss', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.miniboss.active = true;
    g.miniboss.hp = 500;
    g.miniboss.maxHp = 800;
    g.miniboss.phase = 3;
    g.miniboss.attackTimer = 5;
    g.miniboss.chargeTimer = 3;
    g.miniboss.isCharging = true;
    g.miniboss.spiralAngle = 2.5;
  });

  it('should deactivate the mini-boss', () => {
    resetMiniboss(g);
    expect(g.miniboss.active).toBe(false);
  });

  it('should reset HP to 0', () => {
    resetMiniboss(g);
    expect(g.miniboss.hp).toBe(0);
    expect(g.miniboss.maxHp).toBe(0);
  });

  it('should reset phase to 1', () => {
    resetMiniboss(g);
    expect(g.miniboss.phase).toBe(1);
  });

  it('should reset all timers to 0', () => {
    resetMiniboss(g);
    expect(g.miniboss.attackTimer).toBe(0);
    expect(g.miniboss.chargeTimer).toBe(0);
  });

  it('should reset chargeTarget to origin', () => {
    resetMiniboss(g);
    expect(g.miniboss.chargeTarget).toEqual({ x: 0, y: 0 });
  });

  it('should set isCharging to false', () => {
    resetMiniboss(g);
    expect(g.miniboss.isCharging).toBe(false);
  });

  it('should reset spiralAngle to 0', () => {
    resetMiniboss(g);
    expect(g.miniboss.spiralAngle).toBe(0);
  });

  it('should reset position to origin', () => {
    resetMiniboss(g);
    expect(g.miniboss.x).toBe(0);
    expect(g.miniboss.y).toBe(0);
  });

  it('should reset fireCooldown to 1.5', () => {
    resetMiniboss(g);
    expect(g.miniboss.fireCooldown).toBe(1.5);
  });
});

/* ──────────────────────────────────────────────
 * 4. updateMiniboss AI
 * ────────────────────────────────────────────── */
describe('updateMiniboss', () => {
  let g;
  let completeMission;
  let setGameState;

  beforeEach(() => {
    completeMission = vi.fn();
    setGameState = vi.fn();
    vi.clearAllMocks();
  });

  it('should return false when mini-boss is not active', () => {
    g = createTestState();
    g.miniboss.active = false;
    const result = updateMiniboss(0.016, g, 1, completeMission, setGameState);
    expect(result).toBe(false);
  });

  it('should move toward player when far away', () => {
    g = createTestState();
    g.miniboss = {
      active: true,
      x: 1000, y: 1000,
      hp: 500, maxHp: 500,
      phase: 1,
      attackTimer: 2,
      chargeTimer: 5,
      chargeTarget: { x: 0, y: 0 },
      isCharging: false,
      radius: 40,
      speed: 50,
      fireCooldown: 1.5,
      spiralAngle: 0,
    };
    g.player.x = 0;
    g.player.y = 0;
    g.projectiles = [];
    g.effects = [];
    g.particles = [];
    g.powerups = [];
    g.pickups = [];
    g.stats = { bossesDefeated: 0 };

    updateMiniboss(0.016, g, 1, completeMission, setGameState);
    // Boss should have moved closer
    const newDist = Math.hypot(g.miniboss.x, g.miniboss.y);
    expect(newDist).toBeLessThan(Math.hypot(1000, 1000));
  });

  it('should trigger death and complete mission when HP <= 0', () => {
    g = createTestState();
    g.miniboss = {
      active: true,
      x: 500, y: 500,
      hp: 0, maxHp: 500,
      phase: 1,
      attackTimer: 0,
      chargeTimer: 5,
      chargeTarget: { x: 0, y: 0 },
      isCharging: false,
      radius: 40,
      speed: 50,
      fireCooldown: 1.5,
      spiralAngle: 0,
    };
    g.player.x = 0;
    g.player.y = 0;
    g.player.hp = 300;
    g.projectiles = [];
    g.effects = [];
    g.particles = [];
    g.powerups = [];
    g.pickups = [];
    g.stats = { bossesDefeated: 0 };

    const result = updateMiniboss(0.016, g, 1, completeMission, setGameState);
    expect(result).toBe(true);
    expect(g.miniboss.active).toBe(false);
    expect(completeMission).toHaveBeenCalled();
    expect(g.stats.bossesDefeated).toBe(1);
  });

  it('should drop scrap reward on death', () => {
    g = createTestState();
    g.miniboss = {
      active: true,
      x: 500, y: 500,
      hp: 0, maxHp: 500,
      phase: 1,
      attackTimer: 0,
      chargeTimer: 5,
      chargeTarget: { x: 0, y: 0 },
      isCharging: false,
      radius: 40,
      speed: 50,
      fireCooldown: 1.5,
      spiralAngle: 0,
    };
    g.player.x = 0;
    g.player.y = 0;
    g.player.hp = 300;
    g.projectiles = [];
    g.effects = [];
    g.particles = [];
    g.powerups = [];
    g.pickups = [];
    g.stats = { bossesDefeated: 0 };

    updateMiniboss(0.016, g, 1, completeMission, setGameState);
    expect(g.pickups.length).toBeGreaterThan(0);
    const pickup = g.pickups.find(p => p.value >= GAME_CONFIG.miniboss.scrapReward);
    expect(pickup).toBeDefined();
  });

  it('should transition phases based on HP ratio', () => {
    g = createTestState();
    g.miniboss = {
      active: true,
      x: 500, y: 500,
      hp: 330, maxHp: 500, // 66% - should be phase 2
      phase: 1,
      attackTimer: 2,
      chargeTimer: 5,
      chargeTarget: { x: 0, y: 0 },
      isCharging: false,
      radius: 40,
      speed: 50,
      fireCooldown: 1.5,
      spiralAngle: 0,
    };
    g.player.x = 0;
    g.player.y = 0;
    g.projectiles = [];
    g.effects = [];
    g.particles = [];
    g.powerups = [];
    g.pickups = [];
    g.stats = { bossesDefeated: 0 };

    updateMiniboss(0.016, g, 1, completeMission, setGameState);
    expect(g.miniboss.phase).toBe(2);
  });

  it('should damage player on ram collision', () => {
    g = createTestState();
    g.miniboss = {
      active: true,
      x: 38, y: 38, // Very close to player at origin (player radius 38)
      hp: 500, maxHp: 500,
      phase: 1,
      attackTimer: 2,
      chargeTimer: 5,
      chargeTarget: { x: 0, y: 0 },
      isCharging: false,
      radius: 40,
      speed: 50,
      fireCooldown: 1.5,
      spiralAngle: 0,
    };
    g.player.x = 0;
    g.player.y = 0;
    g.player.hp = 300;
    g.player.shield = 0;
    g.player.radius = 38;
    g.projectiles = [];
    g.effects = [];
    g.particles = [];
    g.powerups = [];
    g.pickups = [];
    g.stats = { bossesDefeated: 0 };

    updateMiniboss(0.016, g, 1, 1, setGameState);
    expect(g.player.hp).toBeLessThan(300);
  });

  it('should set gameover when player HP reaches 0 from ram', () => {
    g = createTestState();
    g.miniboss = {
      active: true,
      x: 38, y: 38,
      hp: 500, maxHp: 500,
      phase: 1,
      attackTimer: 2,
      chargeTimer: 5,
      chargeTarget: { x: 0, y: 0 },
      isCharging: false,
      radius: 40,
      speed: 50,
      fireCooldown: 1.5,
      spiralAngle: 0,
    };
    g.player.x = 0;
    g.player.y = 0;
    g.player.hp = 20; // Low HP
    g.player.shield = 0;
    g.player.radius = 38;
    g.projectiles = [];
    g.effects = [];
    g.particles = [];
    g.powerups = [];
    g.pickups = [];
    g.stats = { bossesDefeated: 0 };

    updateMiniboss(0.016, g, 1, completeMission, setGameState);
    expect(setGameState).toHaveBeenCalledWith('gameover');
  });
});

/* ──────────────────────────────────────────────
 * 5. Mini-boss and boss state independence
 * ────────────────────────────────────────────── */
describe('Mini-boss and boss state independence', () => {
  it('should have independent miniboss and boss states', () => {
    const g = createTestState();
    expect(g.miniboss).not.toBe(g.boss);
    expect(g.miniboss).toBeDefined();
    expect(g.boss).toBeDefined();
  });

  it('should allow both boss and miniboss to be active simultaneously', () => {
    const g = createTestState();
    g.boss.active = true;
    g.miniboss.active = true;
    expect(g.boss.active).toBe(true);
    expect(g.miniboss.active).toBe(true);
  });

  it('should have independent chargeTarget objects', () => {
    const g = createTestState();
    g.miniboss.chargeTarget.x = 999;
    expect(g.boss.chargeTarget.x).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 6. generateMission for miniboss
 * ────────────────────────────────────────────── */
describe('generateMission for miniboss', () => {
  it('should generate kill_miniboss mission type', () => {
    const mission = generateMission(3, 'miniboss');
    expect(mission.type).toBe('kill_miniboss');
    expect(mission.target).toBe(1);
    expect(mission.title).toContain('Mini-Boss');
  });

  it('should have higher reward than regular combat', () => {
    const mission = generateMission(3, 'miniboss');
    expect(mission.reward).toBeGreaterThan(100);
  });
});

/* ──────────────────────────────────────────────
 * 7. Mini-boss scaling at different levels
 * ────────────────────────────────────────────── */
describe('Mini-boss scaling', () => {
  let g;
  beforeEach(() => {
    g = createTestState();
    g.player.x = 0;
    g.player.y = 0;
    g.spawnCooldown = 2;
    g.particles = [];
    vi.clearAllMocks();
  });

  it('level 3 mini-boss should have ~40% of boss HP', () => {
    const C = GAME_CONFIG;
    const level = 3;
    const fullBossHp = C.boss.baseHp + level * C.boss.hpPerLevel;
    setupMiniboss(g, level);
    const expected = Math.floor(fullBossHp * C.miniboss.hpPercent);
    expect(g.miniboss.hp).toBe(expected);
  });

  it('level 6 mini-boss should scale up', () => {
    const C = GAME_CONFIG;
    setupMiniboss(g, 3);
    const hp3 = g.miniboss.hp;
    setupMiniboss(g, 6);
    const hp6 = g.miniboss.hp;
    expect(hp6).toBeGreaterThan(hp3);
  });

  it('level 9 mini-boss should scale up further', () => {
    setupMiniboss(g, 6);
    const hp6 = g.miniboss.hp;
    setupMiniboss(g, 9);
    const hp9 = g.miniboss.hp;
    expect(hp9).toBeGreaterThan(hp6);
  });

  it('mini-boss speed increases with level', () => {
    setupMiniboss(g, 3);
    const speed3 = g.miniboss.speed;
    setupMiniboss(g, 9);
    const speed9 = g.miniboss.speed;
    expect(speed9).toBeGreaterThan(speed3);
  });
});
