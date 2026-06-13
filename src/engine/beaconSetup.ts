/**
 * beaconSetup.ts — Reusable beacon (defend mission) initialization.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import type { GameState } from './state';

/**
 * Initialize the beacon for a defend-type mission.
 */
export const setupBeacon = (g: GameState, level: number): void => {
  const C = GAME_CONFIG;
  const angle = Math.random() * Math.PI * 2;
  const dist = C.beacon.spawnSpread;

  g.beacon.active = true;
  g.beacon.hp = g.beacon.maxHp = C.beacon.baseHp + level * C.beacon.hpPerLevel;
  g.beacon.x = g.player.x + Math.cos(angle) * dist;
  g.beacon.y = g.player.y + Math.sin(angle) * dist;
  g.beacon.radius = C.beacon.radius;
};

/**
 * Reset beacon state (called when mission is NOT defend type).
 */
export const resetBeacon = (g: GameState): void => {
  g.beacon.active = false;
  g.beacon.hp = 0;
  g.beacon.maxHp = 0;
};
