/**
 * Test helpers for Space Sentinel engine.
 *
 * Factories create objects matching the exact shape the engine expects.
 * Import these in any *.test.js file inside src/tests/.
 */

/**
 * Fixed timestamp used as the base for `lastTime` so that delta-time
 * calculations are deterministic across test runs.
 */
const FIXED_TIMESTAMP = 1700000000; // arbitrary epoch, ms

/**
 * Create a minimal but complete game state suitable for unit tests.
 *
 * Uses a fixed `lastTime` so that `dt = performance.now() - lastTime`
 * is predictable when tests call `performance.now()` (or a mock of it).
 *
 * Override any field by passing a second object that is shallow-merged
 * into the result.
 *
 * @param {object} [overrides] — fields to merge into the default state
 * @returns {object} Game state
 */
export const createTestState = (overrides = {}) => {
  const base = {
    player: {
      x: 0, y: 0, vx: 0, vy: 0, radius: 38,
      hp: 300, maxHp: 300,
      shield: 20, maxShield: 20,
      speed: 120, magnetRadius: 150,
      yaw: Math.PI / 2,
    },
    scrap: 200,
    totalScrapEarned: 0,
    wave: 1,
    totalTime: 0,
    level: 1,
    mission: null,
    map: { nodes: [], edges: [] },
    spawnCooldown: 2,
    enemies: [],
    projectiles: [],
    particles: [],
    pickups: [],
    effects: [],
    stars: [],
    levels: {
      autocannon: 1, plasma: 0, missiles: 0,
      hull: 1, shield: 1, thrusters: 1,
      magnet: 1, pointDefense: 0, autoAim: 0,
    },
    cooldowns: {
      autocannon: 0, plasma: 0, missiles: 0,
      pointDefense: 0, shieldRegen: 0,
    },
    escort: {
      active: false,
      x: 0, y: 0,
      targetX: 0, targetY: 0,
      hp: 0, maxHp: 0,
      speed: 80,
      radius: 20,
      lives: 1,
      evasionAngle: 0,
      evasionTimer: 0,
      respawnTimer: 0,
    },
    keys: {},
    mouse: { x: 0, y: 0, active: false },
    worldMouse: { x: 0, y: 0 },
    touchId: null,
    touchBase: null,
    touchCurrent: null,
    lastTime: FIXED_TIMESTAMP,
  };

  // Deep-merge player overrides if provided
  if (overrides.player) {
    base.player = { ...base.player, ...overrides.player };
  }

  // Spread top-level overrides, but exclude 'player' since we already merged it
  const { player: _playerOverride, ...restOverrides } = overrides;
  return { ...base, ...restOverrides };
};

/**
 * Create a test enemy object.
 *
 * @param {number} x       — World X position
 * @param {number} y       — World Y position
 * @param {string} [type]  — Enemy type: 'fighter' | 'heavy' | 'shooter' |
 *                          'interceptor' | 'shielded' | 'missile_boat'
 * @returns {object} Enemy
 */
export const createTestEnemy = (x, y, type = 'fighter') => {
  const defaults = {
    id: Math.random(),
    x,
    y,
    hp: 30,
    maxHp: 30,
    shield: 0,
    maxShield: 0,
    speed: 100,
    radius: 15,
    color: 0xef4444,
    type,
    active: true,
    fireCooldown: 0,
  };

  // Pre-bake common type configs so tests don't need to override manually
  const typeConfigs = {
    fighter: {},
    heavy: { hp: 100, maxHp: 100, speed: 50, radius: 25, color: 0xf97316 },
    shooter: { hp: 40, maxHp: 40, speed: 80, radius: 16, color: 0xa855f7, fireCooldown: 1.5 },
    interceptor: { hp: 15, maxHp: 15, speed: 200, radius: 12, color: 0xeab308 },
    shielded: { hp: 40, maxHp: 40, speed: 60, radius: 18, color: 0x3b82f6, shield: 80, maxShield: 80 },
    missile_boat: { hp: 60, maxHp: 60, speed: 40, radius: 22, color: 0xd946ef, fireCooldown: 3.0 },
  };

  return { ...defaults, ...(typeConfigs[type] || {}) };
};

/**
 * Create a test projectile object.
 *
 * @param {number} x       — World X position
 * @param {number} y       — World Y position
 * @param {number} angle   — Launch angle in radians
 * @param {string} [type]  — Projectile type: 'autocannon' | 'plasma' |
 *                          'missile' | 'enemy_bullet' | 'enemy_missile'
 * @returns {object} Projectile
 */
export const createTestProjectile = (x, y, angle, type = 'autocannon') => {
  const speed = 700;
  const isEnemy = type.startsWith('enemy');
  const radius = type === 'plasma' ? 12 : (type === 'missile' || type === 'enemy_missile' ? 8 : 5);

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    damage: 10,
    type,
    active: true,
    pierce: 0,
    hitList: [],
    life: 0,
    target: null,
    isEnemy,
  };
};

/**
 * Create a test particle object.
 *
 * @param {number} x       — World X position
 * @param {number} y       — World Y position
 * @returns {object} Particle
 */
export const createTestParticle = (x, y) => ({
  x,
  y,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 1.0,
  maxLife: 1.0,
  color: 0xffffff,
  active: true,
});

/**
 * Create a test pickup (scrap) object.
 *
 * @param {number} x       — World X position
 * @param {number} y       — World Y position
 * @param {number} [value] — Scrap value (default 1)
 * @returns {object} Pickup
 */
export const createTestPickup = (x, y, value = 1) => ({
  x,
  y,
  value,
  active: true,
  radius: 6,
});

/**
 * Return the fixed timestamp constant for use in mocking `performance.now()`.
 *
 * Example:
 *   vi.spyOn(performance, 'now').mockReturnValue(FIXED_TIMESTAMP + 16);
 *
 * @returns {number}
 */
export const getFixedTimestamp = () => FIXED_TIMESTAMP;
