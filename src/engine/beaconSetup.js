/**
 * beaconSetup.js — Reusable beacon (defend mission) initialization.
 * Called from App.jsx (dev mode) and MapOverlay.jsx (normal play) when
 * the selected mission type is 'defend'.
 */
import { GAME_CONFIG } from '../constants/gameConfig';

/**
 * Initialize the beacon for a defend-type mission.
 * @param {object} g — Game state (game.current)
 * @param {number} level — Current player level
 */
export const setupBeacon = (g, level) => {
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
 * @param {object} g — Game state (game.current)
 */
export const resetBeacon = (g) => {
  g.beacon.active = false;
  g.beacon.hp = 0;
  g.beacon.maxHp = 0;
};
