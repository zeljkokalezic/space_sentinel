/**
 * state.js — Game state factory and type contract.
 *
 * Every piece of live game state flows through createGameState().
 * This is the single source of truth for what fields exist and their defaults.
 *
 * @typedef {Object} GameState
 * @property {Object} player    — Player ship state
 * @property {number} player.x  — World X position
 * @property {number} player.y  — World Y position
 * @property {number} player.vx — Velocity X
 * @property {number} player.vy — Velocity Y
 * @property {number} player.radius  — Collision radius
 * @property {number} player.hp  — Current hull points
 * @property {number} player.maxHp — Maximum hull points
 * @property {number} player.shield — Current shield points
 * @property {number} player.maxShield — Maximum shield points
 * @property {number} player.speed — Base movement speed
 * @property {number} player.magnetRadius — Base scrap magnet radius
 * @property {number} player.yaw — Ship facing angle (radians)
 * @property {number} [player.aimAngle] — Turret aim angle (radians)
 * @property {number} scrap — Current scrap currency
 * @property {number} totalScrapEarned — Lifetime scrap collected
 * @property {number} wave — Current wave number
 * @property {number} totalTime — Mission elapsed time (seconds)
 * @property {number} level — Current player level
 * @property {Object|null} mission — Active mission descriptor
 * @property {string} mission.type — 'kill' | 'collect' | 'survive' | 'escort' | 'kill_elite' | 'kill_boss' | 'defend'
 * @property {number} mission.target — Target value to complete mission
 * @property {number} mission.current — Current progress toward target
 * @property {string} mission.title — Display title
 * @property {number} mission.reward — Scrap reward on completion
 * @property {boolean} [mission.completed] — Whether this mission has been completed
 * @property {Object} map — Sector map state (from generateMap)
 * @property {number} spawnCooldown — Time until next enemy spawn
 * @property {Array} enemies — Active enemy pool
 * @property {Array} projectiles — Active projectile pool
 * @property {Array} particles — Active particle pool
 * @property {Array} pickups — Active scrap pickup pool
 * @property {Array} effects — Active visual effect pool
 * @property {Array} stars — Star field particles
 * @property {Object} levels — Upgrade levels
 * @property {Object} cooldowns — Weapon/system cooldown timers
 * @property {Object} escort — Escort drone state
 * @property {Object} beacon — Beacon state for defend missions
 * @property {Object} sabotage — Sabotage state (enemy structures to destroy)
 * @property {Object} keys — Keyboard input state
 * @property {Object} mouse — Mouse input state
 * @property {Object} worldMouse — Mouse position in world coords
 * @property {number|null} [transitionTimer] — Post-mission countdown
 * @property {boolean} [isVictory] — Whether current transition is a victory
 * @property {boolean} [devMode] — Whether running in dev mode
 * @property {number} lastTime — Last frame timestamp (performance.now())
 * @property {number} [touchId] — Active touch pointer ID
 * @property {Object|null} [touchBase] — Touch joystick base position
 * @property {Object|null} [touchCurrent] — Touch joystick current position
 * @property {number} [_cleanupTimer] — Internal cleanup interval timer
 */

import { generateMap } from './mapGenerator';

/**
 * Creates a fresh game state object with all default values.
 * @returns {GameState}
 */
export const createGameState = () => ({
  player: {
    x: 0, y: 0, vx: 0, vy: 0, radius: 38,
    hp: 300, maxHp: 300,
    shield: 20, maxShield: 20,
    speed: 120, magnetRadius: 150,
    yaw: Math.PI / 2,
  },
  scrap: 200, totalScrapEarned: 0,
  wave: 1, totalTime: 0, level: 1, mission: null,
  map: generateMap(),
  spawnCooldown: 2,
  enemies: [], projectiles: [], particles: [], pickups: [], effects: [],
  stars: Array.from({ length: 800 }, () => ({
    x: (Math.random() - 0.5) * 8000,
    y: (Math.random() - 0.5) * 8000,
    z: -Math.random() * 500,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 80 + 20,
  })),
  levels: { autocannon: 1, plasma: 0, missiles: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1, pointDefense: 0, autoAim: 0 },
  cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
  escort: createDefaultEscort(),
  beacon: createDefaultBeacon(),
  sabotage: createDefaultSabotage(),
  keys: {}, mouse: { x: 0, y: 0, active: false }, worldMouse: { x: 0, y: 0 },
  touchId: null, touchBase: null, touchCurrent: null,
  devMode: false,
  lastTime: typeof performance !== 'undefined' ? performance.now() : 0,
});

/**
 * @returns {Object} Default escort drone state
 */
export const createDefaultEscort = () => ({
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
});

/**
 * @returns {Object} Default beacon state for defend missions
 */
export const createDefaultBeacon = () => ({
  active: false,
  x: 0, y: 0,
  hp: 0, maxHp: 0,
  radius: 30,
  color: 0x22d3ee,
});

/**
 * @returns {Object} Default sabotage state (enemy structures to destroy)
 */
export const createDefaultSabotage = () => ({
  active: false,
  structures: [], // { x, y, hp, maxHp, radius, fireCooldown, active }
});
