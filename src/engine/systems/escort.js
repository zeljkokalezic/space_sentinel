/**
 * systems/escort.js — Escort drone movement, evasion, collision, and mission checks.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, spawnDamageNumber } from '../combat';
import { getViewportSize } from '../viewport';
import { tryFireEnemyWeapon } from './enemyFire';
import { spawnEffect } from '../pool';

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {function} completeMission — Mission completion callback
 * @param {function} setGameState — React state setter callback
 * @param {number} [adaptiveAggression=1] — Adaptive aggression multiplier from dynamic difficulty
 * @returns {boolean} true if game should stop (gameover triggered)
 */
export const updateEscort = (dt, g, currentDiffMult, completeMission, setGameState, adaptiveAggression = 1) => {
  const C = GAME_CONFIG;
  if (!g.escort.active || !g.mission || g.mission.completed) return false;
  const esc = g.escort;

  // ── Handle respawn (drone destroyed but has lives left) ──
  if (esc.hp <= 0 && esc.lives > 0) {
    esc.lives--;
    esc.respawnTimer = C.escort.respawnTimer;
    esc.hp = esc.maxHp;
  }

  if (esc.respawnTimer > 0) {
    esc.respawnTimer -= dt;
    if (esc.respawnTimer <= 0) {
      esc.x = g.player.x + (Math.random() - 0.5) * C.escort.respawnSpread;
      esc.y = g.player.y + (Math.random() - 0.5) * C.escort.respawnSpread;
    }
  } else if (esc.hp > 0) {
    // ── Move toward destination ──
    const dx = esc.targetX - esc.x;
    const dy = esc.targetY - esc.y;
    const distToTarget = Math.hypot(dx, dy);

    if (distToTarget > C.escort.destinationThreshold) {
      const moveAngle = Math.atan2(dy, dx);
      esc.x += Math.cos(moveAngle) * esc.speed * dt;
      esc.y += Math.sin(moveAngle) * esc.speed * dt;
    }

    // ── Auto-evasion: dodge incoming enemy projectiles ──
    esc.evasionTimer -= dt;
    if (esc.evasionTimer <= 0) {
      let threat = null;
      for (let p of g.projectiles) {
        if (!p.active || !p.isEnemy) continue;
        const pd = Math.hypot(p.x - esc.x, p.y - esc.y);
        if (pd < C.escort.evasionThreatRadius) {
          const pAngle = Math.atan2(p.vy, p.vx);
          const toDroneAngle = Math.atan2(esc.y - p.y, esc.x - p.x);
          let angleDiff = toDroneAngle - pAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (Math.abs(angleDiff) < Math.PI / 2) {
            threat = p;
          }
        }
      }
      if (threat) {
        esc.evasionAngle = Math.atan2(threat.y - esc.y, threat.x - esc.x) + Math.PI / 2;
        esc.evasionTimer = C.escort.evasionCooldown;
      }
    }

    // Apply evasion offset
    if (esc.evasionTimer > 0) {
      esc.x += Math.cos(esc.evasionAngle) * esc.speed * 2 * dt;
      esc.y += Math.sin(esc.evasionAngle) * esc.speed * 2 * dt;
    }

    // Clamp to world bounds
    esc.x = Math.max(-C.escort.worldBounds, Math.min(C.escort.worldBounds, esc.x));
    esc.y = Math.max(-C.escort.worldBounds, Math.min(C.escort.worldBounds, esc.y));

    // Recompute distance after all movement (movement + evasion + clamping)
    const finalDist = Math.hypot(esc.targetX - esc.x, esc.targetY - esc.y);

    // Update mission progress (distance-based) using recomputed distance
    if (esc.startDist > 0) {
      const traveled = esc.startDist - finalDist;
      g.mission.current = Math.max(0, traveled);
      g.mission.target = esc.startDist;
    }

    // Check if drone reached destination
    if (finalDist <= C.escort.destinationThreshold) {
      completeMission();
    }
  }

  // ── Helper: handle escort death ──
  const handleEscortDeath = () => {
    createParticles(g, esc.x, esc.y, 0x22d3ee, 15);
    const { vw, vh } = getViewportSize();
    spawnEffect(g, {
      type: 'mission_complete',
      x: vw / 2,
      y: Math.max(100, vh / 4),
      text: esc.lives > 0 ? `DRONE DESTROYED! ${esc.lives} LIVES LEFT` : 'DRONE DESTROYED!',
      life: 2.5,
    });
    if (esc.lives <= 0) {
      esc.active = false;
      g.player.hp = 0;
      setGameState('gameover');
      return true;
    }
    return false;
  };

  // ── Enemy projectiles hitting escort drone ──
  if (esc.hp > 0 && esc.respawnTimer <= 0) {
    for (let p of g.projectiles) {
      if (!p.active || !p.isEnemy) continue;
      if (Math.hypot(p.x - esc.x, p.y - esc.y) < esc.radius + p.radius) {
        esc.hp -= p.damage;
        p.active = false;
        createParticles(g, p.x, p.y, 0x22d3ee, 5);
        spawnDamageNumber(g, esc.x, esc.y - 10, p.damage, { hitType: 'hull' });
        if (esc.hp <= 0 && handleEscortDeath()) return true;
      }
    }
  }

  // ── Enemies ramming escort drone ──
  if (esc.hp > 0 && esc.respawnTimer <= 0) {
    for (let e of g.enemies) {
      if (!e.active) continue;
      if (Math.hypot(e.x - esc.x, e.y - esc.y) < e.radius + esc.radius) {
        esc.hp -= C.escort.ramDamage;
        createParticles(g, esc.x, esc.y, 0x22d3ee, 10);
        spawnDamageNumber(g, esc.x, esc.y - 10, C.escort.ramDamage, { hitType: 'hull' });
        if (esc.hp <= 0 && handleEscortDeath()) return true;
      }
    }
  }

  // ── Enemies also target the escort drone (in addition to player) ──
  for (let e of g.enemies) {
    if (!e.active) continue;
    const distToEscort = Math.hypot(esc.x - e.x, esc.y - e.y);
    const distToPlayer = Math.hypot(g.player.x - e.x, g.player.y - e.y);
    if (distToEscort < distToPlayer && distToEscort < C.enemies.spawnRadiusMin) {
      const angle = Math.atan2(esc.y - e.y, esc.x - e.x);
      tryFireEnemyWeapon(e, angle, distToEscort, dt, currentDiffMult, g, adaptiveAggression);
    }
  }

  return false;
};
