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
import { getEnemyTarget } from '../targeting';
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
 * @param {number} [adaptiveAggression=1] — Adaptive aggression multiplier from dynamic difficulty
 * @returns {boolean} true if a weapon was fired (or warning started), false otherwise
 */
export const tryFireEnemyWeapon = (enemy, angle, distToTarget, dt, currentDiffMult, g, adaptiveAggression = 1) => {
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

  // Helper: apply adaptive aggression as fire cooldown multiplier
  const applyAggression = (baseCooldown) => baseCooldown / adaptiveAggression;

  // ── Elite variant: Sniper (based on shooter) ──
  if (enemy.eliteVariant === 'sniper' && distToTarget < C.player.radius * C.eliteVariants.sniper.rangeMult) {
    const ev = C.eliteVariants.sniper;
    const travelTime = distToTarget / ev.projectileSpeed;
    const predictedX = (getEnemyTarget(g).x) + ((g.escort?.active ? g.escort.vx || 0 : g.player.vx)) * travelTime;
    const predictedY = (getEnemyTarget(g).y) + ((g.escort?.active ? g.escort.vy || 0 : g.player.vy)) * travelTime;

    spawnAttackWarning(g, predictedX, predictedY, ev.warningDuration, 25, () => {
      if (!enemy.active || enemy.hp <= 0) return;
      const tx = getEnemyTarget(g).x;
      const ty = getEnemyTarget(g).y;
      const currentAngle = Math.atan2(ty - enemy.y, tx - enemy.x);
      fireProjectile(g, enemy.x, enemy.y, currentAngle, ev.projectileSpeed, ev.damage * currentDiffMult, 'enemy_bullet');
    });

    enemy.warningTimer = ev.warningDuration;
    enemy.fireCooldown = applyAggression(ev.cooldownMin);
    return true;
  }

  // ── Elite variant: Arsenal (based on missile_boat) ──
  if (enemy.eliteVariant === 'arsenal' && distToTarget < C.player.radius * C.enemyWeapons.missile_boat.rangeMult) {
    const ev = C.eliteVariants.arsenal;
    const wc = getWarningConfig('missile_boat');
    const targetX = getEnemyTarget(g).x;
    const targetY = getEnemyTarget(g).y;
    const baseAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    const spread = 0.3;

    for (let i = 0; i < ev.missileCount; i++) {
      const angleOffset = (i - (ev.missileCount - 1) / 2) * spread;
      const missileAngle = baseAngle + angleOffset;
      const impactX = targetX + Math.cos(missileAngle) * 20;
      const impactY = targetY + Math.sin(missileAngle) * 20;

      spawnAttackWarning(g, impactX, impactY, wc.duration, wc.radius, () => {
        if (!enemy.active || enemy.hp <= 0) return;
        fireProjectile(g, enemy.x, enemy.y, missileAngle, C.enemyWeapons.missile_boat.missileSpeed, ev.missileDamage * currentDiffMult, 'enemy_missile');
      });
    }

    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = applyAggression(ev.cooldownMin);
    return true;
  }

  // ── Elite variant: Tank (based on heavy) ──
  if (enemy.eliteVariant === 'tank' && distToTarget < C.player.radius * C.enemyWeapons.heavy.rangeMult) {
    const wc = getWarningConfig('heavy');
    const targetX = getEnemyTarget(g).x;
    const targetY = getEnemyTarget(g).y;

    spawnAttackWarning(g, targetX, targetY, wc.duration, wc.radius, () => {
      if (!enemy.active || enemy.hp <= 0) return;
      const tx = getEnemyTarget(g).x;
      const ty = getEnemyTarget(g).y;
      const currentAngle = Math.atan2(ty - enemy.y, tx - enemy.x);
      fireProjectile(g, enemy.x, enemy.y, currentAngle, C.enemyWeapons.heavy.projectileSpeed, C.enemyWeapons.heavy.damage * currentDiffMult, C.enemyWeapons.heavy.projectileType, 0);
    });

    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = applyAggression(C.eliteVariants.tank.cooldownMin);
    return true;
  }

  // ── Elite variant: Swarm Leader (based on interceptor) ──
  if (enemy.eliteVariant === 'swarmLeader' && distToTarget < C.player.radius * C.enemyWeapons.interceptor.rangeMult) {
    const wc = getWarningConfig('interceptor');
    const targetX = getEnemyTarget(g).x;
    const targetY = getEnemyTarget(g).y;
    const baseAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    const spread = C.enemyWeapons.interceptor.burstSpread;
    const count = C.enemyWeapons.interceptor.burstCount;

    for (let i = 0; i < count; i++) {
      const angleOffset = (i - (count - 1) / 2) * spread;
      const burstAngle = baseAngle + angleOffset;
      const travelTime = distToTarget / C.enemyWeapons.interceptor.projectileSpeed;
      const impactX = targetX + Math.cos(burstAngle) * travelTime * ((g.escort?.active ? g.escort.vx || 0 : g.player.vx)) * 0.1;
      const impactY = targetY + Math.sin(burstAngle) * travelTime * ((g.escort?.active ? g.escort.vy || 0 : g.player.vy)) * 0.1;

      spawnAttackWarning(g, impactX, impactY, wc.duration, wc.radius, () => {
        if (!enemy.active || enemy.hp <= 0) return;
        fireProjectile(g, enemy.x, enemy.y, burstAngle, C.enemyWeapons.interceptor.projectileSpeed, C.enemyWeapons.interceptor.damage * currentDiffMult, C.enemyWeapons.interceptor.projectileType, 0);
      });
    }

    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = applyAggression(C.enemyWeapons.interceptor.cooldownMin + Math.random() * C.enemyWeapons.interceptor.cooldownVariance);
    return true;
  }

  if (enemy.type === 'shooter' && distToTarget < C.player.radius * C.enemyWeapons.shooter.rangeMult) {
    const wc = getWarningConfig('shooter');
    // Predicted impact: one projectile travel time ahead of current target
    const travelTime = distToTarget / C.weapons.missiles.baseSpeed;
    const predictedX = (getEnemyTarget(g).x) + ((g.escort?.active ? g.escort.vx || 0 : g.player.vx)) * travelTime;
    const predictedY = (getEnemyTarget(g).y) + ((g.escort?.active ? g.escort.vy || 0 : g.player.vy)) * travelTime;

    // Spawn warning indicator at predicted impact location
    spawnAttackWarning(g, predictedX, predictedY, wc.duration, wc.radius, () => {
      if (!enemy.active || enemy.hp <= 0) return;
      const tx = getEnemyTarget(g).x;
      const ty = getEnemyTarget(g).y;
      const currentAngle = Math.atan2(ty - enemy.y, tx - enemy.x);
      fireProjectile(g, enemy.x, enemy.y, currentAngle, C.weapons.missiles.baseSpeed, C.enemyWeapons.shooter.damage * currentDiffMult, 'enemy_bullet');
    });

    // Set warning timer on enemy to prevent re-firing during warning phase
    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = applyAggression(C.enemyWeapons.shooter.cooldownMin + Math.random() * C.enemyWeapons.shooter.cooldownVariance);
    return true;
  }

  if (enemy.type === 'missile_boat' && distToTarget < C.player.radius * C.enemyWeapons.missile_boat.rangeMult) {
    const wc = getWarningConfig('missile_boat');
    const targetX = getEnemyTarget(g).x;
    const targetY = getEnemyTarget(g).y;

    // Spawn warning indicators for both missiles
    spawnAttackWarning(g, targetX - 30, targetY, wc.duration, wc.radius, () => {
      if (!enemy.active || enemy.hp <= 0) return;
      const tx = getEnemyTarget(g).x;
      const ty = getEnemyTarget(g).y;
      const currentAngle = Math.atan2(ty - enemy.y, tx - enemy.x);
      fireProjectile(g, enemy.x, enemy.y, currentAngle - 0.5, C.enemyWeapons.missile_boat.missileSpeed, C.enemyWeapons.missile_boat.missileDamage * currentDiffMult, 'enemy_missile');
    });
    spawnAttackWarning(g, targetX + 30, targetY, wc.duration, wc.radius, () => {
      if (!enemy.active || enemy.hp <= 0) return;
      const tx = getEnemyTarget(g).x;
      const ty = getEnemyTarget(g).y;
      const currentAngle = Math.atan2(ty - enemy.y, tx - enemy.x);
      fireProjectile(g, enemy.x, enemy.y, currentAngle + 0.5, C.enemyWeapons.missile_boat.missileSpeed, C.enemyWeapons.missile_boat.missileDamage * currentDiffMult, 'enemy_missile');
    });

    // Set warning timer on enemy to prevent re-firing during warning phase
    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = applyAggression(C.enemyWeapons.missile_boat.cooldown);
    return true;
  }

  // Heavy: slow but powerful cannon shot
  if (enemy.type === 'heavy' && distToTarget < C.player.radius * C.enemyWeapons.heavy.rangeMult) {
    const wc = getWarningConfig('heavy');
    const targetX = getEnemyTarget(g).x;
    const targetY = getEnemyTarget(g).y;

    spawnAttackWarning(g, targetX, targetY, wc.duration, wc.radius, () => {
      if (!enemy.active || enemy.hp <= 0) return;
      const tx = getEnemyTarget(g).x;
      const ty = getEnemyTarget(g).y;
      const currentAngle = Math.atan2(ty - enemy.y, tx - enemy.x);
      fireProjectile(g, enemy.x, enemy.y, currentAngle, C.enemyWeapons.heavy.projectileSpeed, C.enemyWeapons.heavy.damage * currentDiffMult, C.enemyWeapons.heavy.projectileType, 0);
    });

    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = applyAggression(C.enemyWeapons.heavy.cooldownMin + Math.random() * C.enemyWeapons.heavy.cooldownVariance);
    return true;
  }

  // Interceptor: 3-shot burst with spread
  if (enemy.type === 'interceptor' && distToTarget < C.player.radius * C.enemyWeapons.interceptor.rangeMult) {
    const wc = getWarningConfig('interceptor');
    const targetX = getEnemyTarget(g).x;
    const targetY = getEnemyTarget(g).y;
    const baseAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    const spread = C.enemyWeapons.interceptor.burstSpread;
    const count = C.enemyWeapons.interceptor.burstCount;

    // Spawn a warning for each shot in the burst
    for (let i = 0; i < count; i++) {
      const angleOffset = (i - (count - 1) / 2) * spread;
      const burstAngle = baseAngle + angleOffset;
      // Predict impact point for this shot
      const travelTime = distToTarget / C.enemyWeapons.interceptor.projectileSpeed;
      const impactX = targetX + Math.cos(burstAngle) * travelTime * ((g.escort?.active ? g.escort.vx || 0 : g.player.vx)) * 0.1;
      const impactY = targetY + Math.sin(burstAngle) * travelTime * ((g.escort?.active ? g.escort.vy || 0 : g.player.vy)) * 0.1;

      spawnAttackWarning(g, impactX, impactY, wc.duration, wc.radius, () => {
        if (!enemy.active || enemy.hp <= 0) return;
        fireProjectile(g, enemy.x, enemy.y, burstAngle, C.enemyWeapons.interceptor.projectileSpeed, C.enemyWeapons.interceptor.damage * currentDiffMult, C.enemyWeapons.interceptor.projectileType, 0);
      });
    }

    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = applyAggression(C.enemyWeapons.interceptor.cooldownMin + Math.random() * C.enemyWeapons.interceptor.cooldownVariance);
    return true;
  }

  // Fighter: single aimed bullet
  if (enemy.type === 'fighter' && distToTarget < C.player.radius * C.enemyWeapons.fighter.rangeMult) {
    const wc = getWarningConfig('fighter');
    const targetX = getEnemyTarget(g).x;
    const targetY = getEnemyTarget(g).y;

    spawnAttackWarning(g, targetX, targetY, wc.duration, wc.radius, () => {
      if (!enemy.active || enemy.hp <= 0) return;
      const tx = getEnemyTarget(g).x;
      const ty = getEnemyTarget(g).y;
      const currentAngle = Math.atan2(ty - enemy.y, tx - enemy.x);
      fireProjectile(g, enemy.x, enemy.y, currentAngle, C.enemyWeapons.fighter.projectileSpeed, C.enemyWeapons.fighter.damage * currentDiffMult, C.enemyWeapons.fighter.projectileType, 0);
    });

    enemy.warningTimer = wc.duration;
    enemy.fireCooldown = applyAggression(C.enemyWeapons.fighter.cooldownMin + Math.random() * C.enemyWeapons.fighter.cooldownVariance);
    return true;
  }

  return false;
};
