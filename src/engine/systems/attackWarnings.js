/**
 * systems/attackWarnings.js — Enemy attack telegraphing system.
 *
 * Shows visual warning indicators at predicted impact locations before
 * enemies fire, giving players time to dodge. Works with the enemy fire
 * system to create a two-phase firing cycle:
 *   1. Warning phase: indicator appears at predicted impact point
 *   2. Fire phase: warning expires, projectile launches
 *
 * Warning indicators are rendered as pulsing red circles that shrink
 * as the fire timer counts down, creating urgency.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

let _warningId = 0;

/**
 * Spawn an attack warning indicator at a predicted impact location.
 * When the warning timer expires, the fireCallback is invoked to
 * actually fire the projectile.
 *
 * @param {object} g — Game state
 * @param {number} x — Predicted impact X
 * @param {number} y — Predicted impact Y
 * @param {number} duration — Warning duration in seconds
 * @param {number} radius — Warning indicator radius
 * @param {function} fireCallback — Called when warning expires to fire the projectile
 */
export const spawnAttackWarning = (g, x, y, duration, radius, fireCallback) => {
  if (!g || !g.attackWarnings) return;
  const C = GAME_CONFIG.attackWarning;

  g.attackWarnings.push({
    id: ++_warningId,
    x,
    y,
    radius,
    life: duration,
    maxLife: duration,
    color: C.color,
    active: true,
    fireCallback,
  });
};

/**
 * Get the warning config for a specific enemy type.
 * Falls back to defaults if no type-specific config exists.
 *
 * @param {string} enemyType — Enemy type name
 * @returns {{ duration: number, radius: number }}
 */
export const getWarningConfig = (enemyType) => {
  const C = GAME_CONFIG.attackWarning;
  const typeConfig = C.types?.[enemyType];
  if (typeConfig) {
    return {
      duration: typeConfig.duration ?? C.duration,
      radius: typeConfig.radius ?? C.radius,
    };
  }
  return { duration: C.duration, radius: C.radius };
};

/**
 * Update attack warning indicators.
 * Counts down timers, removes expired warnings, and triggers fire callbacks.
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updateAttackWarnings = (dt, g) => {
  if (!g || !g.attackWarnings) return;

  for (let w of g.attackWarnings) {
    if (!w.active) continue;

    w.life -= dt;

    if (w.life <= 0) {
      // Warning expired — fire the projectile
      w.active = false;
      if (w.fireCallback) {
        w.fireCallback();
      }
    }
  }

  g.attackWarnings = g.attackWarnings.filter(w => w.active);
};
