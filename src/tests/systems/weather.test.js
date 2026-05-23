/**
 * weather.test.js — Weather system tests.
 *
 * Tests initWeather, updateWeather, isProjectileBlockedByDebris,
 * getProjectileSpeedMult, areWeaponsDisabled, isSolarFlareActive, resetWeather.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initWeather,
  updateWeather,
  isProjectileBlockedByDebris,
  getProjectileSpeedMult,
  areWeaponsDisabled,
  isSolarFlareActive,
  resetWeather,
} from '../../engine/systems/weather';
import { createTestState } from '../helpers';
import { updateWeapons } from '../../engine/systems/weapons';
import { updateProjectiles } from '../../engine/systems/projectiles';
import * as combat from '../../engine/combat';

// Mock SoundManager to prevent audio errors in test environment
vi.mock('../../engine/audio', () => ({
  SoundManager: { play: vi.fn() },
}));

// Mock combat module for weapons/projectiles integration tests
vi.mock('../../engine/combat', () => ({
  fireProjectile: vi.fn(),
  killEnemy: vi.fn(),
  checkShieldBreak: vi.fn(),
  spawnDamageNumber: vi.fn(),
  triggerShieldRestoration: vi.fn(),
  createParticles: vi.fn(),
  triggerScreenShake: vi.fn(),
  triggerPlayerIFrames: vi.fn(),
  checkDirectionalShield: vi.fn(),
}));

// Mock targeting
vi.mock('../../engine/targeting', () => ({
  getNearestHostileTarget: vi.fn(),
}));

// Mock weaponSynergies
vi.mock('../../engine/weaponSynergies', () => ({
  getActiveSynergies: vi.fn(() => []),
  applyPlasmaSynergy: vi.fn((d) => d),
  applyAutocannonSynergy: vi.fn((d) => d),
  applyPointDefenseSynergy: vi.fn((d) => d),
}));

// Mock dynamicFov
vi.mock('../../engine/systems/dynamicFov', () => ({
  triggerFovHit: vi.fn(),
}));

// Mock bossSignatureMechanics
vi.mock('../../engine/systems/bossSignatureMechanics', () => ({
  onBossDamaged: vi.fn(),
}));

const defaultWeather = {
  active: [],
  solarFlare: { timer: 0, active: false, remaining: 0 },
  debris: [],
  gravityZones: [],
  emi: { timer: 0, active: false, remaining: 0 },
};

/* ──────────────────────────────────────────────
 * 1. initWeather tests
 * ────────────────────────────────────────────── */
describe('initWeather', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
  });

  it('does nothing when g is null', () => {
    expect(() => initWeather(null, ['solarFlare'])).not.toThrow();
  });

  it('does nothing when g.weather is missing', () => {
    const state = createTestState();
    delete state.weather;
    expect(() => initWeather(state, ['solarFlare'])).not.toThrow();
  });

  it('initializes with empty weather types', () => {
    initWeather(g, []);
    expect(g.weather.active).toEqual([]);
    expect(g.weather.debris).toEqual([]);
    expect(g.weather.gravityZones).toEqual([]);
  });

  it('caps weather types to maxPerSector (2)', () => {
    initWeather(g, ['solarFlare', 'debrisField', 'gravityAnomaly']);
    expect(g.weather.active.length).toBeLessThanOrEqual(2);
  });

  it('filters invalid weather types', () => {
    initWeather(g, ['solarFlare', 'invalidType', 'debrisField']);
    expect(g.weather.active).not.toContain('invalidType');
  });

  it('initializes solar flare timer within range', () => {
    initWeather(g, ['solarFlare']);
    expect(g.weather.active).toContain('solarFlare');
    expect(g.weather.solarFlare.timer).toBeGreaterThanOrEqual(20);
    expect(g.weather.solarFlare.timer).toBeLessThanOrEqual(30);
    expect(g.weather.solarFlare.active).toBe(false);
  });

  it('spawns debris clusters when debrisField is active', () => {
    initWeather(g, ['debrisField']);
    expect(g.weather.active).toContain('debrisField');
    expect(g.weather.debris.length).toBe(5);
    for (const d of g.weather.debris) {
      expect(d.active).toBe(true);
      expect(d.radius).toBe(40);
    }
  });

  it('spawns gravity zones when gravityAnomaly is active', () => {
    initWeather(g, ['gravityAnomaly']);
    expect(g.weather.active).toContain('gravityAnomaly');
    expect(g.weather.gravityZones.length).toBe(3);
    for (const z of g.weather.gravityZones) {
      expect(z.active).toBe(true);
      expect(z.radius).toBe(150);
    }
  });

  it('initializes EMI timer within range', () => {
    initWeather(g, ['electromagneticInterference']);
    expect(g.weather.active).toContain('electromagneticInterference');
    expect(g.weather.emi.timer).toBeGreaterThanOrEqual(12);
    expect(g.weather.emi.timer).toBeLessThanOrEqual(18);
    expect(g.weather.emi.active).toBe(false);
  });

  it('does not spawn debris when debrisField not in active', () => {
    initWeather(g, ['solarFlare']);
    expect(g.weather.debris).toEqual([]);
  });

  it('does not spawn gravity zones when gravityAnomaly not in active', () => {
    initWeather(g, ['solarFlare']);
    expect(g.weather.gravityZones).toEqual([]);
  });
});

