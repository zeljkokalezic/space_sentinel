/**
 * gameConfig.js — Centralised game configuration.
 * All magic numbers from physics.js, spawner.js, and App.jsx live here.
 */

export const GAME_CONFIG = {
  player: {
    radius: 38,
    baseHp: 300,
    baseShield: 20,
    baseSpeed: 120,
    magnetRadius: 150,
    turnSpeed: 1.4,
    worldBounds: 4000,
  },

  thrusters: {
    speedPerLevel: 30,
  },

  magnet: {
    radiusPerLevel: 35,
    pullSpeed: 500,
  },

  weapons: {
    autocannon: {
      baseDamage: 10,
      damagePerLevel: 5,
      baseCooldown: 0.4,
      cooldownReduction: 0.025,
      shotsPerExtraLevels: 3,
      speed: 700,
      speedVariance: 50,
      minCooldown: 0.08,
    },
    plasma: {
      baseDamage: 30,
      damagePerLevel: 15,
      baseSpeed: 350,
      baseCooldown: 2.0,
      cooldownReduction: 0.1,
      shotsPerExtraLevels: 3,
      minCooldown: 0.5,
    },
    missiles: {
      baseDamage: 20,
      damagePerLevel: 5,
      baseSpeed: 250,
      baseCooldown: 3.0,
      cooldownReduction: 0.15,
      minCooldown: 1.0,
    },
    pointDefense: {
      baseRange: 250,
      rangePerLevel: 10,
      baseDamage: 50,
      damagePerLevel: 20,
      baseCooldown: 0.5,
      cooldownReduction: 0.03,
      maxHitsPer2Levels: 2,
      minCooldown: 0.2,
    },
  },

  shield: {
    regenAmount: 2,
    regenCooldown: 0.5,
  },

  enemies: {
    spawnRadiusMin: 900,
    spawnRadiusMax: 1300,
    baseSpawnRate: 2.5,
    spawnRateLevelDecay: 0.1,
    spawnRateTimeDecay: 1 / 400,
    spawnCooldownVariance: 0.5,
    eliteBonusBase: 0.02,
    eliteBonusTimeFactor: 1 / 2000,
    eliteBonusMax: 0.4,
  },

  world: {
    bounds: 4000,
    starCount: 800,
    starSpread: 8000,
    starDepth: 500,
  },

  escort: {
    baseHp: 120,
    hpPerLevel: 25,
    baseSpeed: 55,
    speedPerLevel: 3,
    baseLives: 3,
    livesReductionPer4Levels: 1,
    minLives: 1,
    spawnSpread: 300,
    baseDistance: 1000,
    distancePerLevel: 80,
    respawnTimer: 2.0,
    evasionCooldown: 0.3,
    evasionThreatRadius: 200,
    destinationThreshold: 30,
    worldBounds: 3800,
    ramDamage: 15,
    respawnSpread: 100,
  },

  beacon: {
    baseHp: 200,
    hpPerLevel: 50,
    spawnSpread: 400,
    radius: 30,
    defenseRadius: 250,
    color: 0x22d3ee,
  },

  cleanup: {
    interval: 5.0,
  },

  transition: {
    duration: 3.0,
  },

  projectile: {
    lifetime: 4.0,
  },

  particles: {
    life: 1.0,
    speedMin: 50,
    speedMax: 100,
  },
};
