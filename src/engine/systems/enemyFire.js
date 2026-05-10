/**
 * enemyFire.js — Shared enemy firing logic for both player and escort targets.
 */
import { fireProjectile } from '../combat';
import { GAME_CONFIG } from '../../constants/gameConfig';

/**
 * Attempt to fire an enemy weapon at a target.
 * Decrements the enemy's fireCooldown by dt, checks type + range,
 * fires the appropriate projectile(s), and resets cooldown.
 *
 * @param {object} enemy — Enemy entity
 * @param {number} angle — Angle toward target (radians)
 * @param {number} distToTarget — Distance to target
 * @param {number} dt — Delta time (seconds)
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {object} g — Game state
 * @returns {boolean} true if a weapon was fired, false otherwise
 */
export const tryFireEnemyWeapon = (enemy, angle, distToTarget, dt, currentDiffMult, g) => {
  const C = GAME_CONFIG;
  if (enemy.fireCooldown === undefined) return false;

  enemy.fireCooldown -= dt;
  if (enemy.fireCooldown > 0) return false;

  if (enemy.type === 'shooter' && distToTarget < C.player.radius * 16) {
    fireProjectile(g, enemy.x, enemy.y, angle, C.weapons.missiles.baseSpeed, 15 * currentDiffMult, 'enemy_bullet');
    enemy.fireCooldown = 1.8 + Math.random();
    return true;
  }

  if (enemy.type === 'missile_boat' && distToTarget < C.player.radius * 21) {
    fireProjectile(g, enemy.x, enemy.y, angle - 0.5, 120, 25 * currentDiffMult, 'enemy_missile');
    fireProjectile(g, enemy.x, enemy.y, angle + 0.5, 120, 25 * currentDiffMult, 'enemy_missile');
    enemy.fireCooldown = 4.0;
    return true;
  }

  return false;
};
