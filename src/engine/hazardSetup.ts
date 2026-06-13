/**
 * hazardSetup.ts — Environmental hazard initialization and cleanup.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import type { GameState } from './state';

const randomPosition = (spread: number): { x: number; y: number } => {
  const angle = Math.random() * Math.PI * 2;
  const dist = spread * (0.5 + Math.random() * 0.5);
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
};

export const setupHazards = (g: GameState, level: number, hazardTypes: string[]): void => {
  const C = GAME_CONFIG.environmentalHazards;
  if (!C || !hazardTypes || hazardTypes.length === 0) return;

  g.hazards = [];

  for (const type of hazardTypes) {
    if (type === 'asteroidField') {
      const cfg = C.asteroidField;
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
          x: pos.x, y: pos.y,
          radius: cfg.radiusMin + Math.random() * (cfg.radiusMax - cfg.radiusMin),
          rotationSpeed: (Math.random() - 0.5) * 0.5,
          rotX: Math.random() * Math.PI,
          rotY: Math.random() * Math.PI,
        } as Record<string, unknown> as never);
      }
    } else if (type === 'gravityWell') {
      const cfg = C.gravityWell;
      const pos = randomPosition(cfg.spawnSpread);
      g.hazards.push({
        id: `gw_${Math.random()}`,
        type: 'gravityWell',
        active: true,
        x: pos.x, y: pos.y,
        radius: cfg.pullRadius,
        pullStrength: cfg.pullStrength + level * 5,
      } as Record<string, unknown> as never);
    } else if (type === 'plasmaStorm') {
      const cfg = C.plasmaStorm;
      const angle = Math.random() * Math.PI * 2;
      const dist = cfg.spawnSpread + 400;
      const startX = Math.cos(angle) * dist;
      const startY = Math.sin(angle) * dist;
      const dirAngle = Math.atan2(-startY, -startX) + (Math.random() - 0.5) * 0.5;
      g.hazards.push({
        id: `ps_${Math.random()}`,
        type: 'plasmaStorm',
        active: true,
        x: startX, y: startY,
        vx: Math.cos(dirAngle) * cfg.moveSpeed,
        vy: Math.sin(dirAngle) * cfg.moveSpeed,
        radius: cfg.zoneRadius,
        timer: cfg.duration,
        damagePerSecond: cfg.damagePerSecond + level * 2,
        respawning: false,
        respawnTimer: 0,
      } as Record<string, unknown> as never);
    } else if (type === 'empZone') {
      const cfg = C.empZone;
      const pos = randomPosition(cfg.spawnSpread);
      g.hazards.push({
        id: `emp_${Math.random()}`,
        type: 'emp',
        active: true,
        x: pos.x, y: pos.y,
        radius: cfg.radius,
        cooldown: cfg.cooldown,
        timer: cfg.cooldown,
        disableDuration: cfg.disableDuration,
        empActive: 0,
        empTimer: 0,
      } as Record<string, unknown> as never);
    }
  }
};

export const resetHazards = (g: GameState): void => {
  g.hazards = [];
};
