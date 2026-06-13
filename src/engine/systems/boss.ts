/**
 * systems/boss.ts — Boss AI, attacks, phase transitions, and collision.
 * Delegates to bossCore.ts (shared with miniboss).
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { updateBossCore } from './bossCore';
import type { GameState } from '../state';

/**
 * @param dt — Delta time
 * @param g — Game state
 * @param currentDiffMult — Difficulty multiplier
 * @param completeMission — Mission completion callback
 * @param setGameState — React state setter
 * @returns True if game should stop (boss dead or player dead)
 */
export const updateBoss = (
  dt: number,
  g: GameState,
  currentDiffMult: number,
  completeMission: () => void,
  setGameState: (state: string) => void,
): boolean => {
  const C = GAME_CONFIG;
  return updateBossCore(dt, g.boss, g, currentDiffMult, 1, {
    deathColors: [0xdc2626, 0xfbbf24],
    guaranteedDrops: C.boss.guaranteedDrops,
    scrapValue: C.boss.scrapReward,
  }, completeMission, setGameState);
};
