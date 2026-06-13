/**
 * state.ts — Game state factory and type contract.
 *
 * Every piece of live game state flows through createGameState().
 * This is the single source of truth for what fields exist and their defaults.
 */

import { generateMap } from './mapGenerator';
import { loadAchievements } from './achievements';
import { loadSettings } from './settings';
import { SHIP_SKINS } from '../constants/skins';
import { createPools } from './pool';

/** @import { GameSettings } from './settings' */

export interface WeatherState {
  active: string[];
  solarFlare: { timer: number; active: boolean; remaining: number };
  debris: Array<Record<string, unknown>>;
  gravityZones: Array<Record<string, unknown>>;
  emi: { timer: number; active: boolean; remaining: number };
}

export interface SectorState {
  number: number;
  rank: string | null;
  rankScore: number;
  consecutiveARank: number;
  veteranMode: boolean;
  activeBuff: unknown | null;
  missionsCleared: number;
  missionsCompleted: number;
  totalHpPercent: number;
  missionStartTime: number[];
  missionEndTime: number[];
}

export interface AdaptiveDifficultyState {
  pressureScore: number;
  pressureHistory: number[];
  lowPressureTimer: number;
  highPressureTimer: number;
  rampageMode: boolean;
  missionsHighHp: number;
  spawnRateMult: number;
  enemyAggressionMult: number;
}

/** Player ship state */
export interface PlayerState {
  x: number; y: number; vx: number; vy: number; radius: number;
  hp: number; maxHp: number;
  shield: number; maxShield: number;
  _shieldWasDepleted: boolean;
  speed: number; magnetRadius: number;
  yaw: number;
  // Optional turret aim angle
  aimAngle?: number;
}

/** Mission descriptor */
export interface MissionState {
  type: string;
  target: number;
  current: number;
  title: string;
  reward: number;
  completed?: boolean;
  nodeType?: string;
  nodeId?: string;
  hazardTypes?: string[];
  weatherTypes?: string[];
  [key: string]: unknown;
}

/** Boss/mini-boss state */
export interface BossState {
  active: boolean;
  x: number; y: number;
  hp: number; maxHp: number;
  shield: number; maxShield: number;
  phase: number;
  attackTimer: number;
  chargeTimer: number;
  chargeTarget: { x: number; y: number };
  isCharging: boolean;
  radius: number;
  speed: number;
  fireCooldown: number;
  spiralAngle: number;
  rage: boolean;
  rageAuraTimer: number;
  rageEmberTimer: number;
  voidZones: unknown[];
  regenTimer: number;
  regenActive: boolean;
  phaseShiftTimer: number;
  decoy: unknown | null;
  _originalSpeed?: number;
  // Variant identity (from bosses.ts)
  id?: string;
  name?: string;
  color?: number;
  innerColor?: number;
  geometry?: string;
  attackPatterns?: unknown;
  deathColors?: number[];
  guaranteedDrops?: string[] | null;
  scrapReward?: number;
}

/** Escort drone state */
export interface EscortState {
  active: boolean;
  x: number; y: number;
  targetX: number; targetY: number;
  hp: number; maxHp: number;
  speed: number;
  radius: number;
  lives: number;
  evasionAngle: number;
  evasionTimer: number;
  respawnTimer: number;
}

/** Beacon defense state */
export interface BeaconState {
  active: boolean;
  x: number; y: number;
  hp: number; maxHp: number;
  radius: number;
  color: number;
}

/** Sabotage structure state */
export interface SabotageState {
  active: boolean;
  structures: Array<{
    x: number; y: number;
    hp: number; maxHp: number;
    radius: number;
    fireCooldown: number;
    active: boolean;
  }>;
}

/** Gauntlet mission state */
export interface GauntletState {
  active: boolean;
  currentWave: number;
  totalWaves: number;
  enemiesPerWave: number;
  enemiesSpawnedInWave: number;
  waveDelay: number;
  betweenWaves: boolean;
}

/** Wave surge state */
export interface WaveSurgeState {
  active: boolean;
  remaining: number;
  spawnRateMult: number;
}

/** Hazard entity */
export interface HazardEntity {
  type: string;
  x: number; y: number;
  radius: number;
  active: boolean;
  vx?: number;
  vy?: number;
  timer?: number;
  empActive?: number;
  [key: string]: unknown;
}

export interface DeathPulseEntity {
  id: number;
  x: number; y: number;
  radius: number;
  maxRadius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: number;
  active: boolean;
  hasDamagedPlayer: boolean;
  enemyType?: string;
}

export interface AttackWarningEntity {
  id: number;
  x: number; y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  active: boolean;
  fireCallback: () => void;
}

export interface SpawnFlashEntity {
  id: number;
  x: number; y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  active: boolean;
}

export interface ScrapFloatEntity {
  x: number; y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  active: boolean;
}

