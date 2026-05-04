/**
 * escortSetup.js — Reusable escort mission initialization.
 * Called from App.jsx (dev mode) and MapOverlay.jsx (normal play) when
 * the selected mission type is 'escort'.
 */
import { GAME_CONFIG } from '../constants/gameConfig';

/**
 * Initialize the escort drone for an escort-type mission.
 * @param {object} g — Game state (game.current)
 * @param {number} level — Current player level
 */
export const setupEscort = (g, level) => {
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
  g.escort.startDist = distance;
};

/**
 * Reset escort state (called when mission is NOT escort type).
 * @param {object} g — Game state (game.current)
 */
export const resetEscort = (g) => {
  g.escort.active = false;
};
