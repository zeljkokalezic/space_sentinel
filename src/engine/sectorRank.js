/**
 * sectorRank.js — Sector progression: rank calculation, rewards, and buffs.
 *
 * Provides pure and stateful helpers for evaluating sector performance,
 * granting rank-based rewards, and applying persistent buffs.
 */

/* ──────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────── */

/** Rank thresholds (score out of 100) */
const RANK_THRESHOLDS = {
  S: 85,
  A: 70,
  B: 50,
  C: 30,
};

/** Available buff choices offered after an A or S rank */
const BUFF_CHOICES = [
  { id: 'max_shield_start', name: 'Full Shield Start', description: 'Start next sector with shields fully restored' },
  { id: 'free_weapon', name: 'Free Weapon', description: 'Gain 500 scrap toward weapon upgrades' },
  { id: 'scrap_bonus', name: 'Scrap Bonus (+100)', description: 'Start next sector with +100 bonus scrap' },
  { id: 'speed_boost', name: 'Speed Boost (+10%)', description: 'Increase movement speed by 10% for next sector' },
];

/* ──────────────────────────────────────────────
 * Score components (pure)
 * ────────────────────────────────────────────── */

/**
 * HP score: 0–40 based on average HP percentage across missions.
 * @param {number} avgHpPercent — Average HP percentage (0–100)
 * @returns {number} Score clamped 0–40
 */
export function calcHpScore(avgHpPercent) {
  return Math.min(40, Math.max(0, Math.round((avgHpPercent / 100) * 40)));
}

/**
 * Efficiency score: 0–30 based on missions completed vs cleared.
 * @param {number} completed — Missions completed
 * @param {number} cleared — Missions cleared (total mission nodes)
 * @returns {number} Score clamped 0–30
 */
export function calcEfficiencyScore(completed, cleared) {
  if (cleared === 0 || cleared === undefined || cleared === null) return 0;
  const ratio = completed / cleared;
  return Math.min(30, Math.max(0, Math.round(ratio * 30)));
}

/**
 * Scrap score: 0–20 based on total scrap earned during sector.
 * @param {number} totalScrap — Total scrap earned
 * @returns {number} Score clamped 0–20
 */
export function calcScrapScore(totalScrap) {
  const raw = totalScrap / 250;
  return Math.min(20, Math.max(0, Math.round(raw)));
}

/**
 * Time score: 0–10 based on average mission time (seconds).
 * Faster = higher score.  Baseline 120 s = full marks.
 * @param {number} avgTime — Average mission time in seconds
 * @returns {number} Score clamped 0–10
 */
export function calcTimeScore(avgTime) {
  if (avgTime <= 0) return 10;
  const raw = Math.max(0, 10 - (avgTime / 120) * 10);
  return Math.min(10, Math.max(0, Math.round(raw)));
}

/* ──────────────────────────────────────────────
 * Rank calculation (pure)
 * ────────────────────────────────────────────── */

/**
 * Determine rank letter from a total score (0–100).
 * @param {number} score
 * @returns {string} 'S'|'A'|'B'|'C'|'D'
 */
export function getRankFromScore(score) {
  if (score >= RANK_THRESHOLDS.S) return 'S';
  if (score >= RANK_THRESHOLDS.A) return 'A';
  if (score >= RANK_THRESHOLDS.B) return 'B';
  if (score >= RANK_THRESHOLDS.C) return 'C';
  return 'D';
}

/**
 * Calculate the full sector rank from game state.
 *
 * Computes all four score components and returns the final rank.
 * @param {GameState} g — Game state
 * @returns {{ rank: string, score: number, hpScore: number, efficiencyScore: number, scrapScore: number, timeScore: number }}
 */
export function calculateSectorRank(g) {
  if (!g || !g.sector) {
    return { rank: 'D', score: 0, hpScore: 0, efficiencyScore: 0, scrapScore: 0, timeScore: 0 };
  }
  const s = g.sector;

  // Average HP %
  const avgHpPercent = s.totalHpPercent > 0
    ? s.totalHpPercent / s.missionsCleared
    : 100;

  // Average mission time
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

/* ──────────────────────────────────────────────
 * Sector rewards (stateful)
 * ────────────────────────────────────────────── */

/**
 * Apply rewards based on sector rank.
 * - S: enable veteranMode, increment consecutiveARank
 * - A: increment consecutiveARank, present buff choice
 * - Otherwise: reset streak
 *
 * @param {GameState} g — Game state
 * @param {string} rank — The calculated rank letter
 */
export function applySectorRewards(g, rank) {
  if (!g || !g.sector) return;
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

/* ──────────────────────────────────────────────
 * Buff system
 * ────────────────────────────────────────────── */

/**
 * Return the available buff choices.
 * @returns {Array<{id: string, name: string, description: string}>}
 */
export function getBuffChoices() {
  return BUFF_CHOICES.map(b => ({ ...b }));
}

/**
 * Apply a selected buff to game state.
 * @param {GameState} g — Game state
 * @param {string} buffId — Buff identifier
 */
export function applyBuff(g, buffId) {
  if (!g || !g.sector) return;
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

/* ──────────────────────────────────────────────
 * Mission tracking helpers
 * ────────────────────────────────────────────── */

/**
 * Record a mission completion for rank calculation.
 * Stores HP percentage and timing data.
 * @param {GameState} g — Game state
 */
export function recordMissionCompletion(g) {
  if (!g || !g.sector) return;
  const s = g.sector;
  const hpPercent = (g.player.hp / g.player.maxHp) * 100;

  s.missionsCleared++;
  s.missionsCompleted++;
  s.totalHpPercent += hpPercent;
  s.missionStartTime.push(g.totalTime);
  s.missionEndTime.push(g.totalTime);
}

/**
 * Reset sector state for the next sector.
 * Increments sector number, resets mission tracking,
 * preserves rank history / veteran mode / active buff / streak.
 * @param {GameState} g — Game state
 */
export function resetSector(g) {
  if (!g || !g.sector) return;
  const s = g.sector;
  s.number++;
  s.rank = null;
  s.rankScore = 0;
  s.missionsCleared = 0;
  s.missionsCompleted = 0;
  s.totalHpPercent = 0;
  s.missionStartTime = [];
  s.missionEndTime = [];
  // veteranMode, consecutiveARank, activeBuff persist
}
