/**
 * engine/missionSetup.js — Shared combat mission initialization.
 *
 * Used by both MapOverlay (normal play) and App.jsx (dev mode) to
 * avoid duplicating the per-mission reset logic.
 */
import { generateMission } from './spawner';
import { setupEscort, resetEscort } from './escortSetup';

/**
 * Set up a combat mission on the game state.
 *
 * @param {object} g       — Game state (game.current)
 * @param {object} mission — Mission descriptor from generateMission
 * @param {number} level   — Current level number
 */
export const setupCombatMission = (g, mission, level) => {
  g.mission = mission;
  g.spawnCooldown = 2.0;
  g.totalTime = 0;
  g.player.x = 0; g.player.y = 0;
  g.player.yaw = Math.PI / 2;
  g.player.vx = 0; g.player.vy = 0;
  g.worldMouse = { x: 0, y: 200 };
  g.enemies = []; g.projectiles = [];
  g.particles = []; g.pickups = []; g.effects = [];

  if (mission.type === 'escort') {
    setupEscort(g, level);
  } else {
    resetEscort(g);
  }
};

/**
 * Convenience: generate a mission from node type and immediately set it up.
 *
 * @param {object} g       — Game state
 * @param {number} level   — Current level
 * @param {string} nodeType — 'combat', 'elite', or 'boss'
 */
export const enterNodeMission = (g, level, nodeType) => {
  const mission = generateMission(level, nodeType);
  setupCombatMission(g, mission, level);
};
