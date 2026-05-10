/**
 * Unit tests for systems/cleanup.js — cleanup(dt, g)
 *
 * Covers: dead entity removal from enemies/projectiles/particles/pickups/effects,
 * periodic cleanup timer behavior, active entity preservation, and empty array safety.
 *
 * Run:  npm run test:run -- src/tests/systems/cleanup.test.js
 */
import { describe, it, expect } from 'vitest';
import { cleanup } from '../../engine/systems/cleanup';
import {
  createTestState,
  createTestEnemy,
  createTestProjectile,
  createTestParticle,
  createTestPickup,
} from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

/* ──────────────────────────────────────────────
 * 1. Dead enemies are removed from g.enemies
 * ────────────────────────────────────────────── */
describe('dead enemies are removed', () => {
  it('removes a single dead enemy', () => {
    const g = createTestState();
    const enemy = createTestEnemy(100, 200);
    enemy.active = false;
    g.enemies = [enemy];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.enemies.length).toBe(0);
  });

  it('removes multiple dead enemies', () => {
    const g = createTestState();
    g.enemies = [
      { ...createTestEnemy(10, 10), active: false },
      { ...createTestEnemy(20, 20), active: false },
      { ...createTestEnemy(30, 30), active: false },
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.enemies.length).toBe(0);
  });

  it('removes dead enemies mixed with active ones', () => {
    const g = createTestState();
    const alive = createTestEnemy(0, 0);
    const dead1 = createTestEnemy(50, 50);
    dead1.active = false;
    const alive2 = createTestEnemy(100, 100);
    const dead2 = createTestEnemy(150, 150);
    dead2.active = false;
    g.enemies = [alive, dead1, alive2, dead2];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.enemies.length).toBe(2);
    expect(g.enemies).toContain(alive);
    expect(g.enemies).toContain(alive2);
  });
});

/* ──────────────────────────────────────────────
 * 2. Dead projectiles are removed from g.projectiles
 * ────────────────────────────────────────────── */
