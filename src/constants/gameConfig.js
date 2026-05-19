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

  enemyWeapons: {
    shooter: {
      damage: 15,
      cooldownMin: 1.8,
      cooldownVariance: 1.0,
      rangeMult: 16,
    },
    missile_boat: {
      missileDamage: 25,
      missileSpeed: 120,
      cooldown: 4.0,
      rangeMult: 21,
    },
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

  sabotage: {
    baseStructures: 3,
    structuresPer2Levels: 1,
    maxStructures: 8,
    structureHp: 80,
    hpPerLevel: 25,
    structureRadius: 25,
    fireCooldown: 2.5,
    projectileDamage: 15,
    projectileSpeed: 300,
    spawnSpreadMin: 600,
    spawnSpreadMax: 1200,
    protectRadius: 350,
    color: 0xf97316,
    scrapPerDestroy: 15,
  },

  cleanup: {
    interval: 2.0,
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

  combo: {
    timerDuration: 3.0,
    milestones: [
      { count: 0, mult: 1 },
      { count: 5, mult: 1.5 },
      { count: 10, mult: 2 },
      { count: 15, mult: 3 },
    ],
  },

  powerups: {
    dropChance: 0.05,
    types: {
      rapidFire:    { duration: 10, color: '#fbbf24', icon: '⚡' },
      shieldBoost:  { duration: 15, color: '#3b82f6', icon: '🛡' },
      damageSurge:  { duration: 12, color: '#ef4444', icon: '💥' },
      timeSlow:     { duration: 8,  color: '#a855f7', icon: '⏱' },
      nuke:         { duration: 0,  color: '#ffffff', icon: '☢' },
      repair:       { duration: 0,  color: '#22c55e', icon: '❤' },
    },
  },

  boss: {
    baseHp: 1500,
    hpPerLevel: 200,
    radius: 60,
    baseSpeed: 60,
    speedPerLevel: 3,
    fireCooldown: 1.5,
    chargeCooldown: 5,
    chargeSpeed: 300,
    projectileDamage: 20,
    projectileSpeed: 400,
    ramDamage: 40,
    phaseThresholds: [1, 0.66, 0.33],
    phaseSpeedMult: [1, 1.3, 1.6],
    phaseFireMult: [1, 1.5, 2],
    scrapReward: 500,
    guaranteedDrops: ['shieldBoost', 'damageSurge'],
    color: '#dc2626',
  },

  miniboss: {
    hpPercent: 0.4,
    damagePercent: 0.5,
    radius: 40,
    baseSpeed: 50,
    speedPerLevel: 2,
    scrapReward: 100,
    spawnInterval: 3,
    color: 0xf97316,
    colorHex: '#f97316',
  },

  waveAnnouncer: {
    enemiesPerWave: 10,
    announcementDuration: 2,
  },

  environmentalHazards: {
    // Probability a combat node has a hazard (scales with level)
    baseChance: 0.15,
    chancePerLevel: 0.02,
    maxChance: 0.6,
    maxHazardsPerMission: 2,

    asteroidField: {
      countMin: 5,
      countMax: 15,
      radiusMin: 15,
      radiusMax: 45,
      spawnSpreadMin: 300,
      spawnSpreadMax: 1000,
      color: 0x6b7280,
    },
    gravityWell: {
      count: 1,
      pullStrength: 150,
      pullRadius: 400,
      spawnSpread: 600,
      color: 0x7c3aed,
      damagePerSecond: 0,
    },
    plasmaStorm: {
      damagePerSecond: 20,
      moveSpeed: 60,
      zoneRadius: 200,
      duration: 25,
      respawnTimer: 15,
      spawnSpread: 500,
      color: '#a855f7',
    },
    empZone: {
      disableDuration: 2,
      cooldown: 10,
      radius: 300,
      count: 1,
      spawnSpread: 500,
      color: '#eab308',
    },
  },
};
