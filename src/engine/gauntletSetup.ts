/**
 * gauntletSetup.ts — Gauntlet wave management and wave surge initialization.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import type { GameState, MissionState } from './state';

export const setupGauntlet = (g: GameState, mission: MissionState): void => {
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

  g.mission = { ...mission, target: totalWaves, current: 0 } as MissionState;
};

export const setupWaveSurge = (g: GameState): void => {
  const C = GAME_CONFIG;
  const duration = C.waveSurge?.duration ?? 15;
  const spawnRateMult = C.waveSurge?.spawnRateMult ?? 3;

  g.waveSurge.active = true;
  g.waveSurge.remaining = duration;
  g.waveSurge.spawnRateMult = spawnRateMult;
};

export const resetGauntlet = (g: GameState): void => {
  g.gauntlet.active = false;
  g.gauntlet.currentWave = 0;
  g.gauntlet.totalWaves = 3;
  g.gauntlet.enemiesPerWave = 0;
  g.gauntlet.enemiesSpawnedInWave = 0;
  g.gauntlet.waveDelay = 0;
  g.gauntlet.betweenWaves = false;
};

export const resetWaveSurge = (g: GameState): void => {
  g.waveSurge.active = false;
  g.waveSurge.remaining = 0;
  g.waveSurge.spawnRateMult = 3;
};