/* ──────────────────────────────────────────────
 * 2. Solar Flare timing tests
 * ────────────────────────────────────────────── */
describe('solar flare timing', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
    initWeather(g, ['solarFlare']);
  });

  it('flare is not active immediately after init', () => {
    expect(isSolarFlareActive(g)).toBe(false);
  });

  it('flare activates when timer expires', () => {
    g.weather.solarFlare.timer = 0.5;
    updateWeather(0.6, g);
    expect(isSolarFlareActive(g)).toBe(true);
  });

  it('flare deactivates after duration', () => {
    g.weather.solarFlare.timer = 0;
    g.weather.solarFlare.active = true;
    g.weather.solarFlare.remaining = 2;

    updateWeather(2.5, g);

    expect(g.weather.solarFlare.active).toBe(false);
    expect(isSolarFlareActive(g)).toBe(false);
  });

  it('flare not active when solarFlare not in weather.active', () => {
    g.weather.active = ['debrisField'];
    g.weather.solarFlare.active = true;
    expect(isSolarFlareActive(g)).toBe(false);
  });

  it('flare re-schedules timer after deactivation', () => {
    g.weather.solarFlare.timer = 0;
    g.weather.solarFlare.active = true;
    g.weather.solarFlare.remaining = 0.1;

    updateWeather(0.2, g);

    expect(g.weather.solarFlare.active).toBe(false);
    expect(g.weather.solarFlare.timer).toBeGreaterThan(0);
  });

  it('flare remaining decreases each tick', () => {
    g.weather.solarFlare.active = true;
    g.weather.solarFlare.remaining = 2;

    updateWeather(0.5, g);

    expect(g.weather.solarFlare.remaining).toBeCloseTo(1.5);
  });
});

/* ──────────────────────────────────────────────
 * 3. Debris field blocking tests
 * ────────────────────────────────────────────── */
