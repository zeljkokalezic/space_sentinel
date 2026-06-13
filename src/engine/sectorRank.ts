/**
 * sectorRank.ts — Sector progression: rank calculation, rewards, and buffs.
 */
import type { GameState } from './state';

const RANK_THRESHOLDS = {
  S: 85,
  A: 70,
  B: 50,
  C: 30,
} as const;

const BUFF_CHOICES = [
  { id: 'max_shield_start', name: 'Full Shield Start', description: 'Start next sector with shields fully restored' },
  { id: 'free_weapon', name: 'Free Weapon', description: 'Gain 500 scrap toward weapon upgrades' },
  { id: 'scrap_bonus', name: 'Scrap Bonus (+100)', description: 'Start next sector with +100 bonus scrap' },
  { id: 'speed_boost', name: 'Speed Boost (+10%)', description: 'Increase movement speed by 10% for next sector' },
] as const;

export interface SectorRankResult {
  rank: string;
  score: number;
  hpScore: number;
  efficiencyScore: number;
  scrapScore: number;
  timeScore: number;
}

/**
 * HP score: 0–40 based on average HP percentage across missions.
 */
export function calcHpScore(avgHpPercent: number): number {
  return Math.min(40, Math.max(0, Math.round((avgHpPercent / 100) * 40)));
}

/**
 * Efficiency score: 0–30 based on missions completed vs cleared.
 */
export function calcEfficiencyScore(completed: number, cleared: number): number {
  if (cleared === 0 || cleared === undefined || cleared === null) return 0;
  const ratio = completed / cleared;
  return Math.min(30, Math.max(0, Math.round(ratio * 30)));
}

/**
 * Scrap score: 0–20 based on total scrap earned during sector.
 */
export function calcScrapScore(totalScrap: number): number {
  const raw = totalScrap / 250;
  return Math.min(20, Math.max(0, Math.round(raw)));
}

/**
 * Time score: 0–10 based on average mission time (seconds).
 */
export function calcTimeScore(avgTime: number): number {
  if (avgTime <= 0) return 10;
  const raw = Math.max(0, 10 - (avgTime / 120) * 10);
  return Math.min(10, Math.max(0, Math.round(raw)));
}

/**
 * Determine rank letter from a total score (0–100).
 */
export function getRankFromScore(score: number): string {
  if (score >= RANK_THRESHOLDS.S) return 'S';
  if (score >= RANK_THRESHOLDS.A) return 'A';
  if (score >= RANK_THRESHOLDS.B) return 'B';
  if (score >= RANK_THRESHOLDS.C) return 'C';
  return 'D';
}

/**
 * Calculate the full sector rank from game state.
 */
export function calculateSectorRank(g: GameState): SectorRankResult {
  if (!g || !g.sector) {
    return { rank: 'D', score: 0, hpScore: 0, efficiencyScore: 0, scrapScore: 0, timeScore: 0 };
  }
  const s = g.sector;

  const avgHpPercent = s.totalHpPercent > 0
    ? s.totalHpPercent / s.missionsCleared
    : 100;

  const times = s.missionEndTime.map((end, i) => {
    const start = s.missionStartTime[i] ?? 0;
    return Math.max(0, end - start);
  });
  const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

  const hpScore = calcHpScore(avgHpPercent);
  const efficiencyScore = calcEfficiencyScore(s.missionsCompleted, s.missionsCleared);
  const scrapScore = calcScrapScore(g.totalScrapEarned);
  const timeScore = calcTimeScore(avgTime);

  const score = hpScore + efficiencyScore + scrapScore + timeScore;
  const rank = getRankFromScore(score);

  return { rank, score, hpScore, efficiencyScore, scrapScore, timeScore };
}

/**
 * Apply rewards based on sector rank.
 */
export function applySectorRewards(g: GameState, rank: string): void {
  if (!g?.sector) return;
  const s = g.sector;
  s.rank = rank;

  if (rank === 'S') {
    s.veteranMode = true;
    s.consecutiveARank++;
  } else if (rank === 'A') {
    s.consecutiveARank++;
  } else {
    s.consecutiveARank = 0;
  }
}

/**
 * Return the available buff choices.
 */
export function getBuffChoices(): Array<{ id: string; name: string; description: string }> {
  return BUFF_CHOICES.map(b => ({ ...b }));
}

/**
 * Apply a selected buff to game state.
 */
export function applyBuff(g: GameState, buffId: string): void {
  if (!g?.sector) return;
  const s = g.sector;
  s.activeBuff = buffId;

  switch (buffId) {
    case 'max_shield_start':
      g.player.shield = g.player.maxShield;
      break;
    case 'free_weapon':
      g.scrap += 500;
      break;
    case 'scrap_bonus':
      g.scrap += 100;
      break;
    case 'speed_boost':
      g.player.speed = Math.round(g.player.speed * 1.1);
      break;
    default:
      break;
  }
}

/**
 * Record a mission completion for rank calculation.
 */
export function recordMissionCompletion(g: GameState): void {
  if (!g?.sector) return;
  const s = g.sector;
  const hpPercent = (g.player.hp / g.player.maxHp) * 100;

  s.missionsCleared++;
  s.missionsCompleted++;
  s.totalHpPercent += hpPercent;
  s.missionEndTime.push(g.totalTime);
}

/**
 * Reset sector state for the next sector.
 */
export function resetSector(g: GameState): void {
  if (!g?.sector) return;
  const s = g.sector;
  s.number++;
  s.rank = null;
  s.rankScore = 0;
  s.missionsCleared = 0;
  s.missionsCompleted = 0;
  s.totalHpPercent = 0;
  s.missionStartTime = [];
  s.missionEndTime = [];
}
