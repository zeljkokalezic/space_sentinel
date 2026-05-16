/**
 * hazardSetup.js — Environmental hazard initialization and cleanup.
 * Spawns hazard entities into g.hazards at mission start.
 */
import { GAME_CONFIG } from '../constants/gameConfig';

/**
 * Spawn a random position within a spread distance from the player.
 * @param {number} spread — Maximum distance from player
 * @returns {{ x: number, y: number }}
 */
const randomPosition = (spread) => {
  const angle = Math.random() * Math.PI * 2;
  const dist = spread * (0.5 + Math.random() * 0.5);
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
};

/**
 * Set up environmental hazards for a mission.
 * @param {object} g — Game state
 * @param {number} level — Current level (scales intensity)
 * @param {string[]} hazardTypes — Array of hazard type strings
 */
export const setupHazards = (g, level, hazardTypes) => {
  const C = GAME_CONFIG.environmentalHazards;
  if (!C || !hazardTypes || hazardTypes.length === 0) return;

  g.hazards = [];

  for (const type of hazardTypes) {
    if (type === 'asteroidField') {
      const cfg = C.asteroidField;
      // Scale from countMin to countMax over levels 1-20
      const count = Math.round(
        cfg.countMin + (cfg.countMax - cfg.countMin) * Math.min(level / 20, 1)
      );
      for (let i = 0; i < count; i++) {
        const pos = randomPosition(
          cfg.spawnSpreadMin + (cfg.spawnSpreadMax - cfg.spawnSpreadMin) * Math.random()
        );
        g.hazards.push({
          id: `ast_${i}_${Math.random()}`,
          type: 'asteroid',
          active: true,
          x: pos.x,
          y: pos.y,
          radius: cfg.radiusMin + Math.random() * (cfg.radiusMax - cfg.radiusMin),
          rotationSpeed: (Math.random() - 0.5) * 0.5,
          rotX: Math.random() * Math.PI,
          rotY: Math.random() * Math.PI,
        });
      }
    } else if (type === 'gravityWell') {
      const cfg = C.gravityWell;
      const pos = randomPosition(cfg.spawnSpread);
      const pullStrength = cfg.pullStrength + level * 5;
      g.hazards.push({
        id: `gw_${Math.random()}`,
        type: 'gravityWell',
        active: true,
        x: pos.x,
        y: pos.y,
        radius: cfg.pullRadius,
        pullStrength,
      });
    } else if (type === 'plasmaStorm') {
      const cfg = C.plasmaStorm;
      // Spawn storm outside viewport, moving inward
      const angle = Math.random() * Math.PI * 2;
      const dist = cfg.spawnSpread + 400;
      const startX = Math.cos(angle) * dist;
      const startY = Math.sin(angle) * dist;
      // Move toward center
      const dirAngle = Math.atan2(-startY, -startX) + (Math.random() - 0.5) * 0.5;
      g.hazards.push({
        id: `ps_${Math.random()}`,
        type: 'plasmaStorm',
        active: true,
        x: startX,
        y: startY,
        vx: Math.cos(dirAngle) * cfg.moveSpeed,
        vy: Math.sin(dirAngle) * cfg.moveSpeed,
        radius: cfg.zoneRadius,
        timer: cfg.duration,
        damagePerSecond: cfg.damagePerSecond + level * 2,
        respawning: false,
        respawnTimer: 0,
      });
    } else if (type === 'empZone') {
      const cfg = C.empZone;
      const pos = randomPosition(cfg.spawnSpread);
      g.hazards.push({
        id: `emp_${Math.random()}`,
        type: 'emp',
        active: true,
        x: pos.x,
        y: pos.y,
        radius: cfg.radius,
        cooldown: cfg.cooldown,
        timer: cfg.cooldown, // Start at full cooldown so first pulse happens after delay
        disableDuration: cfg.disableDuration,
        empActive: 0,
        empTimer: 0,
      });
    }
  }
};

/**
 * Clear all environmental hazards.
 * @param {object} g — Game state
 */
export const resetHazards = (g) => {
  g.hazards = [];
};
