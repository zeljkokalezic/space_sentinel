/**
 * systems/enemies.js — Enemy AI movement, firing, collision.
 *
 * Supports formation-based AI: enemies with a `formation` property
 * follow coordinated movement patterns. Enemies without a formation
 * use the legacy direct-charge behavior (backward compatible).
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, killEnemy, triggerScreenShake, triggerHitStop, triggerPlayerIFrames, checkShieldBreak, spawnDamageNumber } from '../combat';
import { tryFireEnemyWeapon } from './enemyFire';
import { SoundManager } from '../audio';

/**
 * Check if damage should bypass shield due to armor-pierce mark.
 * @param {object} e — Enemy entity
 * @returns {boolean} true if shield should be bypassed this hit
 */
function isShieldBypassedByArmorPierce(e) {
  return !!(e._armorPierced && e._armorPierced.hitsLeft > 0);
}

// ─── Formation handlers ──────────────────────────────────────────────────────

/**
 * Vanguard: spread wide at spawn, then converge on target after a delay.
 * Creates a "closing net" feel.
 */
function updateVanguard(dt, e, g, tx, ty) {
  const C = GAME_CONFIG.formations.vanguard;
  e.formationTimer -= dt;

  if (e.formationTimer > 0) {
    // Phase 1: hold position / drift slowly outward
    const angle = Math.atan2(ty - e.y, tx - e.x);
    e.x -= Math.cos(angle) * e.speed * 0.2 * dt;
    e.y -= Math.sin(angle) * e.speed * 0.2 * dt;
    e.formationPhase = 'spread';
  } else {
    // Phase 2: converge fast
    const angle = Math.atan2(ty - e.y, tx - e.x);
    const speed = e.speed * C.convergeSpeedMult;
    e.x += Math.cos(angle) * speed * dt;
    e.y += Math.sin(angle) * speed * dt;
    e.formationPhase = 'engage';
  }
}

/**
 * Orbit: circle the target at a set radius, then rush in when triggered.
 */
function updateOrbit(dt, e, g, tx, ty, dist) {
  const C = GAME_CONFIG.formations.orbit;
  const angleToTarget = Math.atan2(ty - e.y, tx - e.x);

  if (e.formationPhase === 'approach') {
    // Move toward orbit radius
    const targetDist = C.orbitRadius;
    if (dist > targetDist + 30) {
      // Move inward
      e.x += Math.cos(angleToTarget) * e.speed * dt;
      e.y += Math.sin(angleToTarget) * e.speed * dt;
    } else if (dist < targetDist - 30) {
      // Move outward
      e.x -= Math.cos(angleToTarget) * e.speed * dt;
      e.y -= Math.sin(angleToTarget) * e.speed * dt;
    } else {
      // Reached orbit radius — start orbiting
      e.formationPhase = 'orbit';
    }
  } else if (e.formationPhase === 'orbit') {
    // Circle around target
    e.orbitAngle = (e.orbitAngle || 0) + C.orbitSpeed * dt;
    const orbitX = tx + Math.cos(e.orbitAngle) * C.orbitRadius;
    const orbitY = ty + Math.sin(e.orbitAngle) * C.orbitRadius;
    e.x += (orbitX - e.x) * 3 * dt;
    e.y += (orbitY - e.y) * 3 * dt;

    // Rush if player is close or after timer
    e.formationTimer -= dt;
    if (dist < C.orbitRadius * C.rushThreshold || e.formationTimer <= 0) {
      e.formationPhase = 'engage';
    }
  } else {
    // Phase 3: rush in
    const speed = e.speed * 1.5;
    e.x += Math.cos(angleToTarget) * speed * dt;
    e.y += Math.sin(angleToTarget) * speed * dt;
  }
}

/**
 * Swarm: boids-lite flocking (separation + cohesion + alignment toward target).
 * Only checks against other swarm enemies to keep it O(N) per group.
 */
