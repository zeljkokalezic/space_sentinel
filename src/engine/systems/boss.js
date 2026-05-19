/**
 * systems/boss.js — Boss AI, attacks, phase transitions, and collision.
 * Delegates to bossCore.js (shared with miniboss).
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { updateBossCore } from './bossCore';

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {function} completeMission — Mission completion callback
 * @param {function} setGameState — React state setter
 * @returns {boolean} — True if game should stop (boss dead or player dead)
 */
export const updateBoss = (dt, g, currentDiffMult, completeMission, setGameState) => {
  const C = GAME_CONFIG;
  return updateBossCore(dt, g.boss, g, currentDiffMult, 1, {
    deathColors: [0xdc2626, 0xfbbf24],
    guaranteedDrops: C.boss.guaranteedDrops,
    scrapValue: C.boss.scrapReward,
  }, completeMission, setGameState);
};
