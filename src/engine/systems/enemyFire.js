/**
 * enemyFire.js — Shared enemy firing logic for both player and escort targets.
 *
 * Two-phase firing with attack telegraphing:
 *   Phase 1 (warning): When cooldown expires, spawn a warning indicator at
 *     the predicted impact location. The indicator pulses for the configured
 *     warning duration, giving the player time to react.
 *   Phase 2 (fire): When the warning timer expires, the actual projectile
 *     is launched from the enemy's current position.
 *
 * This makes enemy attacks readable and fair — players can see incoming
 * fire before it launches and dodge accordingly.
 */
import { fireProjectile } from '../combat';
import { spawnAttackWarning, getWarningConfig } from './attackWarnings';
import { GAME_CONFIG } from '../../constants/gameConfig';

/**
 * Attempt to fire an enemy weapon at a target.
 * Uses a two-phase system: warning indicator → projectile launch.
 *
 * When the enemy's fireCooldown expires, instead of firing immediately,
 * a warning indicator is spawned at the predicted impact location. After
 * the warning duration elapses, the projectile is launched.
 *
 * @param {object} enemy — Enemy entity
 * @param {number} angle — Angle toward target (radians)
 * @param {number} distToTarget — Distance to target
 * @param {number} dt — Delta time (seconds)
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {object} g — Game state
 * @returns {boolean} true if a weapon was fired (or warning started), false otherwise
 */
export const tryFireEnemyWeapon = (enemy, angle, distToTarget, dt, currentDiffMult, g) => {
  const C = GAME_CONFIG;
  if (enemy.fireCooldown === undefined) return false;

  // If enemy is in warning phase, count down the warning timer
  if (enemy.warningTimer !== undefined && enemy.warningTimer > 0) {
    enemy.warningTimer -= dt;
    return false; // Don't start a new warning while one is active
  }

  enemy.fireCooldown -= dt;
  if (enemy.fireCooldown > 0) return false;

  // Clear the warning timer for next cycle
  enemy.warningTimer = undefined;

  if (enemy.type === 'shooter' && distToTarget < C.player.radius * C.enemyWeapons.shooter.rangeMult) {
    const wc = getWarningConfig('shooter');
    // Predicted impact: one projectile travel time ahead of current target
    const travelTime = distToTarget / C.weapons.missiles.baseSpeed;
    const predictedX = (g.escort?.active ? g.escort.x : g.player.x) + (g.escort?.active ? g.escort.vx || 0 : g.player.vx) * travelTime;
    const predictedY = (g.escort?.active ? g.escort.y : g.player.y) + (g.escort?.active ? g.escort.vy || 0 : g.player.vy) * travelTime;

    // Spawn warning indicator at predicted impact location
    spawnAttackWarning(g, predictedX, predictedY, wc.duration, wc.radius, () => {
      // Fire callback — actually launch the projectile
      fireProjectile(g, enemy.x, enemy.y, angle, C.weapons.missiles.baseSpeed, C.enemyWeapons.shooter.damage * currentDiffMult, 'enemy_bullet');
    });

    // Set warning timer on enemy to prevent re-firing during warning phase
    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = C.enemyWeapons.shooter.cooldownMin + Math.random() * C.enemyWeapons.shooter.cooldownVariance;
    return true;
  }

  if (enemy.type === 'missile_boat' && distToTarget < C.player.radius * C.enemyWeapons.missile_boat.rangeMult) {
    const wc = getWarningConfig('missile_boat');
    const targetX = g.escort?.active ? g.escort.x : g.player.x;
    const targetY = g.escort?.active ? g.escort.y : g.player.y;

    // Spawn warning indicators for both missiles
    spawnAttackWarning(g, targetX - 30, targetY, wc.duration, wc.radius, () => {
      fireProjectile(g, enemy.x, enemy.y, angle - 0.5, C.enemyWeapons.missile_boat.missileSpeed, C.enemyWeapons.missile_boat.missileDamage * currentDiffMult, 'enemy_missile');
    });
    spawnAttackWarning(g, targetX + 30, targetY, wc.duration, wc.radius, () => {
      fireProjectile(g, enemy.x, enemy.y, angle + 0.5, C.enemyWeapons.missile_boat.missileSpeed, C.enemyWeapons.missile_boat.missileDamage * currentDiffMult, 'enemy_missile');
    });

    // Set warning timer on enemy to prevent re-firing during warning phase
    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = C.enemyWeapons.missile_boat.cooldown;
    return true;
  }

  return false;
};
