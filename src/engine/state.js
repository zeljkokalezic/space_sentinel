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
 * @property {boolean} [paused] — Whether the game is currently paused
 * @property {number} lastTime — Last frame timestamp (performance.now())
 * @property {number} [touchId] — Active touch pointer ID
 * @property {Object|null} [touchBase] — Touch joystick base position
 * @property {Object|null} [touchCurrent] — Touch joystick current position
 * @property {Object} audio — Audio system state
 * @property {boolean} audio.muted — Whether audio is muted
 * @property {number} audio.volume — Master volume (0.0–1.0)
 * @property {number} [_cleanupTimer] — Internal cleanup interval timer
 * @property {Object} [settings] — Display/gameplay settings
 * @property {boolean} settings.showFPS — Show FPS counter
 * @property {boolean} settings.screenShake — Enable screen shake
 * @property {string} settings.particlesQuality — 'low'|'medium'|'high'
 * @property {boolean} settings.reducedMotion — Reduce animations
 * @property {boolean} settings.highContrast — High contrast mode
 * @property {Object} [achievements] — Achievement tracking state
 * @property {Set} achievements.unlocked — Unlocked achievement IDs
 * @property {Array} achievements.notifications — Pending achievement notifications
 * @property {number} [achievementVersion] — Bumps when notifications change (triggers React render)
 * @property {Object} [stats] — Persistent game statistics
 * @property {number} stats.enemiesDestroyed — Total enemies destroyed
 * @property {number} stats.totalScrap — Total scrap earned
 * @property {number} stats.surviveMissions — Survive missions completed
 * @property {number} stats.escortMissions — Escort missions completed
 * @property {number} stats.defendMissions — Defend missions completed
 * @property {number} stats.sabotageMissions — Sabotage missions completed
 * @property {number} stats.bossesDefeated — Bosses defeated
 * @property {number} stats.upgradesMaxed — Number of upgrade types maxed
 * @property {Object} combo — Combo/kill streak state
 * @property {number} combo.count — Current combo count
 * @property {number} combo.timer — Remaining combo timer (seconds)
 * @property {number} combo.multiplier — Current scrap multiplier (1-3)
 * @property {Array} powerups — Active power-up drops
 * @property {Object} activeBuffs — Active temporary buffs { type: { timer, applied } }
 * @property {Object} waveAnnounce — Wave announcement state
 * @property {boolean} waveAnnounce.active — Whether announcement is active
 * @property {number} waveAnnounce.wave — Upcoming wave number shown in announcement (starts at 2)
 * @property {number} waveAnnounce.timer — Remaining announcement time (seconds)
 * @property {number} waveCount — Total waves completed (0 = first wave in progress)
 * @property {number} enemiesSpawnedThisWave — Enemies spawned in current wave
 * @property {Object} boss — Boss fight state
 * @property {boolean} boss.active — Whether boss is active
 * @property {number} boss.x — Boss world X position
 * @property {number} boss.y — Boss world Y position
 * @property {number} boss.hp — Current boss HP
 * @property {number} boss.maxHp — Maximum boss HP
 * @property {number} boss.phase — Current phase (1-3)
 * @property {number} boss.attackTimer — Attack cooldown timer
 * @property {number} boss.chargeTimer — Charge attack timer
 * @property {Object} boss.chargeTarget — Current charge target {x, y}
 * @property {boolean} boss.isCharging — Whether boss is currently charging
 * @property {number} boss.radius — Boss collision radius
 * @property {number} boss.speed — Boss movement speed
 * @property {number} boss.fireCooldown — Time between attacks
 * @property {number} boss.spiralAngle — Current spiral shot angle
 * @property {Object} miniboss — Mini-boss fight state (same structure as boss)
 * @property {boolean} miniboss.active
 * @property {number} miniboss.x — Mini-boss world X position
 * @property {number} miniboss.y — Mini-boss world Y position
 * @property {number} miniboss.hp — Current mini-boss HP
 * @property {number} miniboss.maxHp — Maximum mini-boss HP
 * @property {number} miniboss.phase — Current phase (1-3)
 * @property {number} miniboss.attackTimer — Attack cooldown timer
 * @property {number} miniboss.chargeTimer — Charge attack timer
 * @property {Object} miniboss.chargeTarget — Current charge target {x, y}
 * @property {boolean} miniboss.isCharging — Whether mini-boss is currently charging
 * @property {number} miniboss.radius — Mini-boss collision radius (40)
 * @property {number} miniboss.speed — Mini-boss movement speed
 * @property {number} miniboss.fireCooldown — Time between attacks
 * @property {number} miniboss.spiralAngle — Current spiral shot angle
 * @property {Array} hazards — Environmental hazard entities
 * @property {string} hazards[].type — 'asteroid' | 'gravityWell' | 'plasmaStorm' | 'emp'
 * @property {number} hazards[].x — World X position
 * @property {number} hazards[].y — World Y position
 * @property {number} hazards[].radius — Collision/effect radius
 * @property {boolean} hazards[].active — Whether hazard is currently active
 * @property {number} [hazards[].vx] — Velocity X (plasma storm)
 * @property {number} [hazards[].vy] — Velocity Y (plasma storm)
 * @property {number} [hazards[].timer] — Timer for storm lifetime or EMP cooldown
 * @property {number} [hazards[].empActive] — Whether EMP is currently active (0/1)
 * @property {Array} deathPulses — Active death pulse shockwave rings
 * @property {number} deathPulses[].x — World X position (origin of pulse)
 * @property {number} deathPulses[].y — World Y position (origin of pulse)
 * @property {number} deathPulses[].radius — Current ring radius
 * @property {number} deathPulses[].maxRadius — Maximum ring radius
 * @property {number} deathPulses[].damage — Damage to entities within ring
 * @property {number} deathPulses[].life — Remaining pulse lifetime
 * @property {number} deathPulses[].maxLife — Total pulse lifetime
 * @property {number} deathPulses[].color — Ring color (hex)
 * @property {boolean} deathPulses[].active — Whether pulse is active
 * @property {boolean} deathPulses[].hasDamagedPlayer — Whether player was already hit
 * @property {Array} attackWarnings — Active attack warning indicators
 * @property {number} attackWarnings[].x — World X position (predicted impact)
 * @property {number} attackWarnings[].y — World Y position (predicted impact)
 * @property {number} attackWarnings[].radius — Warning indicator radius
 * @property {number} attackWarnings[].life — Remaining warning time
 * @property {number} attackWarnings[].maxLife — Total warning duration
 * @property {string} attackWarnings[].color — Warning color (hex string)
 * @property {boolean} attackWarnings[].active — Whether warning is active
 * @property {function} attackWarnings[].fireCallback — Function to call when warning expires (fires the projectile)
 * @property {number} shipSkin — Active skin index (0-4)
 * @property {boolean[]} unlockedSkins — Which skins are unlocked
 */

