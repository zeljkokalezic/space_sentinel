/**
 * escort.test.js — Escort drone movement, evasion, collision, and mission checks.
 *
 * Tests the `updateEscort` system from src/engine/systems/escort.js.
 * Uses the test helpers from src/tests/helpers.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateEscort } from '../../engine/systems/escort';
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createTestState, createTestEnemy } from '../helpers';

// Mock window for node environment (escort.js uses window.innerWidth/innerHeight)
beforeEach(() => {
  globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
  };
});

/* ──────────────────────────────────────────────
 * Helper: create a game state with escort active
 * ────────────────────────────────────────────── */
function createEscortState(overrides = {}) {
  const escortOverride = overrides.escort || {};
  const defaultEscort = {
    active: true,
    x: 0,
    y: 0,
    targetX: 500,
    targetY: 0,
    hp: 100,
    maxHp: 100,
    speed: 100,
    radius: 20,
    lives: 1,
    evasionAngle: 0,
    evasionTimer: 0,
    respawnTimer: 0,
    startDist: 500,
    ...escortOverride,
  };

  const missionOverride = overrides.mission || {};
  const defaultMission = {
    type: 'escort',
    current: 0,
    target: 500,
    completed: false,
    ...missionOverride,
  };

  const playerOverride = overrides.player || {};
  const defaultPlayer = {
    x: 0,
    y: 0,
    radius: 38,
    ...playerOverride,
  };

  return createTestState({
    escort: defaultEscort,
    mission: defaultMission,
    player: defaultPlayer,
    projectiles: overrides.projectiles || [],
    enemies: overrides.enemies || [],
    particles: overrides.particles || [],
    effects: overrides.effects || [],
  });
}

/* ──────────────────────────────────────────────
 * 1. Escort drone movement toward destination
 * ────────────────────────────────────────────── */
describe('escort drone movement toward destination', () => {
  it('escort moves closer to target each frame', () => {
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
    });
    const distBefore = Math.hypot(g.escort.targetX - g.escort.x, g.escort.targetY - g.escort.y);

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    const distAfter = Math.hypot(g.escort.targetX - g.escort.x, g.escort.targetY - g.escort.y);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('escort position changes by speed * dt along the direction to target', () => {
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
    });
    const dt = 0.1;

    updateEscort(dt, g, 1, vi.fn(), vi.fn());

    // angle = 0, cos(0)=1, sin(0)=0
    expect(g.escort.x).toBeCloseTo(100 * dt);
    expect(g.escort.y).toBeCloseTo(0);
  });

  it('escort moves diagonally toward target', () => {
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: 300,
        targetY: 400,
        speed: 100,
        startDist: 500,
      },
    });
    const dt = 0.1;

    updateEscort(dt, g, 1, vi.fn(), vi.fn());

    const angle = Math.atan2(400, 300);
    expect(g.escort.x).toBeCloseTo(Math.cos(angle) * 100 * dt);
    expect(g.escort.y).toBeCloseTo(Math.sin(angle) * 100 * dt);
  });

  it('escort stops moving when within destination threshold', () => {
    const g = createEscortState({
      escort: {
        x: 480,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
    });
    // distance = 20, threshold = 30
    const dt = 0.1;

    updateEscort(dt, g, 1, vi.fn(), vi.fn());

    // Should not move — already within threshold
    expect(g.escort.x).toBe(480);
    expect(g.escort.y).toBe(0);
  });

  it('escort continues moving when outside destination threshold', () => {
    const g = createEscortState({
      escort: {
        x: 450,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
    });
    // distance = 50, threshold = 30
    const dt = 0.1;

    updateEscort(dt, g, 1, vi.fn(), vi.fn());

    expect(g.escort.x).toBeGreaterThan(450);
  });
});

/* ──────────────────────────────────────────────
 * 2. Escort stays within world bounds
 * ────────────────────────────────────────────── */
