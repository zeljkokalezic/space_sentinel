/**
 * escortSetup.js — Reusable escort mission initialization.
 * Called from App.jsx (dev mode) and MapOverlay.jsx (normal play) when
 * the selected mission type is 'escort'.
 */

/**
 * Initialize the escort drone for an escort-type mission.
 * @param {object} g — Game state (game.current)
 * @param {number} level — Current player level
 */
export const setupEscort = (g, level) => {
  const angle = Math.random() * Math.PI * 2;
  const distance = 1000 + level * 80;

  g.escort.active = true;
  g.escort.hp = g.escort.maxHp = 120 + level * 25;
  g.escort.lives = Math.max(1, 3 - Math.floor(level / 4));
  g.escort.x = (Math.random() - 0.5) * 300;
  g.escort.y = (Math.random() - 0.5) * 300;
  g.escort.targetX = Math.max(-3500, Math.min(3500, g.escort.x + Math.cos(angle) * distance));
  g.escort.targetY = Math.max(-3500, Math.min(3500, g.escort.y + Math.sin(angle) * distance));
  g.escort.speed = 55 + level * 3;
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