function updateSwarm(dt, e, g, tx, ty) {
  const C = GAME_CONFIG.formations.swarm;
  const separationDist = C.separationDist;

  // Find nearby swarm enemies
  const nearby = g.enemies.filter(
    other => other !== e && other.active && other.formation === 'swarm' &&
      Math.hypot(other.x - e.x, other.y - e.y) < separationDist * 4
  );

  let sepX = 0, sepY = 0; // separation
  let cohX = 0, cohY = 0; // cohesion (toward group center)
  let aliVx = 0, aliVy = 0; // alignment (match group velocity)

  if (nearby.length > 0) {
    for (const other of nearby) {
      const dx = e.x - other.x;
      const dy = e.y - other.y;
      const d = Math.hypot(dx, dy) || 1;

      if (d < separationDist) {
        // Separation: push away from too-close neighbors
        sepX += (dx / d) * (separationDist - d);
        sepY += (dy / d) * (separationDist - d);
      }
      cohX += other.x;
      cohY += other.y;
      aliVx += Math.cos(other.angle || 0);
      aliVy += Math.sin(other.angle || 0);
    }

    cohX = cohX / nearby.length - e.x;
    cohY = cohY / nearby.length - e.y;
    const cohDist = Math.hypot(cohX, cohY) || 1;
    cohX /= cohDist;
    cohY /= cohDist;

    aliVx /= nearby.length;
    aliVy /= nearby.length;
  }

  // Target direction
  const targetAngle = Math.atan2(ty - e.y, tx - e.x);
  let moveX = Math.cos(targetAngle);
  let moveY = Math.sin(targetAngle);

  // Blend behaviors
  moveX = moveX + sepX * 0.05 + cohX * C.cohesionWeight + aliVx * C.alignmentWeight;
  moveY = moveY + sepY * 0.05 + cohY * C.cohesionWeight + aliVy * C.alignmentWeight;

  const moveDist = Math.hypot(moveX, moveY) || 1;
  e.x += (moveX / moveDist) * e.speed * dt;
  e.y += (moveY / moveDist) * e.speed * dt;

  // Track facing angle for alignment
  e.angle = Math.atan2(moveY, moveX);
  e.formationPhase = 'engage';
}

/**
 * Kamikaze: direct charge with sine-wave lateral movement.
 */
function updateKamikaze(dt, e, g, tx, ty) {
  const C = GAME_CONFIG.formations.kamikaze;
  const angle = Math.atan2(ty - e.y, tx - e.x);

  // Base forward movement
  let moveX = Math.cos(angle);
  let moveY = Math.sin(angle);

  // Lateral sine wave (perpendicular to target direction)
  const lateral = Math.sin(g.totalTime * C.lateralFreq + e.id * 10) * C.lateralAmplitude;
  moveX += Math.cos(angle + Math.PI / 2) * lateral * dt;
  moveY += Math.sin(angle + Math.PI / 2) * lateral * dt;

  const speed = e.speed * C.speedMult;
  e.x += moveX * speed * dt;
  e.y += moveY * speed * dt;
  e.formationPhase = 'engage';
}

/**
 * Bomber: approach from outside, stop at mid-range, fire burst, retreat, repeat.
 */
function updateBomber(dt, e, g, tx, ty, dist) {
  const C = GAME_CONFIG.formations.bomber;
  const angle = Math.atan2(ty - e.y, tx - e.x);

  if (e.formationPhase === 'approach') {
    // Move toward firing position
    if (dist > C.approachRadius + 50) {
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
    } else {
      e.formationPhase = 'fire';
      e.formationTimer = 1.5; // fire duration
      e.burstCount = 0;
      e.burstCooldown = 0.3;
    }
  } else if (e.formationPhase === 'fire') {
    // Hold position and fire spread shots
    e.burstCooldown -= dt;
    if (e.burstCooldown <= 0 && e.burstCount < C.fireBurstCount) {
      // Fire spread shots via the enemy fire system
      const spread = (e.burstCount - (C.fireBurstCount - 1) / 2) * 0.3;
      tryFireEnemyWeapon(e, angle + spread, dist, 0, 1, g);
      e.burstCount++;
      e.burstCooldown = 0.3;
    }
    e.formationTimer -= dt;
    if (e.formationTimer <= 0) {
      e.formationPhase = 'retreat';
      e.formationTimer = 2;
    }
  } else if (e.formationPhase === 'retreat') {
    // Back away
    e.x -= Math.cos(angle) * e.speed * 0.8 * dt;
    e.y -= Math.sin(angle) * e.speed * 0.8 * dt;
    e.formationTimer -= dt;
    if (e.formationTimer <= 0 || dist > C.approachRadius + C.retreatDist) {
      e.formationPhase = 'approach';
      e.burstCount = 0;
    }
  }
}

