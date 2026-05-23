/**
 * systems/weather.js — Weather system simulation.
 * Handles solar flares, debris fields, gravity anomalies, and EMI.
 *
 * @param {number} dt — Delta time in seconds
 * @param {object} g — Game state
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

const WEATHER_TYPES = ['solarFlare', 'debrisField', 'gravityAnomaly', 'electromagneticInterference'];

/**
 * Initialize weather for a sector based on assigned weather types.
 *
 * @param {object} g — Game state
 * @param {string[]} weatherTypes — Array of weather type keys (e.g. ['solarFlare', 'debrisField'])
 */
export const initWeather = (g, weatherTypes) => {
  if (!g || !g.weather) return;

  const cfg = GAME_CONFIG.weather;
  const types = weatherTypes || [];

  // Validate and cap weather types
  const valid = types.filter(t => WEATHER_TYPES.includes(t));
  const capped = valid.slice(0, cfg.maxPerSector);

  g.weather.active = capped;

  // Reset sub-states
  g.weather.solarFlare = {
    timer: cfg.types.solarFlare.intervalMin + Math.random() * (cfg.types.solarFlare.intervalMax - cfg.types.solarFlare.intervalMin),
    active: false,
    remaining: 0,
  };

  g.weather.debris = [];
  g.weather.gravityZones = [];
  g.weather.emi = {
    timer: cfg.types.electromagneticInterference.intervalMin + Math.random() * (cfg.types.electromagneticInterference.intervalMax - cfg.types.electromagneticInterference.intervalMin),
    active: false,
    remaining: 0,
  };

  // Pre-spawn debris clusters if debrisField is active
  if (capped.includes('debrisField')) {
    const debrisCfg = cfg.types.debrisField;
    for (let i = 0; i < debrisCfg.clusterCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * 700;
      g.weather.debris.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        radius: debrisCfg.clusterRadius,
        vx: (Math.random() - 0.5) * debrisCfg.moveSpeed,
        vy: (Math.random() - 0.5) * debrisCfg.moveSpeed,
        active: true,
      });
    }
  }

  // Pre-spawn gravity zones if gravityAnomaly is active
  if (capped.includes('gravityAnomaly')) {
    const gravCfg = cfg.types.gravityAnomaly;
    for (let i = 0; i < gravCfg.zoneCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 200 + Math.random() * 600;
      g.weather.gravityZones.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        radius: gravCfg.zoneRadius,
        respawnTimer: 0,
        active: true,
      });
    }
  }
};

/**
 * Update all active weather effects.
 *
 * @param {number} dt — Delta time in seconds
 * @param {object} g — Game state
 */
export const updateWeather = (dt, g) => {
  if (!g || !g.weather || g.weather.active.length === 0) return;

  const cfg = GAME_CONFIG.weather;

  for (const type of g.weather.active) {
    switch (type) {
      case 'solarFlare':
        updateSolarFlare(dt, g, cfg.types.solarFlare);
        break;
      case 'debrisField':
        updateDebrisField(dt, g);
        break;
      case 'gravityAnomaly':
        updateGravityAnomaly(dt, g, cfg.types.gravityAnomaly);
        break;
      case 'electromagneticInterference':
        updateEMI(dt, g, cfg.types.electromagneticInterference);
        break;
    }
  }
};

/**
 * Check if a projectile at (px, py) is blocked by any debris cluster.
 *
 * @param {number} px — Projectile X position
 * @param {number} py — Projectile Y position
 * @param {object} g — Game state
 * @returns {boolean} true if projectile is blocked
 */
export const isProjectileBlockedByDebris = (px, py, g) => {
  if (!g || !g.weather || !g.weather.active.includes('debrisField')) return false;

  for (const cluster of g.weather.debris) {
    if (!cluster.active) continue;
    const dx = px - cluster.x;
    const dy = py - cluster.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < cluster.radius) return true;
  }
  return false;
};

/**
 * Get projectile speed multiplier based on gravity zones.
 * Returns 0.5 if inside a gravity zone, 1 otherwise.
 *
 * @param {number} px — Projectile X position
 * @param {number} py — Projectile Y position
 * @param {object} g — Game state
 * @returns {number} Speed multiplier (0.5 or 1)
 */
