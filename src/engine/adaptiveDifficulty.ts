/**
 * adaptiveDifficulty.ts — Dynamic difficulty adjustment based on player pressure.
 *
 * Monitors the player's situation (enemies, HP, incoming fire, distance to threats)
 * and adjusts spawn rates and enemy aggression to keep the experience engaging
 * without being overwhelming.
 *
 * Pressure formula (0–1 scale):
 *   0.30 × (activeEnemies / maxExpectedEnemies)
 * + 0.30 × (1 − hpPercent)
 * + 0.25 × (incomingProjectiles / maxExpectedProjectiles)
 * + 0.15 × (1 − nearestThreatDist / worldBounds)
 *
 * Reactions:
 *   High pressure (>0.7 for 3s)  → reduce spawn rate by 15–25%
 *   Low pressure  (<0.3 for 5s)  → increase enemy aggression by 10–20%
 *   Rampage mode (3 consecutive missions with >80% HP) → enemies get 20% more HP/speed
 */

interface PositionedEntity {
  x: number;
  y: number;
  active?: boolean;
  isEnemy?: boolean;
}

interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface AdaptiveDifficultyState {
  pressureScore: number;
  pressureHistory: number[];
  lowPressureTimer: number;
  highPressureTimer: number;
  rampageMode: boolean;
  missionsHighHp: number;
  spawnRateMult: number;
  enemyAggressionMult: number;
}

interface AdaptiveDifficultyGameState {
  player: PlayerState;
  enemies: PositionedEntity[];
  projectiles: PositionedEntity[];
  level: number;
  wave: number;
  adaptiveDifficulty?: AdaptiveDifficultyState | null;
}

/**
 * Calculate the current pressure score (0-1).
 */
export const calculatePressure = (g: AdaptiveDifficultyGameState): number => {
  const { player, enemies, projectiles } = g;
  const worldBounds = 4000; // matches GAME_CONFIG.player.worldBounds

  // --- Component 1: active enemy density ---
  const maxExpectedEnemies = Math.max(5, g.level * 3 + g.wave * 2);
  const activeEnemies = enemies.filter(e => e.active).length;
  const enemyRatio = Math.min(activeEnemies / maxExpectedEnemies, 1);

  // --- Component 2: player HP deficit ---
  const hpPercent = player.hp / player.maxHp;
  const hpDeficit = 1 - hpPercent;

  // --- Component 3: incoming projectile density ---
  const maxExpectedProjectiles = Math.max(10, g.level * 4 + g.wave * 3);
  const incomingProjectiles = projectiles.filter(p => p.active && p.isEnemy).length;
  const projectileRatio = Math.min(incomingProjectiles / maxExpectedProjectiles, 1);

  // --- Component 4: nearest threat proximity ---
  let nearestDist = worldBounds; // default: no threat = far away
  const activeEnemiesList = enemies.filter(e => e.active);
  for (const enemy of activeEnemiesList) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) nearestDist = dist;
  }
  const nearestThreatRatio = 1 - Math.min(nearestDist / worldBounds, 1);

  // --- Weighted sum ---
  const pressure =
    0.30 * enemyRatio +
    0.30 * hpDeficit +
    0.25 * projectileRatio +
    0.15 * nearestThreatRatio;

  return Math.max(0, Math.min(1, pressure));
};

/**
 * Update adaptive difficulty state for one frame.
 *
 * @param {number} dt — Delta time in seconds
 * @param {Object} g  — Game state (mutated in place)
 */
