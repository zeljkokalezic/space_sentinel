/**
 * systems/miniboss.ts — Mini-boss AI, attacks, phase transitions, and collision.
 * Delegates to bossCore.ts (shared with boss).
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
 * @returns True if game should stop (mini-boss dead or player dead)
 */
export const updateMiniboss = (
  dt: number,
  g: GameState,
  currentDiffMult: number,
  completeMission: () => void,
  setGameState: (state: string) => void,
): boolean => {
  const C = GAME_CONFIG;
  return updateBossCore(dt, g.miniboss, g, currentDiffMult, C.miniboss.damagePercent, {
    deathColors: [0xf97316, 0xfbbf24],
    guaranteedDrops: null,
    scrapValue: C.miniboss.scrapReward + Math.floor(g.level * 20),
    relicRarity: 'common',
  }, completeMission, setGameState);
};
