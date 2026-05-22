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
    strafeSpeedRatio: 0.7,
    worldBounds: 4000,
  },

  thrusters: {
    speedPerLevel: 30,
    strafeSpeedPerLevel: 3,
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

  comboCelebration: {
    // Milestone popup lifetime in seconds
    popupLife: 1.5,
    // Milestone popup font size
    popupFontSize: 32,
    // Combo counter bounce scale factor
    bounceScale: 1.8,
    // Combo counter bounce duration (seconds)
    bounceDuration: 0.4,
    // Screen flash duration (seconds)
    flashDuration: 0.15,
    // Screen flash max alpha
    flashAlpha: 0.25,
    // Particle burst count around combo area
    particleCount: 20,
    // Milestone label text
    label: 'MILESTONE!',
    // Colors for each milestone tier
    colors: {
      5: '#fbbf24',   // gold
      10: '#f97316',  // orange
      15: '#ef4444',  // red
    },
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
    // Shared values used by bossCore.js (variant-specific data in constants/bosses.js)
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

    // delayed_burst attack pattern config
    delayedBurst: {
      count: 6,           // Number of projectiles in the ring
      rings: 2,           // Number of staggered speed tiers (creates layered arrival)
      baseMult: 0.5,      // Base speed multiplier for first tier
      stagger: 0.15,      // Speed increment per tier
      damageMult: 0.5,    // Damage multiplier per projectile
    },
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

  formations: {
    vanguard: {
      spreadRadius: 300,
      convergeDelay: 3,
      convergeSpeedMult: 1.5,
    },
    orbit: {
      orbitRadius: 250,
      orbitSpeed: 1.5,
      rushThreshold: 0.4,
    },
    swarm: {
      separationDist: 60,
      cohesionWeight: 0.5,
      alignmentWeight: 0.3,
      maxCount: 8,
    },
    kamikaze: {
      speedMult: 1.8,
      lateralAmplitude: 40,
      lateralFreq: 3,
    },
    bomber: {
      approachRadius: 400,
      fireBurstCount: 3,
      retreatDist: 150,
    },
    screen: {
      lineSpacing: 80,
      advanceSpeed: 30,
      fireThrough: true,
    },
  },

  // Level gates: which formations unlock at each level tier
  formationLevels: {
    kamikaze: 1,
    vanguard: 1,
    orbit: 4,
    bomber: 4,
    swarm: 7,
    screen: 7,
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

  screenShake: {
    // Linear decay rate (intensity units per second)
    decay: 40,
    // Intensity threshold below which shake deactivates
    minThreshold: 0.5,
    // Named presets for common events
    presets: {
      playerHit: 4,
      explosion: 8,
      bigExplosion: 20,
    },
  },

 lowHpWarning: {
    // HP ratio thresholds (fraction of maxHp)
    warningThreshold: 0.3,   // Warning activates below 30% HP
    criticalThreshold: 0.15, // Critical below 15% HP

    // Visual pulse period in seconds (full sine cycle)
    pulsePeriod: 1.5,

    // Heartbeat audio interval in seconds (normal HP warning)
    heartbeatInterval: 1.0,
    // Critical HP halves the interval (0.5s between beats)
  },

  hitStop: {
    // Named presets for freeze-frame duration (seconds)
    presets: {
      hit: 0.03,
      bigHit: 0.06,
      bossHit: 0.1,
      bossDeath: 0.2,
      playerHit: 0.05,
    },
  },

  deathPulse: {
    // Enemy types that emit a shockwave on death
    eligibleTypes: ['heavy', 'shielded', 'missile_boat'],
    // Base damage to nearby entities
    baseDamage: 15,
    damagePerLevel: 2,
    // Explosion radius (world units)
    baseRadius: 120,
    radiusPerLevel: 5,
    // Visual: expanding ring duration (seconds)
    ringDuration: 0.4,
    // Color of the ring effect
    ringColor: 0xf97316,
    // Chance that a chain-killed enemy also triggers a secondary pulse
    chainKillChance: 0.3,
  },

  shieldBreak: {
    // Number of shatter particles to emit
    particleCount: 25,
    // Particle color (electric blue — shield energy dissipating)
    particleColor: 0x60a5fa,
    // Screen shake preset name (from screenShake.presets)
    screenShakePreset: 'explosion',
    // Hit stop preset name (from hitStop.presets)
    hitStopPreset: 'bigHit',
    // Damage popup text shown on shield break
    popupText: 'SHIELD DOWN',
    // Popup lifetime in seconds
    popupLife: 1.2,
    // Popup text color (bright cyan for visibility)
    popupColor: '#60a5fa',
  },

  thrustTrail: {
    // Enable/disable thrust trail particles
    enabled: true,
    // Base particles emitted per frame when thrusting
    particlesPerFrame: 2,
    // Extra particles per thruster level above 1
    particlesPerThrusterLevel: 1,
    // Distance behind ship to spawn particles (world units)
    offset: 22,
    // Lateral spread angle in radians (half-angle on each side)
    spreadAngle: 0.3,
    // Particle speed range (world units per second, backward from ship)
    speedMin: 30,
    speedMax: 80,
    // Particle lifetime in seconds
    life: 0.35,
    // Particle color (cyan — engine glow)
    color: 0x22d3ee,
    // Particle type for behavior (drag, fade)
    type: 'trail',
  },

  playerIFrames: {
    // Total invulnerability duration after taking damage (seconds)
    duration: 0.5,
    // Blink toggle period (seconds) — ship alternates visible/invisible
    blinkPeriod: 0.08,
    // Initial grace period where player is always invincible (seconds)
    gracePeriod: 0.15,
  },

  attackWarning: {
    // Warning indicator duration before projectile fires (seconds)
    duration: 0.5,
    // Warning indicator radius (world units)
    radius: 25,
    // Pulse frequency for the warning ring (cycles per second)
    pulseFrequency: 4,
    // Color of the warning indicator
    color: '#ef4444',
    // Radar marker color
    radarColor: '#ef4444',
    // Per-enemy-type warning config (override duration/radius per type)
    types: {
      shooter: {
        duration: 0.4,
        radius: 20,
      },
      missile_boat: {
        duration: 0.7,
        radius: 30,
      },
    },
  },

  damageNumbers: {
    // Color for hull damage (green — damage actually dealt to HP)
    hullColor: '#39ff14',
    // Color for shield damage (blue — absorbed by shield)
    shieldColor: '#60a5fa',
    // Color for critical/big hits (gold — high damage)
    critColor: '#fbbf24',
    // Color for player taking damage (red)
    playerHitColor: '#ef4444',
    // Damage threshold above which numbers are considered "big" (crit styling)
    critThreshold: 40,
    // Base font size for damage numbers
    baseFontSize: 16,
    // Font size multiplier for big/crit hits
    critFontSizeMult: 1.5,
    // Font size multiplier for shield hits (slightly smaller)
    shieldFontSizeMult: 0.85,
    // Pop animation: scale factor at peak
    popScale: 1.4,
    // Pop animation: time to reach peak scale (seconds)
    popDuration: 0.12,
    // Float speed upward (world units per second)
    floatSpeed: 50,
    // Lifetime in seconds
    lifetime: 0.9,
  },

 dynamicFov: {
    // Base FOV (degrees) — normal gameplay
    baseFov: 75,
    // FOV during boss fights (narrower = more tension/focus)
    bossFov: 65,
    // FOV during low HP (narrower = urgency)
    lowHpFov: 68,
    // FOV on big hit impact (brief snap for dramatic effect)
    hitFov: 60,
    // FOV on boss death (wider = release/celebration)
    bossDeathFov: 80,
    // How fast FOV lerps toward target (higher = snappier)
    lerpSpeed: 3,
    // Duration of hit FOV snap (seconds)
    hitDuration: 0.2,
    // Duration of boss death FOV widen (seconds)
    bossDeathDuration: 2,
    // Minimum time at boss FOV before it starts (prevents flicker)
    bossSettleTime: 0.5,
  },

 shieldRestoration: {
    // "SHIELD UP" popup lifetime in seconds
    popupLife: 1.5,
    // Popup text color (bright cyan)
    popupColor: '#38bdf8',
    // Screen shake preset name (from screenShake.presets)
    screenShakePreset: 'playerHit',
    // Hit stop preset name (from hitStop.presets)
    hitStopPreset: 'hit',
    // Screen flash duration (seconds)
    flashDuration: 0.15,
    // Screen flash max alpha
    flashAlpha: 0.15,
    // Screen flash color
    flashColor: '#38bdf8',
    // Particle burst count around player
    particleCount: 16,
    // Particle color (electric blue — shield energy)
    particleColor: 0x38bdf8,
    // Particle speed range
    particleSpeedMin: 40,
    particleSpeedMax: 120,
    // Particle lifetime
    particleLife: 0.8,
    // Ring effect: expanding shield ring radius
    ringMaxRadius: 80,
    // Ring effect: duration (seconds)
    ringDuration: 0.5,
    // Ring color (hex integer)
    ringColor: 0x60a5fa,
  },

  enemySpawnFlash: {
    // Enable/disable spawn flash effects
    enabled: true,
    // Maximum ring radius in world units (expands from 0 to this)
    maxRadius: 80,
    // Duration of the flash effect in seconds
    duration: 0.6,
    // Ring color (red — danger/threat indicator)
    ringColor: '#ef4444',
    // Ring line width in pixels
    lineWidth: 3,
    // Burst particles spawned with each flash
    particleCount: 12,
    // Burst particle color (bright red-orange)
    particleColor: 0xf97316,
    // Maximum concurrent spawn flashes (oldest dropped when exceeded)
    maxFlashes: 20,
  },

  scrapCollection: {
    // Enable/disable scrap collection effects
    enabled: true,
    // Burst particles spawned at collection point
    particleCount: 8,
    // Particle color (gold — scrap value)
    particleColor: 0xfbbf24,
    // Particle speed range
    particleSpeedMin: 40,
    particleSpeedMax: 100,
    // Particle lifetime in seconds
    particleLife: 0.4,
    // Floating "+N" number lifetime in seconds
    floatLife: 1.0,
    // Float speed upward (world units per second)
    floatSpeed: 40,
    // Text color for the floating number
    floatColor: '#fbbf24',
    // Base font size for the floating number
    baseFontSize: 14,
    // Screen flash opacity on collection (0-1)
    flashOpacity: 0.06,
    // Screen flash duration in seconds
    flashDuration: 0.1,
    // Minimum scrap value to trigger screen flash
    flashMinValue: 3,
    // Maximum concurrent floating numbers
    maxFloats: 30,
  },

  powerupAura: {
    // Enable/disable power-up pickup aura ring effects
    enabled: true,
    // Ring expansion speed (world units per second)
    expandSpeed: 300,
    // Maximum ring radius (world units)
    maxRadius: 150,
    // Ring effect lifetime in seconds
    ringDuration: 0.8,
    // Ring line width in pixels
    lineWidth: 3,
    // Floating buff name lifetime in seconds
    textDuration: 1.5,
    // Float speed upward (world units per second)
    textFloatSpeed: 60,
    // Font size for buff name text
    textFontSize: 18,
    // Maximum concurrent aura effects
    maxAuras: 10,
  },
};
