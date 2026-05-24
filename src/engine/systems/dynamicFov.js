/**
 * systems/dynamicFov.js — Dynamic field-of-view camera system.
 *
 * Narrows FOV during intense moments (boss fights, low HP, big hits)
 * to create focus and tension. Widens during calm/release moments
 * (boss death) for a sense of celebration.
 *
 * This is a classic "game feel" technique used in professional games
 * to guide player attention and amplify emotional beats.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

/**
 * Update dynamic FOV target based on current game state.
 * Called each physics frame — smoothly lerps camera FOV toward target.
 *
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updateDynamicFov = (dt, g) => {
  if (!g || !g.dynamicFov) return;
  const fov = g.dynamicFov;
  const C = GAME_CONFIG.dynamicFov;

  // ─── Hit FOV snap (brief dramatic zoom on big hits) ──────────────────
  if (fov.hitTimer > 0) {
    fov.hitTimer -= dt;
    fov.target = C.hitFov;
    // Immediately snap to hit FOV for maximum impact
    fov.current = C.hitFov;
    return; // Hit takes priority over all other FOV targets
  }

  // ─── Boss death FOV widen (celebration/release) ───────────────────────
  if (fov.bossDeathTimer > 0) {
    fov.bossDeathTimer -= dt;
    fov.target = C.bossDeathFov;
    // Lerp toward widened FOV
    fov.current += (fov.target - fov.current) * C.lerpSpeed * dt;
    return;
  }

  // ─── Determine target FOV from game state ─────────────────────────────
  let targetFov = C.baseFov;

  // Boss fight: narrower FOV for tension (only after settle time to prevent flicker)
  const bossActive = g.boss?.active && g.boss.hp > 0;
  const minibossActive = g.miniboss?.active && g.miniboss.hp > 0;
  if (bossActive || minibossActive) {
    fov.bossActiveTime += dt;
    if (fov.bossActiveTime >= C.bossSettleTime) {
      targetFov = C.bossFov;
    }
  } else {
    fov.bossActiveTime = 0;
  }

  // Low HP: even narrower for urgency (overrides boss if more extreme)
  const hpRatio = g.player.maxHp > 0 ? g.player.hp / g.player.maxHp : 1;
  if (hpRatio < GAME_CONFIG.lowHpWarning.warningThreshold) {
    // Interpolate between base and lowHpFov based on how desperate HP is
    const urgency = Math.min(1, (GAME_CONFIG.lowHpWarning.warningThreshold - hpRatio) / GAME_CONFIG.lowHpWarning.warningThreshold);
    const lowHpTarget = C.baseFov - urgency * (C.baseFov - C.lowHpFov);
    if (bossActive || minibossActive) {
      // Blend boss FOV with low HP urgency
      targetFov = C.bossFov - urgency * (C.bossFov - C.lowHpFov);
    } else {
      targetFov = lowHpTarget;
    }
  }

  // ─── Smooth lerp toward target ────────────────────────────────────────
  fov.target = targetFov;
  fov.current += (fov.target - fov.current) * C.lerpSpeed * dt;
};

/**
 * Trigger a brief FOV snap for dramatic impact.
 * Call this when a big hit occurs (boss hit, big explosion, etc.).
 *
 * @param {object} g — Game state
 */
export const triggerFovHit = (g) => {
  if (!g || !g.dynamicFov) return;
  g.dynamicFov.hitTimer = GAME_CONFIG.dynamicFov.hitDuration;
};

/**
 * Trigger FOV widen for boss death celebration.
 *
 * @param {object} g — Game state
 */
export const triggerFovBossDeath = (g) => {
  if (!g || !g.dynamicFov) return;
  g.dynamicFov.bossDeathTimer = GAME_CONFIG.dynamicFov.bossDeathDuration;
};
