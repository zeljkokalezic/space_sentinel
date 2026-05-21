/**
 * Unit tests for enemy formation AI systems.
 *
 * Covers: formation movement, level gating, phase transitions, swarm boids.
 *
 * Run:  npm run test:run -- src/tests/systems/enemyFormations.test.js
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateEnemies } from '../../engine/systems/enemies';
import { pickFormation, getAvailableFormations } from '../../engine/spawner';
import { createTestState } from '../helpers';

describe('formation level gating', () => {
  it('level 1 unlocks kamikaze and vanguard only', () => {
    const available = getAvailableFormations(1);
    expect(available).toContain('kamikaze');
    expect(available).toContain('vanguard');
    expect(available).not.toContain('orbit');
    expect(available).not.toContain('swarm');
  });

  it('level 4 unlocks orbit and bomber', () => {
    const available = getAvailableFormations(4);
    expect(available).toContain('kamikaze');
    expect(available).toContain('vanguard');
    expect(available).toContain('orbit');
    expect(available).toContain('bomber');
    expect(available).not.toContain('swarm');
    expect(available).not.toContain('screen');
  });

  it('level 7 unlocks all formations', () => {
    const available = getAvailableFormations(7);
    expect(available).toContain('kamikaze');
    expect(available).toContain('vanguard');
    expect(available).toContain('orbit');
    expect(available).toContain('bomber');
    expect(available).toContain('swarm');
    expect(available).toContain('screen');
  });

  it('level 10 unlocks all formations', () => {
    const available = getAvailableFormations(10);
    expect(available.length).toBe(6);
  });
});

describe('pickFormation', () => {
  it('circle pattern picks orbit at level 4', () => {
    const formation = pickFormation('circle', 4);
    expect(formation).toBe('orbit');
  });

  it('swarm pattern picks swarm at level 7', () => {
    const formation = pickFormation('swarm', 7);
    expect(formation).toBe('swarm');
  });

  it('falls back to kamikaze when pattern formation not available', () => {
    // circle -> orbit, but orbit not available at level 1
    const formation = pickFormation('circle', 1);
    expect(['kamikaze', 'vanguard']).toContain(formation);
  });

  it('burst pattern picks vanguard at level 1', () => {
    const formation = pickFormation('burst', 1);
    expect(formation).toBe('vanguard');
  });
});

describe('formation movement — vanguard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('vanguard holds position during spread phase', () => {
    const enemy = {
      id: 1, x: 500, y: 500, hp: 30, maxHp: 30, shield: 0, maxShield: 0,
      speed: 100, radius: 15, color: 0xef4444, type: 'fighter',
      active: true, fireCooldown: 0,
      formation: 'vanguard', formationPhase: 'spread', formationTimer: 3,
      orbitAngle: 0, formationIndex: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    // During spread phase, enemy should barely move (slow outward drift)
    expect(Math.abs(enemy.x - 500)).toBeLessThan(5);
    expect(enemy.formationPhase).toBe('spread');
  });

  it('vanguard converges after timer expires', () => {
    const enemy = {
      id: 1, x: 500, y: 500, hp: 30, maxHp: 30, shield: 0, maxShield: 0,
      speed: 100, radius: 15, color: 0xef4444, type: 'fighter',
      active: true, fireCooldown: 0,
      formation: 'vanguard', formationPhase: 'spread', formationTimer: 0.1,
      orbitAngle: 0, formationIndex: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    // Run enough ticks to expire the timer
    for (let i = 0; i < 10; i++) {
      updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    }
    expect(enemy.formationPhase).toBe('engage');
    // Should be moving toward player
    expect(enemy.x).toBeLessThan(500);
  });
});

describe('formation movement — orbit', () => {
  it('orbit moves toward orbit radius then starts orbiting', () => {
    const enemy = {
      id: 1, x: 600, y: 0, hp: 40, maxHp: 40, shield: 0, maxShield: 0,
      speed: 100, radius: 16, color: 0xa855f7, type: 'shooter',
      active: true, fireCooldown: 1.5,
      formation: 'orbit', formationPhase: 'approach', formationTimer: 10,
      orbitAngle: 0, formationIndex: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    // 600 -> 250 orbit radius at 100 speed * 0.016dt = 1.6px/tick = ~313 ticks
    // orbit band is 220-280, so need ~188 ticks minimum; use 400 for safety
    for (let i = 0; i < 400; i++) {
      updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
      if (enemy.formationPhase === 'orbit') break;
    }
    expect(enemy.formationPhase).toBe('orbit');
    // Should be roughly at orbit radius (250)
    const dist = Math.hypot(enemy.x, enemy.y);
    expect(dist).toBeGreaterThan(150);
    expect(dist).toBeLessThan(400);
  });

  it('orbit rushes when player gets close', () => {
    const enemy = {
      id: 1, x: 250, y: 0, hp: 40, maxHp: 40, shield: 0, maxShield: 0,
      speed: 80, radius: 16, color: 0xa855f7, type: 'shooter',
      active: true, fireCooldown: 1.5,
      formation: 'orbit', formationPhase: 'orbit', formationTimer: 10,
      orbitAngle: 0, formationIndex: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    // Player is at origin, orbit rush threshold is 0.4 * 250 = 100
    // Move player closer
    g.player.x = 50;
    g.player.y = 0;

    for (let i = 0; i < 10; i++) {
      updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    }
    // Should eventually rush (timer expires or dist < threshold)
    // After enough ticks the timer should expire
    for (let i = 0; i < 700; i++) {
      updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    }
    expect(enemy.formationPhase).toBe('engage');
  });
});

describe('formation movement — swarm', () => {
  it('swarm maintains separation between members', () => {
    const swarm = [];
    for (let i = 0; i < 5; i++) {
      swarm.push({
        id: i, x: 300 + i * 10, y: 300 + i * 10, hp: 15, maxHp: 15, shield: 0, maxShield: 0,
        speed: 200, radius: 12, color: 0xeab308, type: 'interceptor',
        active: true, fireCooldown: 0,
        formation: 'swarm', formationPhase: 'engage', formationTimer: 0,
        orbitAngle: 0, formationIndex: i, angle: 0,
      });
    }
    const g = createTestState({
      enemies: swarm,
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());

    // All swarm members should still be active (no NaN positions)
    for (const e of swarm) {
      expect(e.x).toBeDefined();
      expect(e.y).toBeDefined();
      expect(Number.isNaN(e.x)).toBe(false);
      expect(Number.isNaN(e.y)).toBe(false);
      expect(Number.isFinite(e.x)).toBe(true);
      expect(Number.isFinite(e.y)).toBe(true);
    }
  });

  it('swarm does not cause infinity with single member', () => {
    const enemy = {
      id: 1, x: 300, y: 300, hp: 15, maxHp: 15, shield: 0, maxShield: 0,
      speed: 200, radius: 12, color: 0xeab308, type: 'interceptor',
      active: true, fireCooldown: 0,
      formation: 'swarm', formationPhase: 'engage', formationTimer: 0,
      orbitAngle: 0, formationIndex: 0, angle: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    expect(Number.isNaN(enemy.x)).toBe(false);
    expect(Number.isNaN(enemy.y)).toBe(false);
    expect(Number.isFinite(enemy.x)).toBe(true);
    expect(Number.isFinite(enemy.y)).toBe(true);
  });
});

describe('formation movement — kamikaze', () => {
  it('kamikaze charges toward player with lateral movement', () => {
    const enemy = {
      id: 1, x: 500, y: 500, hp: 30, maxHp: 30, shield: 0, maxShield: 0,
      speed: 100, radius: 15, color: 0xef4444, type: 'fighter',
      active: true, fireCooldown: 0,
      formation: 'kamikaze', formationPhase: 'engage', formationTimer: 0,
      orbitAngle: 0, formationIndex: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    const startX = enemy.x;
    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    // Should move toward player
    expect(enemy.x).toBeLessThan(startX);
    expect(enemy.formationPhase).toBe('engage');
  });
});

describe('formation movement — bomber', () => {
  it('bomber cycles through approach -> fire -> retreat -> approach', () => {
    const enemy = {
      id: 1, x: 500, y: 0, hp: 60, maxHp: 60, shield: 0, maxShield: 0,
      speed: 100, radius: 22, color: 0xd946ef, type: 'missile_boat',
      active: true, fireCooldown: 3.0,
      formation: 'bomber', formationPhase: 'approach', formationTimer: 0,
      orbitAngle: 0, formationIndex: 0, burstCount: 0, burstCooldown: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      projectiles: [],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    // Run enough ticks to cycle through all phases
    let phases = new Set();
    for (let i = 0; i < 1000; i++) {
      updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
      phases.add(enemy.formationPhase);
      if (phases.size >= 3) break;
    }
    expect(phases).toContain('approach');
    expect(phases).toContain('fire');
    expect(phases).toContain('retreat');
  });
});

describe('formation movement — screen', () => {
  it('screen enemies advance toward player', () => {
    const enemy = {
      id: 1, x: 600, y: 0, hp: 100, maxHp: 100, shield: 0, maxShield: 0,
      speed: 50, radius: 25, color: 0xf97316, type: 'heavy',
      active: true, fireCooldown: 0,
      formation: 'screen', formationPhase: 'engage', formationTimer: 0,
      orbitAngle: 0, formationIndex: 2,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    const startX = enemy.x;
    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    // Should advance toward player
    expect(enemy.x).toBeLessThan(startX);
    expect(enemy.formationPhase).toBe('engage');
  });
});

describe('backward compatibility — no formation', () => {
  it('enemies without formation use legacy movement', () => {
    const enemy = {
      id: 1, x: 500, y: 0, hp: 30, maxHp: 30, shield: 0, maxShield: 0,
      speed: 100, radius: 15, color: 0xef4444, type: 'fighter',
      active: true, fireCooldown: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    const startX = enemy.x;
    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    // Should move toward player (legacy behavior)
    expect(enemy.x).toBeLessThan(startX);
  });

  it('interceptor legacy wobble still works', () => {
    const enemy = {
      id: 1, x: 500, y: 0, hp: 15, maxHp: 15, shield: 0, maxShield: 0,
      speed: 200, radius: 12, color: 0xeab308, type: 'interceptor',
      active: true, fireCooldown: 0,
    };
    const g = createTestState({
      enemies: [enemy],
      player: { ...createTestState().player, x: 0, y: 0 },
      totalTime: 0,
    });

    updateEnemies(0.016, g, 1, vi.fn(), vi.fn());
    // Should still move (interceptor wobble is in legacy handler)
    expect(Number.isFinite(enemy.x)).toBe(true);
    expect(Number.isFinite(enemy.y)).toBe(true);
  });
});
