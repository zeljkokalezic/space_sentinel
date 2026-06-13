/**
 * escortSetup.ts — Reusable escort mission initialization.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import type { GameState, EscortState } from './state';

/**
 * Initialize the escort drone for an escort-type mission.
 */
export const setupEscort = (g: GameState, level: number): void => {
  const C = GAME_CONFIG;
  const angle = Math.random() * Math.PI * 2;
  const distance = C.escort.baseDistance + level * C.escort.distancePerLevel;

  g.escort.active = true;
  g.escort.hp = g.escort.maxHp = C.escort.baseHp + level * C.escort.hpPerLevel;
  g.escort.lives = Math.max(C.escort.minLives, C.escort.baseLives - Math.floor(level / 4));
  g.escort.x = (Math.random() - 0.5) * C.escort.spawnSpread;
  g.escort.y = (Math.random() - 0.5) * C.escort.spawnSpread;
  g.escort.targetX = Math.max(-3500, Math.min(3500, g.escort.x + Math.cos(angle) * distance));
  g.escort.targetY = Math.max(-3500, Math.min(3500, g.escort.y + Math.sin(angle) * distance));
  g.escort.speed = C.escort.baseSpeed + level * C.escort.speedPerLevel;
  g.escort.respawnTimer = 0;
  g.escort.evasionTimer = 0;
  g.escort.evasionAngle = 0;
  (g.escort as EscortState & Record<string, unknown>).startDist = distance;
};

/**
 * Reset escort state (called when mission is NOT escort type).
 */
export const resetEscort = (g: GameState): void => {
  g.escort.active = false;
  g.escort.hp = 0;
  g.escort.maxHp = 0;
  g.escort.lives = 0;
  g.escort.x = 0;
  g.escort.y = 0;
  g.escort.targetX = 0;
  g.escort.targetY = 0;
  g.escort.speed = 0;
  g.escort.respawnTimer = 0;
  g.escort.evasionTimer = 0;
  g.escort.evasionAngle = 0;
  (g.escort as EscortState & Record<string, unknown>).startDist = 0;
};