describe('debris field blocking', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
  });

  it('projectile not blocked when no debris active', () => {
    g.weather.active = [];
    expect(isProjectileBlockedByDebris(0, 0, g)).toBe(false);
  });

  it('projectile blocked when inside debris cluster', () => {
    g.weather.active = ['debrisField'];
    g.weather.debris = [{
      x: 0, y: 0, radius: 40, vx: 0, vy: 0, active: true,
    }];

    expect(isProjectileBlockedByDebris(0, 0, g)).toBe(true);
  });

  it('projectile not blocked when outside debris cluster', () => {
    g.weather.active = ['debrisField'];
    g.weather.debris = [{
      x: 0, y: 0, radius: 40, vx: 0, vy: 0, active: true,
    }];

    expect(isProjectileBlockedByDebris(100, 100, g)).toBe(false);
  });

  it('inactive debris clusters do not block', () => {
    g.weather.active = ['debrisField'];
    g.weather.debris = [{
      x: 0, y: 0, radius: 40, vx: 0, vy: 0, active: false,
    }];

    expect(isProjectileBlockedByDebris(0, 0, g)).toBe(false);
  });

  it('projectile at edge of cluster is blocked', () => {
    g.weather.active = ['debrisField'];
    g.weather.debris = [{
      x: 0, y: 0, radius: 40, vx: 0, vy: 0, active: true,
    }];

    // Distance from (0,0) to (30, 20) = sqrt(900+400) = sqrt(1300) ≈ 36.06 < 40
    expect(isProjectileBlockedByDebris(30, 20, g)).toBe(true);
  });

  it('projectile just outside cluster is not blocked', () => {
    g.weather.active = ['debrisField'];
    g.weather.debris = [{
      x: 0, y: 0, radius: 40, vx: 0, vy: 0, active: true,
    }];

    // Distance from (0,0) to (40, 30) = 50 > 40
    expect(isProjectileBlockedByDebris(40, 30, g)).toBe(false);
  });

  it('checks all debris clusters', () => {
    g.weather.active = ['debrisField'];
    g.weather.debris = [
      { x: 0, y: 0, radius: 40, vx: 0, vy: 0, active: true },
      { x: 200, y: 200, radius: 40, vx: 0, vy: 0, active: true },
    ];

    expect(isProjectileBlockedByDebris(0, 0, g)).toBe(true);
    expect(isProjectileBlockedByDebris(200, 200, g)).toBe(true);
    expect(isProjectileBlockedByDebris(100, 100, g)).toBe(false);
  });

  it('debris clusters move each tick', () => {
    g.weather.active = ['debrisField'];
    g.weather.debris = [{
      x: 0, y: 0, radius: 40, vx: 50, vy: 0, active: true,
    }];

    updateWeather(0.1, g);

    expect(g.weather.debris[0].x).toBeCloseTo(5); // 0 + 50 * 0.1
    expect(g.weather.debris[0].y).toBeCloseTo(0);
  });

  it('debris clusters bounce off world bounds', () => {
    g.weather.active = ['debrisField'];
    g.weather.debris = [{
      x: 3980, y: 0, radius: 40, vx: 50, vy: 0, active: true,
    }];

    updateWeather(1, g);

    // Should bounce off bound at 4000 and reverse direction
    expect(g.weather.debris[0].x).toBeLessThanOrEqual(4000);
    expect(g.weather.debris[0].vx).toBeLessThan(0);
  });
});

/* ──────────────────────────────────────────────
 * 4. Gravity anomaly slowdown tests
 * ────────────────────────────────────────────── */
