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
import { initWeather, resetWeather } from './systems/weather';
import { resetEntityPools } from './pool';

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
  g.lastMissionSummary = null;
  g.missionStartStats = {
    enemiesDestroyed: g.stats?.enemiesDestroyed ?? 0,
  };
  // Record mission start time for sector rank calculation
  if (g.sector) {
    g.sector.missionStartTime.push(g.totalTime);
  }
  g.player.x = 0; g.player.y = 0;
  g.player.yaw = Math.PI / 2;
  g.player.vx = 0; g.player.vy = 0;
  g.worldMouse = { x: 0, y: 200 };
  resetEntityPools(g);

  // Reset all mission subsystems, then set up the active one
  resetEscort(g);
  resetBeacon(g);
  resetSabotage(g);
  resetBoss(g);
  resetMiniboss(g);
  resetGauntlet(g);
  resetWaveSurge(g);

  const SETUP_MAP = {
    escort:      () => setupEscort(g, level),
    defend:      () => setupBeacon(g, level),
    sabotage:    () => setupSabotage(g, level),
    kill_boss:   () => { setupBoss(g, level); g.mission = { ...mission, current: 0, target: 1 }; },
    kill_miniboss: () => { setupMiniboss(g, level); g.mission = { ...mission, current: 0, target: 1 }; },
    gauntlet:    () => setupGauntlet(g, mission),
    wave_surge:  () => setupWaveSurge(g),
  };
  SETUP_MAP[mission.type]?.();

  // ─── Environmental hazards ───────────────────────────────────────────────────
  if (mission.hazardTypes && mission.hazardTypes.length > 0) {
    setupHazards(g, level, mission.hazardTypes);
  } else {
    resetHazards(g);
  }

  // ─── Weather effects ────────────────────────────────────────────────────────
  if (mission.weatherTypes && mission.weatherTypes.length > 0) {
    initWeather(g, mission.weatherTypes);
  } else {
    resetWeather(g);
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
  if (node && node.weatherTypes) {
    mission.weatherTypes = node.weatherTypes;
  } else if (g.map?.weatherTypes) {
    mission.weatherTypes = g.map.weatherTypes;
  }
  setupCombatMission(g, mission, level);
};
