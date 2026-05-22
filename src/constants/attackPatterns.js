/**
 * attackPatterns.js — Boss attack pattern function library.
 *
 * Each pattern is a function: (g, boss, angle, damage, speed) => void
 *   g       — game state (for pushing projectiles)
 *   boss    — boss entity (reads spiralAngle, writes spiralAngle)
 *   angle   — angle from boss to player (radians)
 *   damage  — base projectile damage (already scaled by diffMult)
 *   speed   — base projectile speed (from GAME_CONFIG.boss.projectileSpeed)
 *
 * Patterns mutate g.projectiles via fireProjectile() and may read/write
 * boss.spiralAngle for rotating patterns.
 */

import { fireProjectile } from '../engine/combat';

/**
 * single_aimed — One projectile directly at player.
 */
export const single_aimed = (g, boss, angle, damage, speed) => {
  fireProjectile(g, boss.x, boss.y, angle, speed, damage, 'enemy_bullet', 0);
};

/**
 * spread_shot — 3 projectiles in a narrow fan toward player.
 * @param {number} count   — Number of projectiles (default 3)
 * @param {number} spread  — Total spread angle in radians (default 0.3)
 */
export const spread_shot = (g, boss, angle, damage, speed) => {
  const count = 3;
  const spread = 0.3;
  for (let i = 0; i < count; i++) {
    const a = angle - spread + (i / (count - 1)) * spread * 2;
    fireProjectile(g, boss.x, boss.y, a, speed, damage, 'enemy_bullet', 0);
  }
};

/**
 * spiral_barrage — 3 projectiles in a rotating spiral.
 * Updates boss.spiralAngle for next call.
 */
export const spiral_barrage = (g, boss, angle, damage, speed) => {
  for (let i = 0; i < 3; i++) {
    const spiralA = boss.spiralAngle + (i * Math.PI * 2 / 3);
    fireProjectile(g, boss.x, boss.y, spiralA, speed * 0.8, damage * 0.5, 'enemy_bullet', 0);
  }
  boss.spiralAngle += 0.5;
};

/**
 * burst_ring — 8 projectiles in a full circle around boss.
 */
export const burst_ring = (g, boss, angle, damage, speed) => {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    fireProjectile(g, boss.x, boss.y, a, speed * 0.7, damage * 0.6, 'enemy_bullet', 0);
  }
};

/**
 * double_aimed — Two projectiles slightly offset from player angle.
 */
export const double_aimed = (g, boss, angle, damage, speed) => {
  fireProjectile(g, boss.x, boss.y, angle - 0.1, speed, damage, 'enemy_bullet', 0);
  fireProjectile(g, boss.x, boss.y, angle + 0.1, speed, damage, 'enemy_bullet', 0);
};

/**
 * wide_spread — 7 projectiles in a wide fan (0.5 rad total).
 */
export const wide_spread = (g, boss, angle, damage, speed) => {
  const count = 7;
  const spread = 0.5;
  for (let i = 0; i < count; i++) {
    const a = angle - spread + (i / (count - 1)) * spread * 2;
    fireProjectile(g, boss.x, boss.y, a, speed, damage, 'enemy_bullet', 0);
  }
};

/**
 * zigzag_spread — 5 projectiles alternating left/right of center.
 */
export const zigzag_spread = (g, boss, angle, damage, speed) => {
  for (let i = 0; i < 5; i++) {
    const a = angle + (i % 2 === 0 ? -0.2 : 0.2) + (i - 2) * 0.08;
    fireProjectile(g, boss.x, boss.y, a, speed, damage, 'enemy_bullet', 0);
  }
};

/**
 * orbiting_mines — 6 slow projectiles in a rotating ring.
 * Updates boss.spiralAngle for next call.
 */
export const orbiting_mines = (g, boss, angle, damage, speed) => {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + boss.spiralAngle;
    fireProjectile(g, boss.x, boss.y, a, speed * 0.4, damage * 0.4, 'enemy_bullet', 0);
  }
  boss.spiralAngle += 0.3;
};

/**
 * homing_burst — 3 homing missiles in a narrow spread toward player.
 */
export const homing_burst = (g, boss, angle, damage, speed) => {
  for (let i = 0; i < 3; i++) {
    const a = angle + (i - 1) * 0.15;
    fireProjectile(g, boss.x, boss.y, a, speed * 0.6, damage * 0.7, 'enemy_missile', 0);
  }
};

/**
 * delayed_burst — 6 projectiles in a ring with staggered speeds.
 * Creates a "pulsing outward" effect: inner ring arrives first,
 * outer ring lags behind, giving the player a brief moment to react.
 * The stagger is configurable via GAME_CONFIG.boss.delayedBurst.
 */
export const delayed_burst = (g, boss, angle, damage, speed) => {
  const C = GAME_CONFIG.boss.delayedBurst;
  const count = C.count;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const speedMult = C.baseMult + C.stagger * (i % C.rings);
    fireProjectile(g, boss.x, boss.y, a, speed * speedMult, damage * C.damageMult, 'enemy_bullet', 0);
  }
};

/**
 * All attack patterns — exported as a map for lookup by key.
 */
export const ATTACK_PATTERNS = {
  single_aimed,
  spread_shot,
  spiral_barrage,
  burst_ring,
  double_aimed,
  wide_spread,
  zigzag_spread,
  orbiting_mines,
  homing_burst,
  delayed_burst,
};
