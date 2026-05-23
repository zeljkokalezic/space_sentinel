/**
 * engine/missionSetup.js — Shared combat mission initialization.
 *
 * Used by both MapOverlay (normal play) and App.jsx (dev mode) to
 * avoid duplicating the per-mission reset logic.
 */
import { generateMission } from './spawner';
import { setupEscort, resetEscort } from './escortSetup';
import { setupBeacon, resetBeacon } from './beaconSetup';
import { setupSabotage, resetSabotage } from './sabotageSetup';
import { setupBoss, resetBoss } from './bossSetup';
import { setupMiniboss, resetMiniboss } from './minibossSetup';
import { setupHazards, resetHazards } from './hazardSetup';
import { setupGauntlet, resetGauntlet, setupWaveSurge, resetWaveSurge } from './gauntletSetup';

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
    resetBeacon(g);
    resetSabotage(g);
    resetBoss(g);
    resetMiniboss(g);
    resetGauntlet(g);
    resetWaveSurge(g);
  } else if (mission.type === 'defend') {
    setupBeacon(g, level);
    resetEscort(g);
    resetSabotage(g);
    resetBoss(g);
    resetMiniboss(g);
    resetGauntlet(g);
    resetWaveSurge(g);
  } else if (mission.type === 'sabotage') {
    setupSabotage(g, level);
    resetEscort(g);
    resetBeacon(g);
    resetBoss(g);
    resetMiniboss(g);
    resetGauntlet(g);
    resetWaveSurge(g);
  } else if (mission.type === 'kill_boss') {
    setupBoss(g, level);
    resetEscort(g);
    resetBeacon(g);
    resetSabotage(g);
    resetMiniboss(g);
    resetGauntlet(g);
    resetWaveSurge(g);
    g.mission = { ...mission, current: 0, target: 1 };
  } else if (mission.type === 'kill_miniboss') {
    setupMiniboss(g, level);
    resetEscort(g);
    resetBeacon(g);
    resetSabotage(g);
    resetBoss(g);
    resetGauntlet(g);
    resetWaveSurge(g);
    g.mission = { ...mission, current: 0, target: 1 };
  } else if (mission.type === 'gauntlet') {
    setupGauntlet(g, mission);
    resetEscort(g);
    resetBeacon(g);
    resetSabotage(g);
    resetBoss(g);
    resetMiniboss(g);
    resetWaveSurge(g);
  } else if (mission.type === 'wave_surge') {
    setupWaveSurge(g);
    resetEscort(g);
    resetBeacon(g);
    resetSabotage(g);
    resetBoss(g);
    resetMiniboss(g);
    resetGauntlet(g);
  } else {
    resetEscort(g);
    resetBeacon(g);
    resetSabotage(g);
    resetBoss(g);
    resetMiniboss(g);
    resetGauntlet(g);
    resetWaveSurge(g);
  }

  // ─── Environmental hazards ───────────────────────────────────────────────────
  if (mission.hazardTypes && mission.hazardTypes.length > 0) {
    setupHazards(g, level, mission.hazardTypes);
  } else {
    resetHazards(g);
  }
};

/**
 * Convenience: generate a mission from node type and immediately set it up.
 *
 * @param {object} g       — Game state
 * @param {number} level   — Current level
 * @param {string} nodeType — 'combat', 'elite', or 'boss'
 * @param {object} [node]  — Optional full map node (for hazard types)
 */
export const enterNodeMission = (g, level, nodeType, node) => {
  const mission = generateMission(level, nodeType);
  if (node && node.hazardTypes) {
    mission.hazardTypes = node.hazardTypes;
  }
  setupCombatMission(g, mission, level);
};