/**
 * Screen: form a line/wall, slowly advancing while shooting through.
 */
function updateScreen(dt, e, g, tx, ty) {
  const C = GAME_CONFIG.formations.screen;
  const angleToTarget = Math.atan2(ty - e.y, tx - e.x);

  // Perpendicular direction (for line formation)
  const perpAngle = angleToTarget + Math.PI / 2;

  // Calculate ideal line position based on formation index
  const lineOffset = (e.formationIndex - 2) * C.lineSpacing;
  const targetX = e.x + Math.cos(perpAngle) * lineOffset * 0.1;
  const targetY = e.y + Math.sin(perpAngle) * lineOffset * 0.1;

  // Move toward line position + advance toward target
  e.x += (targetX - e.x) * 2 * dt + Math.cos(angleToTarget) * C.advanceSpeed * dt;
  e.y += (targetY - e.y) * 2 * dt + Math.sin(angleToTarget) * C.advanceSpeed * dt;

  e.formationPhase = 'engage';
}

// ─── Legacy movement (no formation) ──────────────────────────────────────────

/**
 * Legacy direct-charge movement for enemies without a formation property.
 * Preserves existing behavior for backward compatibility.
 */
function updateLegacy(dt, e, g, tx, ty, distToPlayer) {
  // Mini-interceptors: kamikaze behavior — always charge at target, no firing
  if (e.type === 'mini_interceptor') {
    const angle = Math.atan2(ty - e.y, tx - e.x);
    e.x += Math.cos(angle) * e.speed * dt;
    e.y += Math.sin(angle) * e.speed * dt;
    return;
  }

  let moveAngle = Math.atan2(ty - e.y, tx - e.x);
  if (e.type === 'interceptor') moveAngle += Math.sin(g.totalTime * 4 + e.id) * 0.8;

  let moveSpeed = e.speed;
  if (e.type === 'shooter') {
    if      (distToPlayer < GAME_CONFIG.player.radius * 8) moveSpeed = e.speed * -0.5;
    else if (distToPlayer < GAME_CONFIG.player.radius * 10) moveSpeed = 0;
  } else if (e.type === 'missile_boat') {
    if      (distToPlayer < GAME_CONFIG.player.radius * 13) moveSpeed = e.speed * -1;
    else if (distToPlayer < GAME_CONFIG.player.radius * 18) moveSpeed = 0;
  }

  e.x += Math.cos(moveAngle) * moveSpeed * dt;
  e.y += Math.sin(moveAngle) * moveSpeed * dt;
}

// ─── Main update loop ────────────────────────────────────────────────────────

const FORMATION_HANDLERS = {
  vanguard: updateVanguard,
  orbit:    updateOrbit,
  swarm:    updateSwarm,
  kamikaze: updateKamikaze,
  bomber:   updateBomber,
  screen:   updateScreen,
};

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {function} completeMission — Mission completion callback
 * @param {function} setGameState — React state setter callback
 * @param {number} [adaptiveAggression=1] — Adaptive aggression multiplier from dynamic difficulty
 */