export interface ComboState {
  count: number;
  timer: number;
  multiplier: number;
}

export interface ScreenFlashState {
  active: boolean;
  remaining: number;
  color: string;
  alpha?: number;
  opacity?: number;
}

export interface ActiveBuff {
  timer: number;
  applied: boolean;
}

export interface WaveAnnounceState {
  active: boolean;
  wave: number;
  timer: number;
  formationName?: string;
}

export interface ScreenShakeState {
  active: boolean;
  intensity: number;
}

export interface LowHpWarningState {
  active: boolean;
  intensity: number;
  isCritical: boolean;
  pulseTimer: number;
  heartbeatTimer: number;
}

export interface EmergencyBeaconState {
  purchased: boolean;
  activated: boolean;
  nodeId: string | null;
}

export interface HitStopState {
  active: boolean;
  remaining: number;
}

export interface PlayerIFramesState {
  active: boolean;
  remaining: number;
  isInvincible: boolean;
  blinkTimer: number;
}

export interface DynamicFovState {
  current: number;
  target: number;
  hitTimer: number;
  bossDeathTimer: number;
  bossActiveTime: number;
}

export interface StarEntity {
  id: string;
  x: number; y: number; z: number;
  size: number;
  speed: number;
}

export interface LevelState {
  autocannon: number;
  plasma: number;
  missiles: number;
  hull: number;
  shield: number;
  thrusters: number;
  magnet: number;
  pointDefense: number;
  autoAim: number;
}

export interface CooldownState {
  autocannon: number;
  plasma: number;
  missiles: number;
  pointDefense: number;
  shieldRegen: number;
}

export interface AudioState {
  muted: boolean;
  volume: number;
}

export interface StatsState {
  enemiesDestroyed: number;
  totalScrap: number;
  surviveMissions: number;
  escortMissions: number;
  defendMissions: number;
  sabotageMissions: number;
  bossesDefeated: number;
  minibossesDefeated: number;
  upgradesMaxed: number;
}

export interface AchievementState {
  unlocked: Set<string>;
  notifications: Array<Record<string, unknown>>;
}

export interface EntityPools {
  enemies: unknown[];
  projectiles: unknown[];
  particles: unknown[];
  pickups: unknown[];
  powerups: unknown[];
  effects: unknown[];
  [key: string]: unknown;
}

export interface KeyInputState {
  [key: string]: boolean;
}

export interface MouseInputState {
  x: number;
  y: number;
  active: boolean;
}

export interface TouchInputState {
  x: number;
  y: number;
}

/**
 * The complete runtime game state.
 */
export interface GameState {
  player: PlayerState;
  scrap: number;
  totalScrapEarned: number;
  wave: number;
  totalTime: number;
  level: number;
  lastTime: number;
  mission: MissionState | null;
  lastMissionSummary: Record<string, unknown> | null;
  missionStartStats: Record<string, unknown> | null;
  map: ReturnType<typeof generateMap>;
  spawnCooldown: number;
  enemies: unknown[];
  projectiles: unknown[];
  particles: unknown[];
  pickups: unknown[];
  effects: unknown[];
  stars: StarEntity[];
  levels: LevelState;
  cooldowns: CooldownState;
  escort: EscortState;
  beacon: BeaconState;
  sabotage: SabotageState;
  gauntlet: GauntletState;
  waveSurge: WaveSurgeState;
  keys: KeyInputState;
  mouse: MouseInputState;
  worldMouse: TouchInputState;
  touchId: number | null;
  touchBase: TouchInputState | null;
  touchCurrent: TouchInputState | null;
  devMode: boolean;
  paused: boolean;
  audio: AudioState;
  combo: ComboState;
  screenFlash: ScreenFlashState;
  powerups: unknown[];
  activeBuffs: Record<string, ActiveBuff>;
  waveAnnounce: WaveAnnounceState;
  waveCount: number;
  enemiesSpawnedThisWave: number;
  boss: BossState;
  miniboss: BossState;
  hazards: HazardEntity[];
  deathPulses: DeathPulseEntity[];
  settings: ReturnType<typeof loadSettings>;
  shipSkin: number;
  unlockedSkins: boolean[];
  screenShake: ScreenShakeState;
  lowHpWarning: LowHpWarningState;
  emergencyBeacon: EmergencyBeaconState;
  relics: string[];
  relicSlotLimit: number;
  hitStop: HitStopState;
  playerIFrames: PlayerIFramesState;
  attackWarnings: AttackWarningEntity[];
  dynamicFov: DynamicFovState;
  spawnFlashes: SpawnFlashEntity[];
  scrapFloats: ScrapFloatEntity[];
  powerupAuras: unknown[];
  adaptiveDifficulty: AdaptiveDifficultyState;
  sector: SectorState;
  weather: WeatherState;
  achievements: AchievementState;
  achievementVersion: number;
  stats: StatsState;
  entityPools?: EntityPools;
  [key: string]: unknown;
}