describe('escort world bounds clamping', () => {
  it('escort x is clamped to worldBounds', () => {
    const bounds = GAME_CONFIG.escort.worldBounds;
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: bounds + 500,
        targetY: 0,
        speed: 5000,
        startDist: bounds + 500,
      },
    });
    const dt = 1;

    updateEscort(dt, g, 1, vi.fn(), vi.fn());

    expect(g.escort.x).toBeLessThanOrEqual(bounds);
    expect(g.escort.x).toBeGreaterThanOrEqual(-bounds);
  });

  it('escort y is clamped to worldBounds', () => {
    const bounds = GAME_CONFIG.escort.worldBounds;
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: bounds + 500,
        speed: 5000,
        startDist: bounds + 500,
      },
    });
    const dt = 1;

    updateEscort(dt, g, 1, vi.fn(), vi.fn());

    expect(g.escort.y).toBeLessThanOrEqual(bounds);
    expect(g.escort.y).toBeGreaterThanOrEqual(-bounds);
  });

  it('escort stays within negative bounds', () => {
    const bounds = GAME_CONFIG.escort.worldBounds;
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: -bounds - 500,
        targetY: -bounds - 500,
        speed: 5000,
        startDist: Math.hypot(bounds + 500, bounds + 500),
      },
    });
    const dt = 1;

    updateEscort(dt, g, 1, vi.fn(), vi.fn());

    expect(g.escort.x).toBeGreaterThanOrEqual(-bounds);
    expect(g.escort.y).toBeGreaterThanOrEqual(-bounds);
  });
});

/* ──────────────────────────────────────────────
 * 3. Escort evasion of enemy projectiles
 * ────────────────────────────────────────────── */
describe('escort evasion behavior', () => {
  it('escort does not evade when no enemy projectiles nearby', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, evasionTimer: 0 },
      projectiles: [],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.evasionTimer).toBeLessThanOrEqual(0);
  });

  it('escort evades when enemy projectile heading toward it within threat radius', () => {
    // Enemy projectile at (150, 0) heading left toward escort at (0, 0)
    // The projectile velocity should be pointing toward the escort
    const g = createEscortState({
      escort: { x: 0, y: 0, evasionTimer: 0 },
      projectiles: [
        {
          x: 150,
          y: 0,
          vx: -200, // heading left toward escort
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 10,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.evasionTimer).toBeGreaterThan(0);
  });

  it('escort does not evade non-enemy projectiles', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, evasionTimer: 0 },
      projectiles: [
        {
          x: 50,
          y: 0,
          vx: -200,
          vy: 0,
          active: true,
          isEnemy: false, // player projectile
          radius: 5,
          damage: 10,
          type: 'autocannon',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.evasionTimer).toBeLessThanOrEqual(0);
  });

  it('escort does not evade inactive projectiles', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, evasionTimer: 0 },
      projectiles: [
        {
          x: 50,
          y: 0,
          vx: -200,
          vy: 0,
          active: false,
          isEnemy: true,
          radius: 5,
          damage: 10,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.evasionTimer).toBeLessThanOrEqual(0);
  });

  it('escort does not evade projectiles outside threat radius', () => {
    const threatRadius = GAME_CONFIG.escort.evasionThreatRadius;
    const g = createEscortState({
      escort: { x: 0, y: 0, evasionTimer: 0 },
      projectiles: [
        {
          x: threatRadius + 100,
          y: 0,
          vx: -200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 10,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.evasionTimer).toBeLessThanOrEqual(0);
  });

  it('evasion offset moves escort perpendicular to threat direction', () => {
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        evasionTimer: GAME_CONFIG.escort.evasionCooldown,
        evasionAngle: Math.PI / 2, // evading upward
        startDist: 500,
      },
      projectiles: [],
    });
    const xBefore = g.escort.x;
    const yBefore = g.escort.y;

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    // Evasion adds speed * 2 * dt in the evasion direction
    expect(Math.abs(g.escort.y - yBefore)).toBeGreaterThan(0);
  });

  it('evasion timer decrements each frame', () => {
    const g = createEscortState({
      escort: { evasionTimer: 1.0 },
    });

    updateEscort(0.3, g, 1, vi.fn(), vi.fn());

    expect(g.escort.evasionTimer).toBeCloseTo(0.7);
  });
});

/* ──────────────────────────────────────────────
 * 4. Escort health decreases on projectile collision
 * ────────────────────────────────────────────── */
describe('escort health on projectile collision', () => {
  it('escort hp decreases when hit by enemy projectile', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100 },
      projectiles: [
        {
          x: 10,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 15,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });
    // escort radius = 20, projectile radius = 5, collision dist < 25

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.hp).toBe(85);
  });

  it('hit projectile is deactivated', () => {
    const proj = {
      x: 10,
      y: 0,
      vx: 200,
      vy: 0,
      active: true,
      isEnemy: true,
      radius: 5,
      damage: 10,
      type: 'enemy_bullet',
      pierce: 0,
      hitList: [],
      life: 0,
      target: null,
    };
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100 },
      projectiles: [proj],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(proj.active).toBe(false);
  });

  it('particles are created on projectile hit', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100 },
      projectiles: [
        {
          x: 10,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 10,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('damage effect is pushed on projectile hit', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100 },
      projectiles: [
        {
          x: 10,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 10,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    const dmgEffect = g.effects.find(e => e.type === 'dmg');
    expect(dmgEffect).toBeDefined();
    expect(dmgEffect.text).toBe('10');
  });

  it('escort not damaged by non-enemy projectile', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100 },
      projectiles: [
        {
          x: 10,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: false,
          radius: 5,
          damage: 10,
          type: 'autocannon',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.hp).toBe(100);
  });

  it('escort not damaged by projectile outside collision range', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100, radius: 20 },
      projectiles: [
        {
          x: 100,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 10,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });
    // collision dist = 100, escort radius + proj radius = 25, no collision

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.hp).toBe(100);
  });
});