describe('gravity anomaly slowdown', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
  });

  it('speed mult is 1 when no gravity anomaly active', () => {
    g.weather.active = [];
    expect(getProjectileSpeedMult(0, 0, g)).toBe(1);
  });

  it('speed mult is 0.5 when inside gravity zone', () => {
    g.weather.active = ['gravityAnomaly'];
    g.weather.gravityZones = [{
      x: 0, y: 0, radius: 150, respawnTimer: 0, active: true,
    }];

    expect(getProjectileSpeedMult(0, 0, g)).toBe(0.5);
  });

  it('speed mult is 1 when outside gravity zone', () => {
    g.weather.active = ['gravityAnomaly'];
    g.weather.gravityZones = [{
      x: 0, y: 0, radius: 150, respawnTimer: 0, active: true,
    }];

    expect(getProjectileSpeedMult(300, 300, g)).toBe(1);
  });

  it('inactive gravity zones do not slow projectiles', () => {
    g.weather.active = ['gravityAnomaly'];
    g.weather.gravityZones = [{
      x: 0, y: 0, radius: 150, respawnTimer: 0, active: false,
    }];

    expect(getProjectileSpeedMult(0, 0, g)).toBe(1);
  });

  it('checks all gravity zones and returns slowdown if any match', () => {
    g.weather.active = ['gravityAnomaly'];
    g.weather.gravityZones = [
      { x: 0, y: 0, radius: 150, respawnTimer: 0, active: true },
      { x: 500, y: 500, radius: 150, respawnTimer: 0, active: true },
    ];

    expect(getProjectileSpeedMult(0, 0, g)).toBe(0.5);
    expect(getProjectileSpeedMult(500, 500, g)).toBe(0.5);
    expect(getProjectileSpeedMult(250, 250, g)).toBe(1);
  });

  it('gravity zones drift slightly each tick', () => {
    g.weather.active = ['gravityAnomaly'];
    g.weather.gravityZones = [{
      x: 100, y: 100, radius: 150, respawnTimer: 0, active: true,
    }];

    updateWeather(0.1, g);

    // Zone should drift (small random movement)
    expect(g.weather.gravityZones[0].x).toBeCloseTo(100, 0); // within ~0.25 units
    expect(g.weather.gravityZones[0].y).toBeCloseTo(100, 0);
  });

  it('gravity zones respawn after interval', () => {
    g.weather.active = ['gravityAnomaly'];
    g.weather.gravityZones = [{
      x: 100, y: 100, radius: 150, respawnTimer: 19.9, active: true,
    }];

    updateWeather(0.5, g);

    // respawnTimer was 19.9 + 0.5 = 20.4 >= 20, so zone repositions
    expect(g.weather.gravityZones[0].respawnTimer).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 5. EMI disable tests
 * ────────────────────────────────────────────── */
describe('electromagnetic interference', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
    initWeather(g, ['electromagneticInterference']);
  });

  it('weapons not disabled immediately after init', () => {
    expect(areWeaponsDisabled(g)).toBe(false);
  });

  it('weapons disabled when EMI activates', () => {
    g.weather.emi.timer = 0.5;
    updateWeather(0.6, g);
    expect(areWeaponsDisabled(g)).toBe(true);
  });

  it('weapons re-enabled after EMI duration', () => {
    g.weather.emi.active = true;
    g.weather.emi.remaining = 1;

    updateWeather(1.5, g);

    expect(areWeaponsDisabled(g)).toBe(false);
  });

  it('EMI not active when not in weather.active', () => {
    g.weather.active = ['solarFlare'];
    g.weather.emi.active = true;
    expect(areWeaponsDisabled(g)).toBe(false);
  });

  it('EMI re-schedules timer after deactivation', () => {
    g.weather.emi.active = true;
    g.weather.emi.remaining = 0.1;

    updateWeather(0.2, g);

    expect(g.weather.emi.active).toBe(false);
    expect(g.weather.emi.timer).toBeGreaterThan(0);
  });

  it('EMI remaining decreases each tick', () => {
    g.weather.emi.active = true;
    g.weather.emi.remaining = 1;

    updateWeather(0.3, g);

    expect(g.weather.emi.remaining).toBeCloseTo(0.7);
  });
});

/* ──────────────────────────────────────────────
 * 6. resetWeather tests
 * ────────────────────────────────────────────── */
