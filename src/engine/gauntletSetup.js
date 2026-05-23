/**
 * gauntletSetup.js — Gauntlet wave management and wave surge initialization.
 *
 * Gauntlet missions consist of fixed waves of enemies with a delay between waves.
 * Wave surge missions apply a spawn rate multiplier for a set duration.
 */
import { GAME_CONFIG } from '../constants/gameConfig';

/**
 * Initialize a gauntlet mission.
 * @param {object} g — Game state (game.current)
 * @param {object} mission — Mission descriptor from generateMission
 */
export const setupGauntlet = (g, mission) => {
  const C = GAME_CONFIG;
  const totalWaves = C.gauntlet?.totalWaves ?? 3;
  const waveDelay = C.gauntlet?.waveDelay ?? 2;

  g.gauntlet.active = true;
  g.gauntlet.currentWave = 0;
  g.gauntlet.totalWaves = totalWaves;
  g.gauntlet.enemiesPerWave = 5 + g.level * 2;
  g.gauntlet.enemiesSpawnedInWave = 0;
  g.gauntlet.waveDelay = waveDelay;
  g.gauntlet.betweenWaves = false;

  // Update mission to reflect gauntlet config
  g.mission = { ...mission, target: totalWaves, current: 0 };
};

/**
 * Initialize a wave surge mission.
 * @param {object} g — Game state (game.current)
 */
export const setupWaveSurge = (g) => {
  const C = GAME_CONFIG;
  const duration = C.waveSurge?.duration ?? 15;
  const spawnRateMult = C.waveSurge?.spawnRateMult ?? 3;

  g.waveSurge.active = true;
  g.waveSurge.remaining = duration;
  g.waveSurge.spawnRateMult = spawnRateMult;
};

/**
 * Reset gauntlet state (called when mission is NOT gauntlet type).
 * @param {object} g — Game state (game.current)
 */
export const resetGauntlet = (g) => {
  g.gauntlet.active = false;
  g.gauntlet.currentWave = 0;
  g.gauntlet.totalWaves = 3;
  g.gauntlet.enemiesPerWave = 0;
  g.gauntlet.enemiesSpawnedInWave = 0;
  g.gauntlet.waveDelay = 0;
  g.gauntlet.betweenWaves = false;
};

/**
 * Reset wave surge state (called when mission is NOT wave_surge type).
 * @param {object} g — Game state (game.current)
 */
export const resetWaveSurge = (g) => {
  g.waveSurge.active = false;
  g.waveSurge.remaining = 0;
  g.waveSurge.spawnRateMult = 3;
};