export const updateAdaptiveDifficulty = (dt: number, g: AdaptiveDifficultyGameState): void => {
  const ad = g.adaptiveDifficulty;
  if (!ad) return;

  // Calculate current pressure
  const pressure = calculatePressure(g);
  ad.pressureScore = pressure;

  // Rolling history: push and trim to last 60 samples (~1 second at 60fps)
  ad.pressureHistory.push(pressure);
  if (ad.pressureHistory.length > 60) {
    ad.pressureHistory.shift();
  }

  // Smoothed pressure from recent history
  const smoothed = ad.pressureHistory.length > 0
    ? ad.pressureHistory.reduce((a, b) => a + b, 0) / ad.pressureHistory.length
    : pressure;

 // --- High pressure response: reduce spawn rate ---
  if (pressure > 0.7 && smoothed > 0.7) {
    ad.highPressureTimer += dt;
    ad.lowPressureTimer = 0;

    if (ad.highPressureTimer >= 3) {
      // Scale reduction from 15% to 25% based on how far above 0.7
      const intensity = Math.min((smoothed - 0.7) / 0.3, 1);
      const reduction = 0.15 + intensity * 0.1;
      ad.spawnRateMult = Math.max(0.5, 1 - reduction);
    } else {
      ad.spawnRateMult = 1;
    }
  } else {
    ad.highPressureTimer = 0;
    ad.spawnRateMult = 1;
  }

  // --- Low pressure response: increase aggression ---
  if (pressure < 0.3 && smoothed < 0.3) {
    ad.lowPressureTimer += dt;
    ad.highPressureTimer = 0;

    if (ad.lowPressureTimer >= 5) {
      // Scale aggression from 10% to 20% based on how far below 0.3
      const intensity = Math.min((0.3 - smoothed) / 0.3, 1);
      const increase = 0.1 + intensity * 0.1;
      ad.enemyAggressionMult = 1 + increase;
    } else {
      ad.enemyAggressionMult = 1;
    }
  } else {
    ad.lowPressureTimer = 0;
    ad.enemyAggressionMult = 1;
  }
};

/**
 * Get the adaptive spawn cooldown, applying the current spawn rate multiplier.
 *
 * @param {Object} g — Game state
 * @param {number} baseCooldown — Base spawn cooldown in seconds
 * @returns {number} Adjusted cooldown (higher = slower spawning under pressure)
 */
export const getAdaptiveSpawnCooldown = (
  g: Pick<AdaptiveDifficultyGameState, 'adaptiveDifficulty'>,
  baseCooldown: number,
): number => {
  const ad = g.adaptiveDifficulty;
  if (!ad || ad.spawnRateMult >= 1) return baseCooldown;
  return baseCooldown / ad.spawnRateMult;
};

/**
 * Get the current enemy aggression multiplier.
 *
 * @param {Object} g — Game state
 * @returns {number} Aggression multiplier (≥1, higher = more aggressive enemies)
 */
export const getAdaptiveAggression = (
  g: Pick<AdaptiveDifficultyGameState, 'adaptiveDifficulty'>,
): number => {
  const ad = g.adaptiveDifficulty;
  if (!ad) return 1;
  return ad.enemyAggressionMult;
};

/**
 * Record a mission completion for rampage mode tracking.
 * If the player completed with >80% HP, increment the consecutive high-HP counter.
 * If 3 consecutive missions are completed with >80% HP, activate rampage mode.
 *
 * @param {Object} g — Game state
 */
export const recordMissionCompletion = (
  g: Pick<AdaptiveDifficultyGameState, 'adaptiveDifficulty' | 'player'>,
): void => {
  const ad = g.adaptiveDifficulty;
  if (!ad) return;

  const hpPercent = g.player.hp / g.player.maxHp;
  if (hpPercent > 0.8) {
    ad.missionsHighHp += 1;
    if (ad.missionsHighHp >= 3) {
      ad.rampageMode = true;
    }
  } else {
    // Reset streak on non-high-HP completion
    ad.missionsHighHp = 0;
    ad.rampageMode = false;
  }
};

/**
 * Reset the rampage streak and mode.
 * Call this when starting a new sector or resetting the game.
 *
 * @param {Object} g — Game state
 */
export const resetRampageStreak = (
  g: Pick<AdaptiveDifficultyGameState, 'adaptiveDifficulty'>,
): void => {
  const ad = g.adaptiveDifficulty;
  if (!ad) return;

  ad.missionsHighHp = 0;
  ad.rampageMode = false;
};