describe('resetWeather', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
  });

  it('does nothing when g is null', () => {
    expect(() => resetWeather(null)).not.toThrow();
  });

  it('does nothing when g.weather is missing', () => {
    const state = createTestState();
    delete state.weather;
    expect(() => resetWeather(state)).not.toThrow();
  });

  it('clears all active weather types', () => {
    initWeather(g, ['solarFlare', 'debrisField']);
    resetWeather(g);
    expect(g.weather.active).toEqual([]);
  });

  it('resets solar flare state', () => {
    g.weather.solarFlare = { timer: 10, active: true, remaining: 5 };
    resetWeather(g);
    expect(g.weather.solarFlare.timer).toBe(0);
    expect(g.weather.solarFlare.active).toBe(false);
    expect(g.weather.solarFlare.remaining).toBe(0);
  });

  it('clears debris clusters', () => {
    g.weather.debris = [
      { x: 0, y: 0, radius: 40, vx: 0, vy: 0, active: true },
      { x: 100, y: 100, radius: 40, vx: 0, vy: 0, active: true },
    ];
    resetWeather(g);
    expect(g.weather.debris).toEqual([]);
  });

  it('clears gravity zones', () => {
    g.weather.gravityZones = [
      { x: 0, y: 0, radius: 150, respawnTimer: 0, active: true },
    ];
    resetWeather(g);
    expect(g.weather.gravityZones).toEqual([]);
  });

  it('resets EMI state', () => {
    g.weather.emi = { timer: 15, active: true, remaining: 0.5 };
    resetWeather(g);
    expect(g.weather.emi.timer).toBe(0);
    expect(g.weather.emi.active).toBe(false);
    expect(g.weather.emi.remaining).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 7. updateWeather early return tests
 * ────────────────────────────────────────────── */
describe('updateWeather early returns', () => {
  it('does nothing when g is null', () => {
    expect(() => updateWeather(0.1, null)).not.toThrow();
  });

  it('does nothing when g.weather is missing', () => {
    const state = createTestState();
    delete state.weather;
    expect(() => updateWeather(0.1, state)).not.toThrow();
  });

  it('does nothing when no weather types active', () => {
    const g = createTestState({ weather: { ...defaultWeather } });
    g.weather.active = [];
    expect(() => updateWeather(0.1, g)).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * 8. Combined weather update tests
 * ────────────────────────────────────────────── */
describe('combined weather updates', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
  });

  it('updates multiple weather types simultaneously', () => {
    initWeather(g, ['solarFlare', 'debrisField']);

    g.weather.solarFlare.timer = 0.5;
    updateWeather(0.6, g);

    // Solar flare should activate
    expect(g.weather.solarFlare.active).toBe(true);
    // Debris should have moved
    expect(g.weather.debris.length).toBe(5);
  });

  it('handles all four weather types together', () => {
    // Force maxPerSector to allow more for this test
    initWeather(g, ['solarFlare', 'debrisField', 'gravityAnomaly', 'electromagneticInterference']);
    // Since maxPerSector is 2, only 2 will be active
    expect(g.weather.active.length).toBeLessThanOrEqual(2);
  });
});

/* ──────────────────────────────────────────────
 * 9. Integration: EMI disables weapons
 * ────────────────────────────────────────────── */
describe('integration: EMI disables weapons', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
    initWeather(g, ['electromagneticInterference']);
  });

  it('fireProjectile is called when EMI is not active', () => {
    combat.fireProjectile.mockClear();
    g.cooldowns.autocannon = 0;
    g.levels.autocannon = 1;
    g.player.aimAngle = 0;

    updateWeapons(0.016, g, () => {});

    expect(combat.fireProjectile).toHaveBeenCalled();
  });

  it('fireProjectile is NOT called when EMI is active', () => {
    combat.fireProjectile.mockClear();
    // Activate EMI
    g.weather.emi.timer = 0;
    g.weather.emi.active = true;
    g.weather.emi.remaining = 5;

    g.cooldowns.autocannon = 0;
    g.levels.autocannon = 1;
    g.player.aimAngle = 0;

    updateWeapons(0.016, g, () => {});

    expect(combat.fireProjectile).not.toHaveBeenCalled();
  });

  it('fireProjectile is called again after EMI ends', () => {
    combat.fireProjectile.mockClear();
    // Activate then deactivate EMI
    g.weather.emi.active = true;
    g.weather.emi.remaining = 0.5;

    // Update weather to end EMI
    updateWeather(1, g);

    expect(areWeaponsDisabled(g)).toBe(false);

    g.cooldowns.autocannon = 0;
    g.levels.autocannon = 1;
    g.player.aimAngle = 0;

    updateWeapons(0.016, g, () => {});

    expect(combat.fireProjectile).toHaveBeenCalled();
  });
});

/* ──────────────────────────────────────────────
 * 10. Integration: Debris blocks projectiles
 * ────────────────────────────────────────────── */
describe('integration: debris blocks projectiles', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
    g.weather.active = ['debrisField'];
    // Place debris so projectile lands inside it after movement
    // Projectile starts at x:200, moves 700*0.5=350 → new x:550
    // Debris at x:550 with radius 60 covers x:490 to x:610 → includes x:550 ✓
    g.weather.debris = [{
      x: 550, y: 0, radius: 60, vx: 0, vy: 0, active: true,
    }];
  });

  it('projectile is deactivated when entering debris cluster', () => {
    // Create a projectile heading toward the debris
    g.projectiles = [{
      id: 'p1',
      x: 200, y: 0,
      vx: 700, vy: 0,
      radius: 5,
      damage: 10,
      type: 'autocannon',
      active: true,
      pierce: 0,
      hitList: [],
      life: 0,
      target: null,
      isEnemy: false,
    }];

    updateProjectiles(0.5, g, () => {});

    // Projectile should have been deactivated by debris
    expect(g.projectiles[0].active).toBe(false);
  });

  it('projectile passes when no debris in path', () => {
    g.projectiles = [{
      id: 'p1',
      x: 0, y: 500,
      vx: 700, vy: 0,
      radius: 5,
      damage: 10,
      type: 'autocannon',
      active: true,
      pierce: 0,
      hitList: [],
      life: 0,
      target: null,
      isEnemy: false,
    }];

    updateProjectiles(0.1, g, () => {});

    // Projectile should still be active (at y:500, debris at y:0)
    expect(g.projectiles[0].active).toBe(true);
  });

  it('createParticles is called when projectile blocked by debris', () => {
    combat.createParticles.mockClear();
    g.projectiles = [{
      id: 'p1',
      x: 200, y: 0,
      vx: 700, vy: 0,
      radius: 5,
      damage: 10,
      type: 'autocannon',
      active: true,
      pierce: 0,
      hitList: [],
      life: 0,
      target: null,
      isEnemy: false,
    }];

    updateProjectiles(0.5, g, () => {});

    // Should have called createParticles for debris impact
    expect(combat.createParticles).toHaveBeenCalled();
  });
});

