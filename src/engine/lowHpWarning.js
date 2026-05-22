/**
 * lowHpWarning.js — Low HP warning system.
 *
 * Pure calculation for warning level + intensity based on player HP ratio.
 * Also provides updateLowHpWarning() for the game loop to call each frame.
 *
 * Visual: Red screen-edge vignette that pulses. Intensity maps to alpha.
 * Audio: Heartbeat sound that plays at increasing frequency as HP drops.
 *
 * No Three.js imports — safe for unit testing.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { SoundManager } from './audio';

/**
 * Calculate the low HP warning level and intensity.
 * Pure function — no side effects, no game state mutation.
 *
 * @param {number} hp — Current player HP
 * @param {number} maxHp — Maximum player HP
 * @returns {{ active: boolean, level: number, isCritical: boolean, intensity: number }}
 *   - active: true if HP is below warning threshold
 *   - level: 0=none, 1=warning, 2=critical
 *   - isCritical: true if HP is below critical threshold
 *   - intensity: 0-1, maps to visual opacity/alpha
 */
export const getLowHpWarningLevel = (hp, maxHp) => {
  const C = GAME_CONFIG.lowHpWarning;

  if (maxHp <= 0) {
    return { active: false, level: 0, isCritical: false, intensity: 0 };
  }

  const ratio = Math.max(0, hp) / maxHp;

  if (ratio > C.warningThreshold) {
    return { active: false, level: 0, isCritical: false, intensity: 0 };
  }

  const isCritical = ratio <= C.criticalThreshold;

  // Intensity: 0 at warningThreshold, 1 at 0 HP
  // Linear interpolation between warningThreshold and 0
  const intensity = Math.max(0, Math.min(1, 1 - (ratio / C.warningThreshold)));

  return {
    active: true,
    level: isCritical ? 2 : 1,
    isCritical,
    intensity,
  };
};

/**
 * Update low HP warning state each frame.
 * Mutates g.lowHpWarning. Plays heartbeat sound when timer expires.
 *
 * @param {number} dt — Delta time in seconds
 * @param {object} g — Game state
 */
export const updateLowHpWarning = (dt, g) => {
  if (!g.lowHpWarning) return; // Guard: may not exist in test mocks

  const C = GAME_CONFIG.lowHpWarning;

  const warning = getLowHpWarningLevel(g.player.hp, g.player.maxHp);

  if (!warning.active) {
    g.lowHpWarning.active = false;
    g.lowHpWarning.intensity = 0;
    g.lowHpWarning.pulseTimer = 0;
    g.lowHpWarning.heartbeatTimer = 0;
    return;
  }

  g.lowHpWarning.active = true;
  g.lowHpWarning.intensity = warning.intensity;
  g.lowHpWarning.isCritical = warning.isCritical;

  // Pulse timer — used for visual pulsing (sin wave)
  g.lowHpWarning.pulseTimer = (g.lowHpWarning.pulseTimer + dt) % C.pulsePeriod;

  // Heartbeat audio — play at intervals that decrease as HP drops
  const heartbeatInterval = warning.isCritical
    ? C.heartbeatInterval * 0.5 // Faster heartbeat when critical
    : C.heartbeatInterval;

  g.lowHpWarning.heartbeatTimer += dt;
  if (g.lowHpWarning.heartbeatTimer >= heartbeatInterval) {
    g.lowHpWarning.heartbeatTimer = 0;
    SoundManager.play('heartbeat');
  }
};
