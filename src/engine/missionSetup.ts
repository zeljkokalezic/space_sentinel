/**
 * missionSetup.ts — Shared combat mission initialization.
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
import type { GameState, MissionState } from './state';

/**
 * Set up a combat mission on the game state.
 */
export const setupCombatMission = (g: GameState, mission: MissionState, level: number): void => {
  g.mission = mission;
  g.spawnCooldown = 2.0;
  g.totalTime = 0;
  g.lastMissionSummary = null;
  g.missionStartStats = {
    enemiesDestroyed: g.stats?.enemiesDestroyed ?? 0,
  };
  if (g.sector) {
    g.sector.missionStartTime.push(g.totalTime);
  }
  g.player.x = 0; g.player.y = 0;
  g.player.yaw = Math.PI / 2;
  g.player.vx = 0; g.player.vy = 0;
  g.worldMouse = { x: 0, y: 200 };
  resetEntityPools(g);

  resetEscort(g);
  resetBeacon(g);
  resetSabotage(g);
  resetBoss(g);
  resetMiniboss(g);
  resetGauntlet(g);
  resetWaveSurge(g);

  const SETUP_MAP: Record<string, () => void> = {
    escort:      () => setupEscort(g, level),
    defend:      () => setupBeacon(g, level),
    sabotage:    () => setupSabotage(g, level),
    kill_boss:   () => { setupBoss(g, level); g.mission = { ...mission, current: 0, target: 1 } as MissionState; },
    kill_miniboss: () => { setupMiniboss(g, level); g.mission = { ...mission, current: 0, target: 1 } as MissionState; },
    gauntlet:    () => setupGauntlet(g, mission),
    wave_surge:  () => setupWaveSurge(g),
  };
  SETUP_MAP[mission.type]?.();

  if (mission.hazardTypes && mission.hazardTypes.length > 0) {
    setupHazards(g, level, mission.hazardTypes);
  } else {
    resetHazards(g);
  }

  if (mission.weatherTypes && mission.weatherTypes.length > 0) {
    initWeather(g, mission.weatherTypes);
  } else {
    resetWeather(g);
  }
};

/**
 * Convenience: generate a mission from node type and immediately set it up.
 */
export const enterNodeMission = (g: GameState, level: number, nodeType: string, node?: Record<string, unknown>): void => {
  const mission = generateMission(level, nodeType);
  if (node?.hazardTypes) {
    mission.hazardTypes = node.hazardTypes as string[];
  }
  if (node?.weatherTypes) {
    mission.weatherTypes = node.weatherTypes as string[];
  } else if (g.map?.weatherTypes) {
    mission.weatherTypes = g.map.weatherTypes;
  }
  setupCombatMission(g, mission, level);
};