import { generateMap } from './mapGenerator';
import { loadAchievements } from './achievements';
import { loadSettings } from './settings';
import { SHIP_SKINS } from '../constants/skins';

/**
 * Creates a fresh game state object with all default values.
 * @returns {GameState}
 */
export const createGameState = () => ({
  achievements: {
    unlocked: loadAchievements(),
    notifications: [],
  },
  achievementVersion: 0,
  stats: {
    enemiesDestroyed: 0,
    totalScrap: 0,
    surviveMissions: 0,
    escortMissions: 0,
    defendMissions: 0,
    sabotageMissions: 0,
    bossesDefeated: 0,
    minibossesDefeated: 0,
    upgradesMaxed: 0,
  },
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
  paused: false,
  audio: { muted: false, volume: 0.5 },
  combo: { count: 0, timer: 0, multiplier: 1 },
  screenFlash: { active: false, remaining: 0, color: '#ffffff' },
  powerups: [],
  activeBuffs: {},
  waveAnnounce: { active: false, wave: 1, timer: 0 },
  waveCount: 0,
  enemiesSpawnedThisWave: 0,
  boss: createDefaultBoss(),
  miniboss: createDefaultMiniboss(),
  hazards: [],
  deathPulses: [],
  settings: loadSettings(),
  shipSkin: 0,
  unlockedSkins: SHIP_SKINS.map(s => s.cost === 0),
  screenShake: createDefaultScreenShake(),
  lowHpWarning: createDefaultLowHpWarning(),
  hitStop: createDefaultHitStop(),
  playerIFrames: createDefaultPlayerIFrames(),
  attackWarnings: [],
  dynamicFov: createDefaultDynamicFov(),
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

/**
 * @returns {Object} Default boss state
 */
export const createDefaultBoss = () => ({
  active: false,
  x: 0, y: 0,
  hp: 0, maxHp: 0,
  shield: 0, maxShield: 0,
  phase: 1,
  attackTimer: 0,
  chargeTimer: 0,
  chargeTarget: { x: 0, y: 0 },
  isCharging: false,
  radius: 60,
  speed: 60,
  fireCooldown: 1.5,
  spiralAngle: 0,
});

/**
 * @returns {Object} Default mini-boss state
 */
export const createDefaultMiniboss = () => ({
  active: false,
  x: 0, y: 0,
  hp: 0, maxHp: 0,
  shield: 0, maxShield: 0,
  phase: 1,
  attackTimer: 0,
  chargeTimer: 0,
  chargeTarget: { x: 0, y: 0 },
  isCharging: false,
  radius: 40,
  speed: 50,
  fireCooldown: 1.5,
  spiralAngle: 0,
});

/**
 * @returns {Object} Default screen shake state
 */
export const createDefaultScreenShake = () => ({
  active: false,
  intensity: 0,
});

/**
 * @returns {Object} Default low HP warning state
 */
export const createDefaultLowHpWarning = () => ({
  active: false,
  intensity: 0,
  isCritical: false,
  pulseTimer: 0,
  heartbeatTimer: 0,
});

/**
 * @returns {Object} Default hit stop state
 */
export const createDefaultHitStop = () => ({
  active: false,
  remaining: 0,
});

/**
 * @returns {Object} Default player invincibility frames state
 */
export const createDefaultPlayerIFrames = () => ({
  active: false,
  remaining: 0,
  isInvincible: false,
  blinkTimer: 0,
});

/**
 * @returns {Object} Default dynamic FOV state
 */
export const createDefaultDynamicFov = () => ({
  current: 75,       // Current FOV value (degrees)
  target: 75,        // Target FOV to lerp toward
  hitTimer: 0,       // Remaining time for hit FOV snap
  bossDeathTimer: 0, // Remaining time for boss death FOV widen
  bossActiveTime: 0, // Time boss has been active (prevents flicker)
});
