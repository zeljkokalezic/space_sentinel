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
    hazards: [],
    stats: { enemiesDestroyed: 0 },
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
    beacon: {
      active: false,
      x: 0, y: 0,
      hp: 0, maxHp: 0,
      radius: 30,
      color: 0x22d3ee,
    },
    sabotage: {
      active: false,
      structures: [],
    },
    keys: {},
    mouse: { x: 0, y: 0, active: false },
    worldMouse: { x: 0, y: 0 },
    touchId: null,
    touchBase: null,
    touchCurrent: null,
    paused: false,
    lastTime: FIXED_TIMESTAMP,
    achievementVersion: 0,
    combo: { count: 0, timer: 0, multiplier: 1 },
    powerups: [],
    activeBuffs: {},
    boss: {
      active: false,
      x: 0, y: 0,
      hp: 0, maxHp: 0,
      phase: 1,
      attackTimer: 0,
      chargeTimer: 0,
      chargeTarget: { x: 0, y: 0 },
      isCharging: false,
      radius: 60,
      speed: 60,
      fireCooldown: 1.5,
      spiralAngle: 0,
    },
    miniboss: {
      active: false,
      x: 0, y: 0,
      hp: 0, maxHp: 0,
      phase: 1,
      attackTimer: 0,
      chargeTimer: 0,
      chargeTarget: { x: 0, y: 0 },
      isCharging: false,
      radius: 40,
      speed: 50,
      fireCooldown: 1.5,
      spiralAngle: 0,
    },
  };

  // Deep-merge player overrides if provided
  if (overrides.player) {
    base.player = { ...base.player, ...overrides.player };
  }

  // Deep-merge boss overrides if provided
  if (overrides.boss) {
    base.boss = { ...base.boss, ...overrides.boss };
  }

  // Deep-merge miniboss overrides if provided
  if (overrides.miniboss) {
    base.miniboss = { ...base.miniboss, ...overrides.miniboss };
  }

  // Deep-merge hazards overrides if provided
  if (overrides.hazards) {
    base.hazards = overrides.hazards;
  }

  // Deep-merge stats overrides if provided
  if (overrides.stats) {
    base.stats = { ...base.stats, ...overrides.stats };
  }

  // Spread top-level overrides, but exclude 'player', 'boss', 'miniboss', 'hazards', 'stats' since we already merged them
  const { player: _playerOverride, boss: _bossOverride, miniboss: _minibossOverride, hazards: _hazardsOverride, stats: _statsOverride, ...restOverrides } = overrides;
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
 * Create a test power-up object.
 *
 * @param {number} x       — World X position
 * @param {number} y       — World Y position
 * @param {string} [type]  — Power-up type (default 'rapidFire')
 * @returns {object} Power-up
 */
export const createTestPowerup = (x, y, type = 'rapidFire') => {
  const GAME_CONFIG = {
    powerups: {
      types: {
        rapidFire:   { duration: 10, color: '#fbbf24', icon: '⚡' },
        shieldBoost: { duration: 15, color: '#3b82f6', icon: '🛡' },
        damageSurge: { duration: 12, color: '#ef4444', icon: '💥' },
        timeSlow:    { duration: 8,  color: '#a855f7', icon: '⏱' },
        nuke:        { duration: 0,  color: '#ffffff', icon: '☢' },
        repair:      { duration: 0,  color: '#22c55e', icon: '❤' },
      },
    },
  };
  const cfg = GAME_CONFIG.powerups.types[type] || GAME_CONFIG.powerups.types.rapidFire;
  return {
    id: Math.random(),
    x,
    y,
    type,
    active: true,
    radius: 10,
    color: cfg.color,
  };
};

/**
 * Create a test boss object.
 *
 * @param {number} x       — World X position
 * @param {number} y       — World Y position
 * @param {number} [hp]    — Boss HP (default 1500)
 * @param {number} [phase] — Boss phase (default 1)
 * @returns {object} Boss state
 */
export const createTestBoss = (x = 500, y = 500, hp = 1500, phase = 1) => ({
  active: true,
  x, y,
  hp, maxHp: 1500,
  phase,
  attackTimer: 1.5,
  chargeTimer: 5,
  chargeTarget: { x: 0, y: 0 },
  isCharging: false,
  radius: 60,
  speed: 60,
  fireCooldown: 1.5,
  spiralAngle: 0,
});

/**
 * Create a test mini-boss object.
 *
 * @param {number} x       — World X position
 * @param {number} y       — World Y position
 * @param {number} [hp]    — Mini-boss HP (default 600, ~40% of full boss)
 * @param {number} [phase] — Mini-boss phase (default 1)
 * @returns {object} Mini-boss state
 */
export const createTestMiniboss = (x = 500, y = 500, hp = 600, phase = 1) => ({
  active: true,
  x, y,
  hp, maxHp: 600,
  phase,
  attackTimer: 1.5,
  chargeTimer: 5,
  chargeTarget: { x: 0, y: 0 },
  isCharging: false,
  radius: 40,
  speed: 50,
  fireCooldown: 1.5,
  spiralAngle: 0,
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

/**
 * In-memory localStorage mock for Node test environment.
 */
let storage = {};

/**
 * Set up a mock localStorage on globalThis.
 * Call this in a `beforeEach` block in any test file that imports
 * modules using localStorage (saveManager, mission auto-save, etc.).
 */
export const setupLocalStorageMock = () => {
  storage = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key) => storage[key] ?? null,
      setItem: (key, val) => { storage[key] = String(val); },
      removeItem: (key) => { delete storage[key]; },
      clear: () => { storage = {}; },
    },
    writable: true,
    configurable: true,
  });
};

/**
 * Remove the localStorage mock and restore undefined.
 * Call this in an `afterEach` block.
 */
export const clearLocalStorageMock = () => {
  delete globalThis.localStorage;
  storage = {};
};