export const getProjectileSpeedMult = (px, py, g) => {
  if (!g || !g.weather || !g.weather.active.includes('gravityAnomaly')) return 1;

  for (const zone of g.weather.gravityZones) {
    if (!zone.active) continue;
    const dx = px - zone.x;
    const dy = py - zone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < zone.radius) return GAME_CONFIG.weather.types.gravityAnomaly.speedReduction;
  }
  return 1;
};

/**
 * Check if weapons are currently disabled by EMI.
 *
 * @param {object} g — Game state
 * @returns {boolean} true if weapons are disabled
 */
export const areWeaponsDisabled = (g) => {
  if (!g || !g.weather || !g.weather.active.includes('electromagneticInterference')) return false;
  return g.weather.emi.active;
};

/**
 * Check if a solar flare is currently active.
 *
 * @param {object} g — Game state
 * @returns {boolean} true if solar flare is active
 */
export const isSolarFlareActive = (g) => {
  if (!g || !g.weather || !g.weather.active.includes('solarFlare')) return false;
  return g.weather.solarFlare.active;
};

/**
 * Reset all weather state to defaults.
 *
 * @param {object} g — Game state
 */
export const resetWeather = (g) => {
  if (!g || !g.weather) return;

  g.weather.active = [];
  g.weather.solarFlare = {
    timer: 0,
    active: false,
    remaining: 0,
  };
  g.weather.debris = [];
  g.weather.gravityZones = [];
  g.weather.emi = {
    timer: 0,
    active: false,
    remaining: 0,
  };
};

// ─── Internal update functions ───────────────────────────────────────────────

const updateSolarFlare = (dt, g, cfg) => {
  const sf = g.weather.solarFlare;

  if (sf.active) {
    sf.remaining -= dt;
    if (sf.remaining <= 0) {
      sf.active = false;
      sf.timer = cfg.intervalMin + Math.random() * (cfg.intervalMax - cfg.intervalMin);
    }
    return;
  }

  sf.timer -= dt;
  if (sf.timer <= 0) {
    sf.active = true;
    sf.remaining = cfg.duration;
  }
};

const updateDebrisField = (dt, g) => {
  const bounds = GAME_CONFIG.world.bounds;

  for (const cluster of g.weather.debris) {
    if (!cluster.active) continue;

    cluster.x += cluster.vx * dt;
    cluster.y += cluster.vy * dt;

    // Bounce off world bounds
    if (cluster.x < -bounds) { cluster.x = -bounds; cluster.vx = Math.abs(cluster.vx); }
    if (cluster.x > bounds) { cluster.x = bounds; cluster.vx = -Math.abs(cluster.vx); }
    if (cluster.y < -bounds) { cluster.y = -bounds; cluster.vy = Math.abs(cluster.vy); }
    if (cluster.y > bounds) { cluster.y = bounds; cluster.vy = -Math.abs(cluster.vy); }
  }
};

const updateGravityAnomaly = (dt, g, cfg) => {
  const bounds = GAME_CONFIG.world.bounds;

  for (const zone of g.weather.gravityZones) {
    if (!zone.active) continue;

    // Slowly drift zones
    zone.x += (Math.random() - 0.5) * 5 * dt;
    zone.y += (Math.random() - 0.5) * 5 * dt;

    // Keep within bounds
    zone.x = Math.max(-bounds, Math.min(bounds, zone.x));
    zone.y = Math.max(-bounds, Math.min(bounds, zone.y));

    // Respawn timer for zone repositioning
    zone.respawnTimer = (zone.respawnTimer || 0) + dt;
    if (zone.respawnTimer >= cfg.respawnInterval) {
      // Reposition zone to a new random location
      const angle = Math.random() * Math.PI * 2;
      const dist = 200 + Math.random() * 600;
      zone.x = Math.cos(angle) * dist;
      zone.y = Math.sin(angle) * dist;
      zone.respawnTimer = 0;
    }
  }
};

const updateEMI = (dt, g, cfg) => {
  const emi = g.weather.emi;

  if (emi.active) {
    emi.remaining -= dt;
    if (emi.remaining <= 0) {
      emi.active = false;
      emi.timer = cfg.intervalMin + Math.random() * (cfg.intervalMax - cfg.intervalMin);
    }
    return;
  }

  emi.timer -= dt;
  if (emi.timer <= 0) {
    emi.active = true;
    emi.remaining = cfg.disableDuration;
  }
};