export const updateEnemies = (dt, g, currentDiffMult, completeMission, setGameState, adaptiveAggression = 1) => {
  const C = GAME_CONFIG;
  for (let e of g.enemies) {
    if (!e.active) continue;

    // Use targetX/targetY if set by beacon/sabotage, otherwise target player
   const tx = e.targetX !== undefined ? e.targetX : g.player.x;
    const ty = e.targetY !== undefined ? e.targetY : g.player.y;
    const distToPlayer = Math.hypot(tx - e.x, ty - e.y);

    // ── Movement (formation or legacy) ──
    if (e.formation && FORMATION_HANDLERS[e.formation]) {
      FORMATION_HANDLERS[e.formation](dt, e, g, tx, ty, distToPlayer);
    } else {
      updateLegacy(dt, e, g, tx, ty, distToPlayer);
    }

    // ── Enemy firing (skip mini-interceptors — they're kamikaze) ──
    const angle = Math.atan2(ty - e.y, tx - e.x);
    if (e.type !== 'mini_interceptor') {
      tryFireEnemyWeapon(e, angle, distToPlayer, dt, currentDiffMult, g, adaptiveAggression);
    }

    // ── Enemy rams player ──
    if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < e.radius + g.player.radius) {
      // Check invincibility frames — block ram damage if invincible
      if (g.playerIFrames && g.playerIFrames.isInvincible) {
        createParticles(g, e.x, e.y, 0x60a5fa, 5);
        // Push enemy away
        const pushAngle = Math.atan2(e.y - g.player.y, e.x - g.player.x);
        e.x += Math.cos(pushAngle) * 40;
        e.y += Math.sin(pushAngle) * 40;
      } else {
        const baseDmg = e.type === 'heavy' ? 20 : C.weapons.autocannon.baseDamage;
        let dmg = baseDmg * currentDiffMult;
        let shieldAbsorbed = 0;
        let shieldAbsorbedVal = 0;
        const playerShieldWasFull = g.player.shield > 0 && g.player.maxShield > 0;
        if (g.player.shield > 0) {
          shieldAbsorbedVal = Math.min(g.player.shield, dmg);
          g.player.shield -= shieldAbsorbedVal; dmg -= shieldAbsorbedVal;
          if (shieldAbsorbedVal > 0) shieldAbsorbed = true;
        }
        if (playerShieldWasFull && g.player.shield <= 0) {
          checkShieldBreak(g, g.player, g.player.x, g.player.y);
        }
        if (shieldAbsorbed) SoundManager.play('shield_hit');
        else SoundManager.play('player_hit');
        g.player.hp -= dmg;
        triggerScreenShake(g, 'playerHit');
        triggerHitStop(g, 'playerHit');
        triggerPlayerIFrames(g);
        let eDamage = C.weapons.missiles.baseDamage;
        const enemyShieldWasFull = e.shield > 0 && e.maxShield > 0;

        // Armor-pierce: skip shield absorption for armor-pierced enemies
        if (isShieldBypassedByArmorPierce(e)) {
          e._armorPierced.hitsLeft--;
          if (e._armorPierced.hitsLeft <= 0) delete e._armorPierced;
        } else if (e.shield > 0) {
          const absorb = Math.min(e.shield, eDamage);
          e.shield -= absorb;
          eDamage -= absorb;
        }
        e.hp -= eDamage;
        if (enemyShieldWasFull && e.shield <= 0) {
          checkShieldBreak(g, e, e.x, e.y);
        }
        spawnDamageNumber(g, g.player.x, g.player.y - 10, dmg, { hitType: 'playerHit', shieldDamage: shieldAbsorbedVal });
        e.x += Math.cos(angle + Math.PI) * 30;
        e.y += Math.sin(angle + Math.PI) * 30;
        createParticles(g, e.x, e.y, 0xef4444, 10);
        if (g.player.hp <= 0) { setGameState('gameover'); return; }
      }
    }

    // ── Enemy dies ──
    if (e.hp <= 0) {
      killEnemy(g, e, completeMission);
      triggerScreenShake(g, e.type === 'heavy' || e.type === 'missile_boat' || e.type === 'shielded' ? 'bigExplosion' : 'explosion');
    }
  }
};