/* ──────────────────────────────────────────────
 * 5. Escort health decreases on enemy ram
 * ────────────────────────────────────────────── */
describe('escort health on enemy ram collision', () => {
  it('escort hp decreases by ramDamage when enemy collides', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100 },
      enemies: [createTestEnemy(10, 0, 'fighter')],
    });
    // escort radius=20, enemy radius=15, collision dist < 35

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.hp).toBe(100 - GAME_CONFIG.escort.ramDamage);
  });

  it('escort not damaged by inactive enemy', () => {
    const enemy = createTestEnemy(10, 0, 'fighter');
    enemy.active = false;
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100 },
      enemies: [enemy],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.hp).toBe(100);
  });

  it('escort not damaged by enemy outside collision range', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100, radius: 20 },
      enemies: [createTestEnemy(200, 0, 'fighter')],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.hp).toBe(100);
  });

  it('particles are created on enemy ram', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, hp: 100, maxHp: 100 },
      enemies: [createTestEnemy(10, 0, 'fighter')],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.particles.length).toBeGreaterThan(0);
  });
});

/* ──────────────────────────────────────────────
 * 6. Escort death and respawn
 * ────────────────────────────────────────────── */
describe('escort death and respawn', () => {
  it('escort respawns when hp <= 0 and lives > 0', () => {
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        hp: 0,
        maxHp: 100,
        lives: 2,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.lives).toBe(1);
    expect(g.escort.hp).toBe(100);
    // respawnTimer is set then immediately decremented by dt in the same call
    expect(g.escort.respawnTimer).toBeCloseTo(GAME_CONFIG.escort.respawnTimer - 0.1);
  });

  it('escort does not move while respawning', () => {
    const g = createEscortState({
      escort: {
        x: 100,
        y: 0,
        hp: 0,
        maxHp: 100,
        lives: 2,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    // After first call, respawnTimer is set, escort shouldn't move
    expect(g.escort.x).toBe(100);
    expect(g.escort.y).toBe(0);
  });

  it('escort respawn timer decrements each frame', () => {
    const g = createEscortState({
      escort: {
        x: 100,
        y: 0,
        hp: 0,
        maxHp: 100,
        lives: 2,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
    });

    // First call: triggers respawn (lives--, hp restored, respawnTimer set)
    updateEscort(0.1, g, 1, vi.fn(), vi.fn());
    const timerAfterFirst = g.escort.respawnTimer;

    // Second call: decrements timer
    updateEscort(0.5, g, 1, vi.fn(), vi.fn());

    expect(g.escort.respawnTimer).toBeCloseTo(timerAfterFirst - 0.5);
  });

  it('escort respawns near player after timer expires', () => {
    const g = createEscortState({
      escort: {
        x: 100,
        y: 0,
        hp: 0,
        maxHp: 100,
        lives: 2,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
      player: { x: 0, y: 0 },
    });

    // First call: triggers respawn timer
    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    // Second call: timer expires (2.0 - 2.0 = 0)
    updateEscort(GAME_CONFIG.escort.respawnTimer, g, 1, vi.fn(), vi.fn());

    // Escort should be near player (within respawnSpread)
    const distToPlayer = Math.hypot(g.escort.x - g.player.x, g.escort.y - g.player.y);
    expect(distToPlayer).toBeLessThanOrEqual(GAME_CONFIG.escort.respawnSpread);
  });

  it('escort death triggers gameover when lives reach 0', () => {
    const completeMission = vi.fn();
    const setGameState = vi.fn();

    // With the refactored escort.js, lives are decremented in the respawn handler
    // at the top of the function on the next frame. To test gameover in a single
    // call, set lives=0 so handleEscortDeath sees esc.lives <= 0 immediately.
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        hp: 10,
        maxHp: 100,
        lives: 0,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
      projectiles: [
        {
          x: 10,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 20, // enough to kill
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    const result = updateEscort(0.1, g, 1, completeMission, setGameState);

    expect(result).toBe(true);
    expect(g.escort.active).toBe(false);
    expect(g.player.hp).toBe(0);
    expect(setGameState).toHaveBeenCalledWith('gameover');
  });

  it('escort death from enemy ram triggers gameover when lives reach 0', () => {
    const completeMission = vi.fn();
    const setGameState = vi.fn();

    // Same logic as projectile test: set lives=0 so handleEscortDeath sees
    // esc.lives <= 0 immediately when the escort is killed by ram.
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        hp: 10,
        maxHp: 100,
        lives: 0,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
      enemies: [createTestEnemy(10, 0, 'fighter')],
    });

    const result = updateEscort(0.1, g, 1, completeMission, setGameState);

    expect(result).toBe(true);
    expect(g.escort.active).toBe(false);
    expect(g.player.hp).toBe(0);
    expect(setGameState).toHaveBeenCalledWith('gameover');
  });

  it('escort death pushes DRONE DESTROYED effect', () => {
    const setGameState = vi.fn();

    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        hp: 10,
        maxHp: 100,
        lives: 1,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
      projectiles: [
        {
          x: 10,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 20,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), setGameState);

    const destroyEffect = g.effects.find(e => e.type === 'mission_complete');
    expect(destroyEffect).toBeDefined();
    expect(destroyEffect.text).toContain('DRONE DESTROYED');
  });

  it('escort death with remaining lives shows lives left message', () => {
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        hp: 10,
        maxHp: 100,
        lives: 3,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
      projectiles: [
        {
          x: 10,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 20,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    const destroyEffect = g.effects.find(e => e.type === 'mission_complete');
    expect(destroyEffect.text).toContain('LIVES LEFT');
  });

  it('escort does not trigger gameover if lives remain after destruction', () => {
    const setGameState = vi.fn();

    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        hp: 10,
        maxHp: 100,
        lives: 2,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
      projectiles: [
        {
          x: 10,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 20,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    const result = updateEscort(0.1, g, 1, vi.fn(), setGameState);

    expect(result).toBe(false);
    expect(setGameState).not.toHaveBeenCalledWith('gameover');
    expect(g.escort.active).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * 7. Escort inactive / mission completed — early return
 * ────────────────────────────────────────────── */
describe('early return conditions', () => {
  it('returns false when escort is not active', () => {
    const g = createEscortState({ escort: { active: false } });
    const result = updateEscort(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });

  it('returns false when mission is already completed', () => {
    const g = createEscortState({
      mission: { type: 'escort', current: 0, target: 500, completed: true },
    });
    const result = updateEscort(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });

  it('escort position unchanged when not active', () => {
    const g = createEscortState({
      escort: { active: false, x: 100, y: 50 },
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.x).toBe(100);
    expect(g.escort.y).toBe(50);
  });
});

/* ──────────────────────────────────────────────
 * 8. Mission progress tracking
 * ────────────────────────────────────────────── */
describe('mission progress tracking', () => {
  it('mission.current reflects distance traveled toward target', () => {
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
    });

    // First call: escort moves 10 units, mission.current updated after movement
    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    // Second call: escort moves another 10 units, mission.current updated after movement
    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    // Escort moved ~20 units toward target total (2 calls * 100 * 0.1)
    expect(g.mission.current).toBeCloseTo(20); // finalDist after both calls = ~480, traveled = 500 - 480 = 20
    expect(g.mission.target).toBe(500);
  });

  it('mission.current is clamped to minimum 0', () => {
    const g = createEscortState({
      escort: {
        x: 510,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
    });
    // Escort is past the target, traveled would be negative

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.mission.current).toBeGreaterThanOrEqual(0);
  });

  it('completeMission is called when escort reaches destination', () => {
    const completeMission = vi.fn();
    const g = createEscortState({
      escort: {
        x: 480,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
    });
    // distance = 20, threshold = 30, so escort is at destination

    updateEscort(0.1, g, 1, completeMission, vi.fn());

    expect(completeMission).toHaveBeenCalledTimes(1);
  });

  it('completeMission is not called when escort is far from destination', () => {
    const completeMission = vi.fn();
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
    });

    updateEscort(0.1, g, 1, completeMission, vi.fn());

    expect(completeMission).not.toHaveBeenCalled();
  });
});

/* ──────────────────────────────────────────────
 * 9. Enemies target escort drone when closer than player
 * ────────────────────────────────────────────── */
describe('enemy targeting of escort drone', () => {
  it('shooter enemy fires at escort when escort is closer than player', () => {
    const g = createEscortState({
      escort: {
        x: 200,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
      player: { x: 600, y: 0 },
      enemies: [
        (() => {
          const e = createTestEnemy(0, 0, 'shooter');
          e.fireCooldown = 0;
          return e;
        })(),
      ],
    });
    // Escort at 200, player at 600, enemy at 0 — escort is closer
    // shooter range = player.radius * 16 = 38 * 16 = 608. dist to escort = 200 < 608

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.projectiles.length).toBeGreaterThan(0);
    expect(g.projectiles[0].type).toBe('enemy_bullet');
  });

  it('missile_boat enemy fires missiles at escort when escort is closer', () => {
    const g = createEscortState({
      escort: {
        x: 300,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
      player: { x: 700, y: 0 },
      enemies: [
        (() => {
          const e = createTestEnemy(0, 0, 'missile_boat');
          e.fireCooldown = 0;
          return e;
        })(),
      ],
    });
    // missile_boat range = player.radius * 21 = 38 * 21 = 798. dist to escort = 300 < 798

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.projectiles.length).toBe(2);
    expect(g.projectiles[0].type).toBe('enemy_missile');
    expect(g.projectiles[1].type).toBe('enemy_missile');
  });

  it('enemy does not target escort when escort is farther than player', () => {
    const g = createEscortState({
      escort: {
        x: 600,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
      player: { x: 200, y: 0 },
      enemies: [
        (() => {
          const e = createTestEnemy(0, 0, 'shooter');
          e.fireCooldown = 0;
          return e;
        })(),
      ],
    });
    // Escort at 600, player at 200, enemy at 0 — player is closer
    // distToEscort(600) > distToPlayer(200), so no targeting of escort

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    // No projectiles fired at escort (enemy targets player instead, handled by enemies system)
    expect(g.projectiles.length).toBe(0);
  });

  it('enemy does not fire at escort if beyond spawnRadiusMin', () => {
    const spawnRadiusMin = GAME_CONFIG.enemies.spawnRadiusMin;
    const g = createEscortState({
      escort: {
        x: spawnRadiusMin + 200,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
      player: { x: spawnRadiusMin + 300, y: 0 },
      enemies: [
        (() => {
          const e = createTestEnemy(0, 0, 'shooter');
          e.fireCooldown = 0;
          return e;
        })(),
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.projectiles.length).toBe(0);
  });

  it('enemy does not fire at escort while fireCooldown > 0', () => {
    const g = createEscortState({
      escort: {
        x: 200,
        y: 0,
        targetX: 500,
        targetY: 0,
        speed: 100,
        startDist: 500,
      },
      player: { x: 600, y: 0 },
      enemies: [
        (() => {
          const e = createTestEnemy(0, 0, 'shooter');
          e.fireCooldown = 2.0;
          return e;
        })(),
      ],
    });

    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.projectiles.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 10. Escort movement speed behavior
 * ────────────────────────────────────────────── */
describe('escort movement speed and behavior', () => {
  it('escort moves at configured speed', () => {
    const g = createEscortState({
      escort: { x: 0, y: 0, targetX: 1000, targetY: 0, speed: 200, startDist: 1000 },
    });
    const dt = 0.1;

    updateEscort(dt, g, 1, vi.fn(), vi.fn());

    expect(g.escort.x).toBeCloseTo(200 * dt);
    expect(g.escort.y).toBeCloseTo(0);
  });

  it('escort does not take damage while respawning', () => {
    const g = createEscortState({
      escort: {
        x: 0,
        y: 0,
        hp: 0,
        maxHp: 100,
        lives: 2,
        targetX: 500,
        targetY: 0,
        startDist: 500,
      },
      projectiles: [
        {
          x: 5,
          y: 0,
          vx: 200,
          vy: 0,
          active: true,
          isEnemy: true,
          radius: 5,
          damage: 10,
          type: 'enemy_bullet',
          pierce: 0,
          hitList: [],
          life: 0,
          target: null,
        },
      ],
    });

    // First call: triggers respawn (respawnTimer set, hp restored)
    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    // Escort is in respawn state (respawnTimer > 0), should not take damage
    const hpAfterRespawn = g.escort.hp;

    // Second call: still respawning, projectile should not damage
    updateEscort(0.1, g, 1, vi.fn(), vi.fn());

    expect(g.escort.hp).toBe(hpAfterRespawn);
  });

  it('escort returns false normally (no gameover)', () => {
    const g = createEscortState();
    const result = updateEscort(0.1, g, 1, vi.fn(), vi.fn());
    expect(result).toBe(false);
  });
});
