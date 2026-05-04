/**
 * systems/escort.js — Escort drone movement, evasion, collision, and mission checks.
 */
import { createParticles, fireProjectile } from '../combat';

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {function} completeMission — Mission completion callback
 * @param {function} setGameState — React state setter callback
 * @returns {boolean} true if game should stop (gameover triggered)
 */
export const updateEscort = (dt, g, currentDiffMult, completeMission, setGameState) => {
  if (!g.escort.active || g.mission?.completed) return false;
  const esc = g.escort;

  // ── Handle respawn (drone destroyed but has lives left) ──
  if (esc.hp <= 0 && esc.lives > 0) {
    esc.respawnTimer = 2.0;
    esc.lives--;
    esc.hp = esc.maxHp;
  }

  if (esc.respawnTimer > 0) {
    esc.respawnTimer -= dt;
    if (esc.respawnTimer <= 0) {
      esc.x = g.player.x + (Math.random() - 0.5) * 100;
      esc.y = g.player.y + (Math.random() - 0.5) * 100;
    }
  } else if (esc.hp > 0) {
    // ── Move toward destination ──
    const dx = esc.targetX - esc.x;
    const dy = esc.targetY - esc.y;
    const distToTarget = Math.hypot(dx, dy);

    // Update mission progress (distance-based)
    if (esc.startDist > 0) {
      const traveled = esc.startDist - distToTarget;
      g.mission.current = Math.max(0, traveled);
      g.mission.target = esc.startDist;
    }

    if (distToTarget > 30) {
      const moveAngle = Math.atan2(dy, dx);
      esc.x += Math.cos(moveAngle) * esc.speed * dt;
      esc.y += Math.sin(moveAngle) * esc.speed * dt;
    }

    // ── Auto-evasion: dodge incoming enemy projectiles ──
    esc.evasionTimer -= dt;
    if (esc.evasionTimer <= 0) {
      let threat = null;
      let closestThreatDist = 200;
      for (let p of g.projectiles) {
        if (!p.active || !p.isEnemy) continue;
        const pd = Math.hypot(p.x - esc.x, p.y - esc.y);
        if (pd < closestThreatDist) {
          const pAngle = Math.atan2(p.vy, p.vx);
          const toDroneAngle = Math.atan2(esc.y - p.y, esc.x - p.x);
          let angleDiff = toDroneAngle - pAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          if (Math.abs(angleDiff) < Math.PI / 2) {
            threat = p;
            closestThreatDist = pd;
          }
        }
      }
      if (threat) {
        esc.evasionAngle = Math.atan2(threat.y - esc.y, threat.x - esc.x) + Math.PI / 2;
        esc.evasionTimer = 0.3;
      }
    }

    // Apply evasion offset
    if (esc.evasionTimer > 0) {
      esc.x += Math.cos(esc.evasionAngle) * esc.speed * 2 * dt;
      esc.y += Math.sin(esc.evasionAngle) * esc.speed * 2 * dt;
    }

    // Clamp to world bounds
    esc.x = Math.max(-3800, Math.min(3800, esc.x));
    esc.y = Math.max(-3800, Math.min(3800, esc.y));

    // Check if drone reached destination
    if (distToTarget <= 30) {
      completeMission();
    }
  }

  // ── Enemy projectiles hitting escort drone ──
  if (esc.hp > 0 && esc.respawnTimer <= 0) {
    for (let p of g.projectiles) {
      if (!p.active || !p.isEnemy) continue;
      if (Math.hypot(p.x - esc.x, p.y - esc.y) < esc.radius + p.radius) {
        esc.hp -= p.damage;
        p.active = false;
        createParticles(g, p.x, p.y, 0x22d3ee, 5);
        g.effects.push({ type: 'dmg', x: esc.x, y: esc.y - 10, text: Math.ceil(p.damage).toString(), life: 0.8 });
        if (esc.hp <= 0) {
          createParticles(g, esc.x, esc.y, 0x22d3ee, 15);
          esc.lives--;
          g.effects.push({
            type: 'mission_complete',
            x: window.innerWidth / 2,
            y: Math.max(100, window.innerHeight / 4),
            text: esc.lives > 0 ? `DRONE DESTROYED! ${esc.lives} LIVES LEFT` : 'DRONE DESTROYED!',
            life: 2.5,
          });
          if (esc.lives <= 0) {
            esc.active = false;
            g.player.hp = 0;
            setGameState('gameover');
            return true;
          }
        }
      }
    }
  }

  // ── Enemies ramming escort drone ──
  if (esc.hp > 0 && esc.respawnTimer <= 0) {
    for (let e of g.enemies) {
      if (!e.active) continue;
      if (Math.hypot(e.x - esc.x, e.y - esc.y) < e.radius + esc.radius) {
        esc.hp -= 15;
        createParticles(g, esc.x, esc.y, 0x22d3ee, 10);
        g.effects.push({ type: 'dmg', x: esc.x, y: esc.y - 10, text: '15', life: 0.8 });
        if (esc.hp <= 0) {
          createParticles(g, esc.x, esc.y, 0x22d3ee, 15);
          esc.lives--;
          g.effects.push({
            type: 'mission_complete',
            x: window.innerWidth / 2,
            y: Math.max(100, window.innerHeight / 4),
            text: esc.lives > 0 ? `DRONE DESTROYED! ${esc.lives} LIVES LEFT` : 'DRONE DESTROYED!',
            life: 2.5,
          });
          if (esc.lives <= 0) {
            esc.active = false;
            g.player.hp = 0;
            setGameState('gameover');
            return true;
          }
        }
      }
    }
  }

  // ── Enemies also target the escort drone (in addition to player) ──
  for (let e of g.enemies) {
    if (!e.active) continue;
    const distToEscort = Math.hypot(esc.x - e.x, esc.y - e.y);
    const distToPlayer = Math.hypot(g.player.x - e.x, g.player.y - e.y);
    if (distToEscort < distToPlayer && distToEscort < 500) {
      const angle = Math.atan2(esc.y - e.y, esc.x - e.x);
      if (e.fireCooldown !== undefined && e.fireCooldown <= 0) {
        if (e.type === 'shooter' && distToEscort < 600) {
          fireProjectile(g, e.x, e.y, angle, 250, 15 * currentDiffMult, 'enemy_bullet');
          e.fireCooldown = 1.8 + Math.random();
        } else if (e.type === 'missile_boat' && distToEscort < 800) {
          fireProjectile(g, e.x, e.y, angle - 0.5, 120, 25 * currentDiffMult, 'enemy_missile');
          fireProjectile(g, e.x, e.y, angle + 0.5, 120, 25 * currentDiffMult, 'enemy_missile');
          e.fireCooldown = 4.0;
        }
      }
    }
  }

  return false;
};