/* ──────────────────────────────────────────────
 * 11. Integration: Gravity anomaly slows projectiles
 * ────────────────────────────────────────────── */
describe('integration: gravity anomaly slows projectiles', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
    g.weather.active = ['gravityAnomaly'];
    // Place gravity zone so projectile at x:0 is inside it
    // Zone at (50, 0) with radius 100: distance from (0,0) to (50,0) = 50 < 100 ✓
    g.weather.gravityZones = [{
      x: 50, y: 0, radius: 100, respawnTimer: 0, active: true,
    }];
  });

  it('projectile moves slower inside gravity zone', () => {
    g.projectiles = [{
      id: 'p1',
      x: 0, y: 0,
      vx: 700, vy: 0,
      radius: 5,
      damage: 10,
      type: 'autocannon',
      active: true,
      pierce: 0,
      hitList: [],
      life: 0,
      target: null,
      isEnemy: false,
    }];

    updateProjectiles(0.1, g, () => {});

    // With 0.5 speed mult: 700 * 0.1 * 0.5 = 35
    // Without slowdown: 700 * 0.1 = 70
    expect(g.projectiles[0].x).toBeCloseTo(35, 0);
  });

  it('projectile moves at normal speed outside gravity zone', () => {
    g.projectiles = [{
      id: 'p1',
      x: 500, y: 500,
      vx: 700, vy: 0,
      radius: 5,
      damage: 10,
      type: 'autocannon',
      active: true,
      pierce: 0,
      hitList: [],
      life: 0,
      target: null,
      isEnemy: false,
    }];

    updateProjectiles(0.1, g, () => {});

    // Normal speed: 700 * 0.1 = 70
    expect(g.projectiles[0].x).toBeCloseTo(570, 0);
  });
});

/* ──────────────────────────────────────────────
 * 12. Integration: updateWeather in physics loop
 * ────────────────────────────────────────────── */
describe('integration: updateWeather in physics loop', () => {
  let g;

  beforeEach(() => {
    g = createTestState({ weather: { ...defaultWeather } });
  });

  it('updateWeather is called and updates solar flare timer', () => {
    initWeather(g, ['solarFlare']);
    const initialTimer = g.weather.solarFlare.timer;

    updateWeather(1, g);

    expect(g.weather.solarFlare.timer).toBeLessThan(initialTimer);
  });

  it('updateWeather is called and updates debris positions', () => {
    initWeather(g, ['debrisField']);
    const initialX = g.weather.debris[0].x;
    const initialVx = g.weather.debris[0].vx;

    updateWeather(1, g);

    // Debris should have moved if it has velocity
    if (Math.abs(initialVx) > 0) {
      expect(g.weather.debris[0].x).not.toBe(initialX);
    }
  });

  it('updateWeather is called and updates gravity zone positions', () => {
    initWeather(g, ['gravityAnomaly']);
    const initialRespawnTimer = g.weather.gravityZones[0].respawnTimer;

    updateWeather(1, g);

    expect(g.weather.gravityZones[0].respawnTimer).toBeGreaterThan(initialRespawnTimer);
  });

  it('updateWeather does not throw when weather is not initialized', () => {
    expect(() => updateWeather(0.016, g)).not.toThrow();
  });
});