/**
 * Creates a fresh game state object with all default values.
 */
export const createGameState = (): GameState => {
  const g: GameState = {
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
      _shieldWasDepleted: false,
      speed: 120, magnetRadius: 150,
      yaw: Math.PI / 2,
    },
    scrap: 200, totalScrapEarned: 0,
    wave: 1, totalTime: 0, level: 1, mission: null,
    lastMissionSummary: null,
    missionStartStats: null,
    map: generateMap(),
    spawnCooldown: 2,
    enemies: [], projectiles: [], particles: [], pickups: [], effects: [],
    stars: Array.from({ length: 800 }, (_, i) => ({
      id: `star_${i}`,
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
    gauntlet: createDefaultGauntlet(),
    waveSurge: createDefaultWaveSurge(),
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
    emergencyBeacon: {
      purchased: false, activated: false, nodeId: null,
    },
    relics: [],
    relicSlotLimit: 5,
    hitStop: createDefaultHitStop(),
    playerIFrames: createDefaultPlayerIFrames(),
    attackWarnings: [],
    dynamicFov: createDefaultDynamicFov(),
    spawnFlashes: [],
    scrapFloats: [],
    powerupAuras: [],
    adaptiveDifficulty: {
      pressureScore: 0,
      pressureHistory: [],
      lowPressureTimer: 0,
      highPressureTimer: 0,
      rampageMode: false,
      missionsHighHp: 0,
      spawnRateMult: 1,
      enemyAggressionMult: 1,
    },
    sector: {
      number: 1,
      rank: null,
      rankScore: 0,
      consecutiveARank: 0,
      veteranMode: false,
      activeBuff: null,
      missionsCleared: 0,
      missionsCompleted: 0,
      totalHpPercent: 0,
      missionStartTime: [],
      missionEndTime: [],
    },
    weather: createDefaultWeather(),
    lastTime: typeof performance !== 'undefined' ? performance.now() : 0,
  };
  createPools(g);
  return g;
};

/** Default escort drone state */
export const createDefaultEscort = (): EscortState => ({
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

/** Default beacon state for defend missions */
export const createDefaultBeacon = (): BeaconState => ({
  active: false,
  x: 0, y: 0,
  hp: 0, maxHp: 0,
  radius: 30,
  color: 0x22d3ee,
});

/** Default sabotage state (enemy structures to destroy) */
export const createDefaultSabotage = (): SabotageState => ({
  active: false,
  structures: [],
});

/** Default boss state */
export const createDefaultBoss = (): BossState => ({
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
  rage: false,
  rageAuraTimer: 0,
  rageEmberTimer: 0,
  voidZones: [],
  regenTimer: 0,
  regenActive: false,
  phaseShiftTimer: 0,
  decoy: null,
  _originalSpeed: undefined,
});

/** Default mini-boss state */
export const createDefaultMiniboss = (): BossState => ({
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
  rage: false,
  rageAuraTimer: 0,
  rageEmberTimer: 0,
  voidZones: [],
  regenTimer: 0,
  regenActive: false,
  phaseShiftTimer: 0,
  decoy: null,
});

/** Default screen shake state */
export const createDefaultScreenShake = (): ScreenShakeState => ({
  active: false,
  intensity: 0,
});

/** Default low HP warning state */
export const createDefaultLowHpWarning = (): LowHpWarningState => ({
  active: false,
  intensity: 0,
  isCritical: false,
  pulseTimer: 0,
  heartbeatTimer: 0,
});

/** Default hit stop state */
export const createDefaultHitStop = (): HitStopState => ({
  active: false,
  remaining: 0,
});

/** Default player invincibility frames state */
export const createDefaultPlayerIFrames = (): PlayerIFramesState => ({
  active: false,
  remaining: 0,
  isInvincible: false,
  blinkTimer: 0,
});

/** Default dynamic FOV state */
export const createDefaultDynamicFov = (): DynamicFovState => ({
  current: 75,
  target: 75,
  hitTimer: 0,
  bossDeathTimer: 0,
  bossActiveTime: 0,
});

/** Default gauntlet mission state */
export const createDefaultGauntlet = (): GauntletState => ({
  active: false,
  currentWave: 0,
  totalWaves: 3,
  enemiesPerWave: 0,
  enemiesSpawnedInWave: 0,
  waveDelay: 0,
  betweenWaves: false,
});

/** Default wave surge mission state */
export const createDefaultWaveSurge = (): WaveSurgeState => ({
  active: false,
  remaining: 0,
  spawnRateMult: 3,
});

/** Default weather system state */
export const createDefaultWeather = (): WeatherState => ({
  active: [],
  solarFlare: { timer: 0, active: false, remaining: 0 },
  debris: [],
  gravityZones: [],
  emi: { timer: 0, active: false, remaining: 0 },
});
