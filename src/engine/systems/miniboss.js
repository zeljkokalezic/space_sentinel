/**
 * systems/miniboss.js — Mini-boss AI, attacks, phase transitions, and collision.
 * Mirrors systems/boss.js but operates on g.miniboss with scaled stats.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, fireProjectile } from '../combat';
import { SoundManager } from '../audio';

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {function} completeMission — Mission completion callback
 * @param {function} setGameState — React state setter
 * @returns {boolean} — True if game should stop (mini-boss dead or player dead)
 */
export const updateMiniboss = (dt, g, currentDiffMult, completeMission, setGameState) => {
  if (!g.miniboss || !g.miniboss.active) return false;

  const C = GAME_CONFIG;
  const boss = g.miniboss;
  const player = g.player;

  // ── Movement toward player (orbit + approach pattern) ──
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  const speedMult = C.boss.phaseSpeedMult[boss.phase - 1] || 1;
  const moveSpeed = boss.speed * speedMult;

  if (boss.isCharging) {
    // Charge toward target
    const cdx = boss.chargeTarget.x - boss.x;
    const cdy = boss.chargeTarget.y - boss.y;
    const cDist = Math.hypot(cdx, cdy);
    if (cDist > 10) {
      boss.x += (cdx / cDist) * C.boss.chargeSpeed * dt;
      boss.y += (cdy / cDist) * C.boss.chargeSpeed * dt;
    } else {
      boss.isCharging = false;
      boss.chargeTimer = C.boss.chargeCooldown / speedMult;
    }
  } else if (dist > 400) {
    // Approach player
    boss.x += Math.cos(angle) * moveSpeed * dt;
    boss.y += Math.sin(angle) * moveSpeed * dt;
  } else if (dist < 300) {
    // Back away if too close
    boss.x -= Math.cos(angle) * moveSpeed * 0.5 * dt;
    boss.y -= Math.sin(angle) * moveSpeed * 0.5 * dt;
  } else {
    // Orbit at medium distance
    const orbitAngle = angle + Math.PI / 2;
    boss.x += Math.cos(orbitAngle) * moveSpeed * 0.3 * dt;
    boss.y += Math.sin(orbitAngle) * moveSpeed * 0.3 * dt;
  }

  // ── Phase transitions ──
  const hpRatio = boss.hp / boss.maxHp;
  let newPhase = 1;
  if (hpRatio <= 0.33) newPhase = 3;
  else if (hpRatio <= 0.66) newPhase = 2;

  if (newPhase !== boss.phase) {
    boss.phase = newPhase;
    SoundManager.play('boss_phase_change');
    createParticles(g, boss.x, boss.y, 0xfbbf24, 20);
    g.effects.push({
      type: 'mission_complete',
      text: `PHASE ${boss.phase}!`,
      life: 1.5,
    });
  }

  // ── Attacks (scaled damage) ──
  boss.attackTimer -= dt;
  boss.chargeTimer -= dt;

  const fireMult = C.boss.phaseFireMult[boss.phase - 1] || 1;
  const effectiveCooldown = C.boss.fireCooldown / fireMult;
  const scaledDamage = C.boss.projectileDamage * C.miniboss.damagePercent;

  if (boss.attackTimer <= 0) {
    boss.attackTimer = effectiveCooldown;

    if (boss.phase === 1) {
      // Phase 1: Single aimed shot
      fireProjectile(g, boss.x, boss.y, angle, C.boss.projectileSpeed,
        scaledDamage * currentDiffMult, 'enemy_bullet', 0);
      SoundManager.play('enemy_shoot');
    } else if (boss.phase >= 2) {
      // Phase 2+: Spread shot (3-5 projectiles)
      const spreadCount = boss.phase === 2 ? 3 : 5;
      const spreadAngle = 0.3;
      for (let i = 0; i < spreadCount; i++) {
        const a = angle - spreadAngle + (i / (spreadCount - 1)) * spreadAngle * 2;
        fireProjectile(g, boss.x, boss.y, a, C.boss.projectileSpeed,
          scaledDamage * currentDiffMult, 'enemy_bullet', 0);
      }
      SoundManager.play('enemy_shoot');
    }

    if (boss.phase >= 3) {
      // Phase 3: Additional spiral shots
      for (let i = 0; i < 3; i++) {
        const spiralA = boss.spiralAngle + (i * Math.PI * 2 / 3);
        fireProjectile(g, boss.x, boss.y, spiralA, C.boss.projectileSpeed * 0.8,
          scaledDamage * 0.5 * currentDiffMult, 'enemy_bullet', 0);
      }
      boss.spiralAngle += 0.5;
    }
  }

  // ── Charge attacks (phase 2+) ──
  if (boss.phase >= 2 && boss.chargeTimer <= 0 && !boss.isCharging) {
    boss.isCharging = true;
    boss.chargeTarget = { x: player.x, y: player.y };
    // Telegraph: flash effect
    createParticles(g, boss.x, boss.y, 0xfbbf24, 10);
  }

  // ── Mini-boss rams player ──
  const scaledRamDamage = C.boss.ramDamage * C.miniboss.damagePercent;
  if (dist < boss.radius + player.radius) {
    const dmg = scaledRamDamage * currentDiffMult;
    let hpDamage = dmg;
    if (player.shield > 0) {
      const absorb = Math.min(player.shield, dmg);
      player.shield -= absorb;
      hpDamage = dmg - absorb;
    }
    player.hp -= hpDamage;
    if (player.hp <= 0) {
      setGameState('gameover');
      return true;
    }
    // Push mini-boss back
    boss.x -= Math.cos(angle) * 100;
    boss.y -= Math.sin(angle) * 100;
    createParticles(g, player.x, player.y, '#ef4444', 15);
    SoundManager.play('player_hit');
  }

  // ── Mini-boss dies ──
  if (boss.hp <= 0) {
    boss.active = false;
    createParticles(g, boss.x, boss.y, 0xf97316, 40);
    createParticles(g, boss.x, boss.y, 0xfbbf24, 30);
    SoundManager.play('explosion');

    // Scrap reward (base + level scaling)
    const scrapAmount = C.miniboss.scrapReward + Math.floor(g.level * 20);
    g.pickups.push({
      id: Math.random(),
      x: boss.x,
      y: boss.y,
      value: scrapAmount,
      active: true,
      radius: 8,
    });

    // Update stats
    if (g.stats) g.stats.minibossesDefeated++;

    // Complete mission
    completeMission();
    return true;
  }

  return false;
};