describe('dead projectiles are removed', () => {
  it('removes a single dead projectile', () => {
    const g = createTestState();
    const proj = createTestProjectile(0, 0, 0);
    proj.active = false;
    g.projectiles = [proj];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.projectiles.length).toBe(0);
  });

  it('removes dead projectiles mixed with active ones', () => {
    const g = createTestState();
    const alive = createTestProjectile(0, 0, 0);
    const dead = createTestProjectile(10, 10, Math.PI / 4);
    dead.active = false;
    const alive2 = createTestProjectile(20, 20, Math.PI / 2);
    g.projectiles = [alive, dead, alive2];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.projectiles.length).toBe(2);
    expect(g.projectiles).toContain(alive);
    expect(g.projectiles).toContain(alive2);
  });

  it('removes all dead projectiles when all are inactive', () => {
    const g = createTestState();
    g.projectiles = [
      { ...createTestProjectile(0, 0, 0), active: false },
      { ...createTestProjectile(5, 5, 0), active: false },
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.projectiles.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 3. Dead particles are removed from g.particles
 * ────────────────────────────────────────────── */
describe('dead particles are removed', () => {
  it('removes a single dead particle', () => {
    const g = createTestState();
    const particle = createTestParticle(0, 0);
    particle.active = false;
    g.particles = [particle];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.particles.length).toBe(0);
  });

  it('removes dead particles mixed with active ones', () => {
    const g = createTestState();
    const alive = createTestParticle(0, 0);
    const dead = createTestParticle(10, 10);
    dead.active = false;
    g.particles = [alive, dead];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.particles.length).toBe(1);
    expect(g.particles[0]).toBe(alive);
  });

  it('removes particles that are inactive regardless of life value', () => {
    const g = createTestState();
    const particle = createTestParticle(0, 0);
    particle.active = false;
    particle.life = 0.9; // still has life but inactive
    g.particles = [particle];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.particles.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 4. Dead pickups are removed from g.pickups
 * ────────────────────────────────────────────── */
describe('dead pickups are removed', () => {
  it('removes a single dead pickup', () => {
    const g = createTestState();
    const pickup = createTestPickup(0, 0);
    pickup.active = false;
    g.pickups = [pickup];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.pickups.length).toBe(0);
  });

  it('removes dead pickups mixed with active ones', () => {
    const g = createTestState();
    const alive = createTestPickup(0, 0, 5);
    const dead = createTestPickup(10, 10, 3);
    dead.active = false;
    const alive2 = createTestPickup(20, 20, 1);
    g.pickups = [alive, dead, alive2];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.pickups.length).toBe(2);
    expect(g.pickups).toContain(alive);
    expect(g.pickups).toContain(alive2);
  });

  it('removes all dead pickups when all are inactive', () => {
    const g = createTestState();
    g.pickups = [
      { ...createTestPickup(0, 0), active: false },
      { ...createTestPickup(5, 5), active: false },
      { ...createTestPickup(10, 10), active: false },
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.pickups.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 5. Expired effects are removed from g.effects
 * ────────────────────────────────────────────── */
describe('expired effects are removed', () => {
  it('removes effects with life <= 0', () => {
    const g = createTestState();
    g.effects = [
      { type: 'dmg', text: '10', life: 0 },
      { type: 'dmg', text: '5', life: -0.5 },
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.effects.length).toBe(0);
  });

  it('keeps effects with life > 0', () => {
    const g = createTestState();
    const alive = { type: 'dmg', text: '10', life: 1.0 };
    const dead = { type: 'dmg', text: '5', life: 0 };
    g.effects = [alive, dead];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.effects.length).toBe(1);
    expect(g.effects[0]).toBe(alive);
  });

  it('keeps effects with very small positive life', () => {
    const g = createTestState();
    const effect = { type: 'dmg', text: '1', life: 0.001 };
    g.effects = [effect];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.effects.length).toBe(1);
  });

  it('removes expired effects mixed with alive ones', () => {
    const g = createTestState();
    g.effects = [
      { type: 'dmg', text: '10', life: 0.5 },
      { type: 'dmg', text: '20', life: 0 },
      { type: 'dmg', text: '30', life: 1.2 },
      { type: 'dmg', text: '40', life: -1 },
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.effects.length).toBe(2);
    expect(g.effects[0].text).toBe('10');
    expect(g.effects[1].text).toBe('30');
  });
});

/* ──────────────────────────────────────────────
 * 6. Active entities are NOT removed
 * ────────────────────────────────────────────── */
describe('active entities are preserved', () => {
  it('keeps all active enemies', () => {
    const g = createTestState();
    const e1 = createTestEnemy(0, 0);
    const e2 = createTestEnemy(10, 10, 'heavy');
    const e3 = createTestEnemy(20, 20, 'shooter');
    g.enemies = [e1, e2, e3];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.enemies.length).toBe(3);
    expect(g.enemies).toContain(e1);
    expect(g.enemies).toContain(e2);
    expect(g.enemies).toContain(e3);
  });

  it('keeps all active projectiles', () => {
    const g = createTestState();
    g.projectiles = [
      createTestProjectile(0, 0, 0),
      createTestProjectile(5, 5, Math.PI / 4),
      createTestProjectile(10, 10, Math.PI / 2, 'plasma'),
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.projectiles.length).toBe(3);
  });

  it('keeps all active particles', () => {
    const g = createTestState();
    g.particles = [
      createTestParticle(0, 0),
      createTestParticle(5, 5),
      createTestParticle(10, 10),
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.particles.length).toBe(3);
  });

  it('keeps all active pickups', () => {
    const g = createTestState();
    g.pickups = [
      createTestPickup(0, 0, 1),
      createTestPickup(5, 5, 3),
      createTestPickup(10, 10, 5),
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.pickups.length).toBe(3);
  });

  it('preserves entities across all arrays simultaneously', () => {
    const g = createTestState();
    g.enemies = [createTestEnemy(0, 0)];
    g.projectiles = [createTestProjectile(0, 0, 0)];
    g.particles = [createTestParticle(0, 0)];
    g.pickups = [createTestPickup(0, 0)];
    g.effects = [{ type: 'dmg', text: '10', life: 1.0 }];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.enemies.length).toBe(1);
    expect(g.projectiles.length).toBe(1);
    expect(g.particles.length).toBe(1);
    expect(g.pickups.length).toBe(1);
    expect(g.effects.length).toBe(1);
  });
});

/* ──────────────────────────────────────────────
 * 7. Cleanup only runs periodically (timer behavior)
 * ────────────────────────────────────────────── */
describe('periodic cleanup timer', () => {
  it('does not clean when timer has not reached interval', () => {
    const g = createTestState();
    const deadEnemy = createTestEnemy(0, 0);
    deadEnemy.active = false;
    g.enemies = [deadEnemy];

    // Call with dt less than interval
    cleanup(1.0, g);

    expect(g.enemies.length).toBe(1);
    expect(g._cleanupTimer).toBe(1.0);
  });

  it('does not clean when timer is below interval after accumulation', () => {
    const g = createTestState();
    const deadEnemy = createTestEnemy(0, 0);
    deadEnemy.active = false;
    g.enemies = [deadEnemy];

    const interval = GAME_CONFIG.cleanup.interval;

    cleanup(1.0, g);
    expect(g.enemies.length).toBe(1);
    expect(g._cleanupTimer).toBe(1.0);

    cleanup(2.0, g);
    expect(g.enemies.length).toBe(1);
    expect(g._cleanupTimer).toBe(3.0);

    cleanup(1.0, g);
    expect(g.enemies.length).toBe(1);
    expect(g._cleanupTimer).toBe(4.0);
  });

  it('cleans when timer reaches exactly the interval', () => {
    const g = createTestState();
    const deadEnemy = createTestEnemy(0, 0);
    deadEnemy.active = false;
    g.enemies = [deadEnemy];

    const interval = GAME_CONFIG.cleanup.interval;

    cleanup(interval, g);

    expect(g.enemies.length).toBe(0);
    expect(g._cleanupTimer).toBe(0);
  });

  it('cleans when timer exceeds the interval', () => {
    const g = createTestState();
    const deadEnemy = createTestEnemy(0, 0);
    deadEnemy.active = false;
    g.enemies = [deadEnemy];

    const interval = GAME_CONFIG.cleanup.interval;

    cleanup(interval + 2.0, g);

    expect(g.enemies.length).toBe(0);
    expect(g._cleanupTimer).toBe(0);
  });

  it('resets timer to 0 after cleanup fires', () => {
    const g = createTestState();
    g.enemies = [createTestEnemy(0, 0)];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g._cleanupTimer).toBe(0);
  });

  it('accumulates timer across multiple calls and cleans on threshold', () => {
    const g = createTestState();
    const deadEnemy = createTestEnemy(0, 0);
    deadEnemy.active = false;
    g.enemies = [deadEnemy];

    const interval = GAME_CONFIG.cleanup.interval;

    // Accumulate: 1 + 2 + 2 = 5 = interval
    cleanup(1.0, g);
    expect(g.enemies.length).toBe(1);
    expect(g._cleanupTimer).toBe(1.0);

    cleanup(2.0, g);
    expect(g.enemies.length).toBe(1);
    expect(g._cleanupTimer).toBe(3.0);

    cleanup(2.0, g);
    expect(g.enemies.length).toBe(0);
    expect(g._cleanupTimer).toBe(0);
  });

  it('accumulates timer across multiple calls and cleans when exceeded', () => {
    const g = createTestState();
    const deadEnemy = createTestEnemy(0, 0);
    deadEnemy.active = false;
    g.enemies = [deadEnemy];

    const interval = GAME_CONFIG.cleanup.interval;

    // Accumulate: 3 + 3 = 6 > 5
    cleanup(3.0, g);
    expect(g.enemies.length).toBe(1);
    expect(g._cleanupTimer).toBe(3.0);

    cleanup(3.0, g);
    expect(g.enemies.length).toBe(0);
    expect(g._cleanupTimer).toBe(0);
  });

  it('cleans multiple times as timer accumulates across calls', () => {
    const g = createTestState();
    const interval = GAME_CONFIG.cleanup.interval;

    // First round
    g.enemies = [{ ...createTestEnemy(0, 0), active: false }];
    cleanup(interval, g);
    expect(g.enemies.length).toBe(0);
    expect(g._cleanupTimer).toBe(0);

    // Add new dead enemy for second round
    g.enemies = [{ ...createTestEnemy(10, 10), active: false }];
    cleanup(interval, g);
    expect(g.enemies.length).toBe(0);
    expect(g._cleanupTimer).toBe(0);
  });

  it('initializes _cleanupTimer to 0 when undefined', () => {
    const g = createTestState();
    // _cleanupTimer is not set on fresh state
    expect(g._cleanupTimer).toBeUndefined();

    cleanup(1.0, g);

    expect(g._cleanupTimer).toBe(1.0);
  });

  it('uses existing _cleanupTimer value if already set', () => {
    const g = createTestState();
    g._cleanupTimer = 3.0;

    cleanup(1.0, g);

    expect(g._cleanupTimer).toBe(4.0);
  });
});

/* ──────────────────────────────────────────────
 * 8. Empty arrays are handled safely
 * ────────────────────────────────────────────── */
describe('empty arrays are handled safely', () => {
  it('does not crash when all arrays are empty', () => {
    const g = createTestState();
    // All arrays already empty by default

    expect(() => {
      cleanup(GAME_CONFIG.cleanup.interval, g);
    }).not.toThrow();

    expect(g.enemies.length).toBe(0);
    expect(g.projectiles.length).toBe(0);
    expect(g.particles.length).toBe(0);
    expect(g.pickups.length).toBe(0);
    expect(g.effects.length).toBe(0);
  });

  it('does not crash when only enemies array is empty', () => {
    const g = createTestState();
    g.projectiles = [createTestProjectile(0, 0, 0)];
    g.particles = [createTestParticle(0, 0)];
    g.pickups = [createTestPickup(0, 0)];
    g.effects = [{ type: 'dmg', text: '10', life: 1.0 }];

    expect(() => {
      cleanup(GAME_CONFIG.cleanup.interval, g);
    }).not.toThrow();

    expect(g.enemies.length).toBe(0);
  });

  it('does not crash when only projectiles array is empty', () => {
    const g = createTestState();
    g.enemies = [createTestEnemy(0, 0)];
    g.particles = [createTestParticle(0, 0)];
    g.pickups = [createTestPickup(0, 0)];

    expect(() => {
      cleanup(GAME_CONFIG.cleanup.interval, g);
    }).not.toThrow();

    expect(g.projectiles.length).toBe(0);
  });

  it('does not crash when only particles array is empty', () => {
    const g = createTestState();
    g.enemies = [createTestEnemy(0, 0)];
    g.projectiles = [createTestProjectile(0, 0, 0)];
    g.pickups = [createTestPickup(0, 0)];

    expect(() => {
      cleanup(GAME_CONFIG.cleanup.interval, g);
    }).not.toThrow();

    expect(g.particles.length).toBe(0);
  });

  it('does not crash when only pickups array is empty', () => {
    const g = createTestState();
    g.enemies = [createTestEnemy(0, 0)];
    g.projectiles = [createTestProjectile(0, 0, 0)];
    g.particles = [createTestParticle(0, 0)];

    expect(() => {
      cleanup(GAME_CONFIG.cleanup.interval, g);
    }).not.toThrow();

    expect(g.pickups.length).toBe(0);
  });

  it('does not crash when only effects array is empty', () => {
    const g = createTestState();
    g.enemies = [createTestEnemy(0, 0)];
    g.projectiles = [createTestProjectile(0, 0, 0)];
    g.particles = [createTestParticle(0, 0)];
    g.pickups = [createTestPickup(0, 0)];

    expect(() => {
      cleanup(GAME_CONFIG.cleanup.interval, g);
    }).not.toThrow();

    expect(g.effects.length).toBe(0);
  });

  it('consecutive cleanup calls on empty arrays remain safe', () => {
    const g = createTestState();

    for (let i = 0; i < 5; i++) {
      cleanup(GAME_CONFIG.cleanup.interval, g);
    }

    expect(g.enemies.length).toBe(0);
    expect(g.projectiles.length).toBe(0);
    expect(g.particles.length).toBe(0);
    expect(g.pickups.length).toBe(0);
    expect(g.effects.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 9. Mixed entity cleanup across all arrays
 * ────────────────────────────────────────────── */
describe('mixed entity cleanup across all arrays', () => {
  it('cleans dead entities from all arrays in a single call', () => {
    const g = createTestState();
    g.enemies = [
      { ...createTestEnemy(0, 0), active: true },
      { ...createTestEnemy(10, 10), active: false },
    ];
    g.projectiles = [
      { ...createTestProjectile(0, 0, 0), active: true },
      { ...createTestProjectile(5, 5, 0), active: false },
    ];
    g.particles = [
      { ...createTestParticle(0, 0), active: true },
      { ...createTestParticle(10, 10), active: false },
    ];
    g.pickups = [
      { ...createTestPickup(0, 0), active: true },
      { ...createTestPickup(10, 10), active: false },
    ];
    g.effects = [
      { type: 'dmg', text: '10', life: 1.0 },
      { type: 'dmg', text: '20', life: 0 },
    ];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.enemies.length).toBe(1);
    expect(g.projectiles.length).toBe(1);
    expect(g.particles.length).toBe(1);
    expect(g.pickups.length).toBe(1);
    expect(g.effects.length).toBe(1);
  });

  it('cleans nothing when all entities are alive', () => {
    const g = createTestState();
    g.enemies = [createTestEnemy(0, 0)];
    g.projectiles = [createTestProjectile(0, 0, 0)];
    g.particles = [createTestParticle(0, 0)];
    g.pickups = [createTestPickup(0, 0)];
    g.effects = [{ type: 'dmg', text: '10', life: 1.0 }];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.enemies.length).toBe(1);
    expect(g.projectiles.length).toBe(1);
    expect(g.particles.length).toBe(1);
    expect(g.pickups.length).toBe(1);
    expect(g.effects.length).toBe(1);
  });

  it('cleans everything when all entities are dead', () => {
    const g = createTestState();
    g.enemies = [{ ...createTestEnemy(0, 0), active: false }];
    g.projectiles = [{ ...createTestProjectile(0, 0, 0), active: false }];
    g.particles = [{ ...createTestParticle(0, 0), active: false }];
    g.pickups = [{ ...createTestPickup(0, 0), active: false }];
    g.effects = [{ type: 'dmg', text: '10', life: 0 }];

    cleanup(GAME_CONFIG.cleanup.interval, g);

    expect(g.enemies.length).toBe(0);
    expect(g.projectiles.length).toBe(0);
    expect(g.particles.length).toBe(0);
    expect(g.pickups.length).toBe(0);
    expect(g.effects.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 10. Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  it('handles dt of 0 without cleaning', () => {
    const g = createTestState();
    const deadEnemy = createTestEnemy(0, 0);
    deadEnemy.active = false;
    g.enemies = [deadEnemy];

    cleanup(0, g);

    expect(g.enemies.length).toBe(1);
    expect(g._cleanupTimer).toBe(0);
  });

  it('handles very small dt accumulating toward threshold', () => {
    const g = createTestState();
    const deadEnemy = createTestEnemy(0, 0);
    deadEnemy.active = false;
    g.enemies = [deadEnemy];

    const interval = GAME_CONFIG.cleanup.interval;
    const smallDt = 0.001;
    const callsNeeded = Math.ceil(interval / smallDt);

    for (let i = 0; i < callsNeeded - 1; i++) {
      cleanup(smallDt, g);
      expect(g.enemies.length).toBe(1);
    }

    // This call should push timer over the threshold
    cleanup(smallDt, g);
    expect(g.enemies.length).toBe(0);
  });

  it('cleanup interval matches GAME_CONFIG value', () => {
    expect(GAME_CONFIG.cleanup.interval).toBe(5.0);
  });

  it('does not modify game state other than arrays and timer when below threshold', () => {
    const g = createTestState();
    g.enemies = [createTestEnemy(0, 0)];
    g.projectiles = [createTestProjectile(0, 0, 0)];
    g.particles = [createTestParticle(0, 0)];
    g.pickups = [createTestPickup(0, 0)];
    g.effects = [{ type: 'dmg', text: '10', life: 1.0 }];

    const initialEnemy = { ...g.enemies[0] };
    const initialProj = { ...g.projectiles[0] };

    cleanup(1.0, g);

    // Entities should be unchanged
    expect(g.enemies[0].active).toBe(initialEnemy.active);
    expect(g.projectiles[0].active).toBe(initialProj.active);
    expect(g.particles.length).toBe(1);
    expect(g.pickups.length).toBe(1);
    expect(g.effects.length).toBe(1);
  });
});
