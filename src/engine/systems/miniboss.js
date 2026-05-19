/**
 * systems/miniboss.js — Mini-boss AI, attacks, phase transitions, and collision.
 * Delegates to bossCore.js (shared with boss).
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { updateBossCore } from './bossCore';

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {function} completeMission — Mission completion callback
 * @param {function} setGameState — React state setter
 * @returns {boolean} — True if game should stop (mini-boss dead or player dead)
 */
export const updateMiniboss = (dt, g, currentDiffMult, completeMission, setGameState) => {
  const C = GAME_CONFIG;
  return updateBossCore(dt, g.miniboss, g, currentDiffMult, C.miniboss.damagePercent, {
    deathColors: [0xf97316, 0xfbbf24],
    guaranteedDrops: null,
    scrapValue: C.miniboss.scrapReward + Math.floor(g.level * 20),
  }, completeMission, setGameState);
};
