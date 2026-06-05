/**
 * systems/projectiles.js — Projectile movement, homing, collision detection.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, triggerScreenShake, triggerPlayerIFrames, applyDamageWithShield, spawnDamageNumber, checkDirectionalShield, isShieldBypassedByArmorPierce } from '../combat';
import { SoundManager } from '../audio';
import { triggerFovHit } from './dynamicFov';
import { onBossDamaged } from './bossSignatureMechanics';
import { isProjectileBlockedByDebris, getProjectileSpeedMult } from './weather';

/**
 * Apply armor-pierce mark to enemy — subsequent hits skip shield absorption.
 * @param {object} e — Enemy entity
 * @param {number} hitsLeft — Number of hits that bypass shield
 */
function applyArmorPierceMark(e, hitsLeft) {
  if (!e._armorPierced) {
    e._armorPierced = { hitsLeft: hitsLeft };
  } else {
    e._armorPierced.hitsLeft = Math.max(e._armorPierced.hitsLeft, hitsLeft);
  }
}

/**
 * Steer a guided projectile toward the nearest active enemy.
 * @param {object} p — Projectile with vx, vy, steerAngle
 * @param {object} g — Game state
 * @param {number} dt — Delta time
 */
function guidedHomingSteer(p, g, dt) {
  let nearest = null;
  let minDist = Infinity;
  for (const e of g.enemies) {
    if (!e.active) continue;
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    if (dist < minDist) { minDist = dist; nearest = e; }
  }
  // Also check boss/miniboss
  if (g.boss && g.boss.active) {
    const dist = Math.hypot(g.boss.x - p.x, g.boss.y - p.y);
    if (dist < minDist) { minDist = dist; nearest = g.boss; }
  }
  if (g.miniboss && g.miniboss.active) {
    const dist = Math.hypot(g.miniboss.x - p.x, g.miniboss.y - p.y);
    if (dist < minDist) { nearest = g.miniboss; }
  }
  if (!nearest) return;

  const targetAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
  const currentAngle = Math.atan2(p.vy, p.vx);
  let diff = targetAngle - currentAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const maxCorrection = (p.steerAngle || GAME_CONFIG.weaponSynergies.guidedRounds.steerAngle) * dt;
  const correction = Math.max(-maxCorrection, Math.min(maxCorrection, diff));
  const newAngle = currentAngle + correction;
  const speed = Math.hypot(p.vx, p.vy);
  p.vx = Math.cos(newAngle) * speed;
  p.vy = Math.sin(newAngle) * speed;
}

/**

 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {function} setGameState — React state setter callback
 */
export const updateProjectiles = (dt, g, setGameState) => {
  const C = GAME_CONFIG;
  const MAX_PLAYER_MISSILE_SPEED = 500;
  const MAX_ENEMY_MISSILE_SPEED = 350;
  for (let p of g.projectiles) {
    if (!p.active) continue;
    p.life += dt;
    if (p.life > C.projectile.lifetime) { p.active = false; continue; }

    // ── Player missile homing ──
    if (p.type === 'missile' && p.target && p.target.hp > 0) {
      const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      const cAngle = Math.atan2(p.vy, p.vx);
      let diff = angle - cAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const tSpeed = 5 * dt;
      const nAngle = cAngle + Math.max(-tSpeed, Math.min(tSpeed, diff));
      const speed = Math.min(MAX_PLAYER_MISSILE_SPEED, Math.hypot(p.vx, p.vy) + 100 * dt);
      p.vx = Math.cos(nAngle) * speed;
      p.vy = Math.sin(nAngle) * speed;
      if (Math.random() < 0.3) createParticles(g, p.x, p.y, 0xf97316, 1);
    }

    // ── Guided autocannon homing (synergy) ──
    if (p.guided) {
      guidedHomingSteer(p, g, dt);
      if (Math.random() < 0.2) createParticles(g, p.x, p.y, 0x60a5fa, 1);
    }

    // ── Gravity anomaly: apply speed multiplier ──
    const speedMult = getProjectileSpeedMult(p.x, p.y, g);

    p.x += p.vx * dt * speedMult;
    p.y += p.vy * dt * speedMult;

    // ── Debris field: deactivate projectile if blocked ──
    if (isProjectileBlockedByDebris(p.x, p.y, g)) {
      createParticles(g, p.x, p.y, 0x6b7280, 4);
      p.active = false;
      continue;
    }

    if (p.isEnemy) {
      // ── Enemy missile homing ──
      if (p.type === 'enemy_missile' && p.target && g.player.hp > 0 && p.life < C.projectile.lifetime) {
        const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        const cAngle = Math.atan2(p.vy, p.vx);
        let diff = angle - cAngle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const nAngle = cAngle + Math.max(-2 * dt, Math.min(2 * dt, diff));
        const currentSpeed = Math.min(MAX_ENEMY_MISSILE_SPEED, Math.hypot(p.vx, p.vy) + 50 * dt);
        p.vx = Math.cos(nAngle) * currentSpeed;
        p.vy = Math.sin(nAngle) * currentSpeed;
        if (Math.random() < 0.3) createParticles(g, p.x, p.y, 0xd946ef, 1);
      }

      // ── Enemy projectile hits player ──
      if (Math.hypot(p.x - g.player.x, p.y - g.player.y) < g.player.radius + p.radius) {
        // Check invincibility frames — block damage if invincible
        if (g.playerIFrames && g.playerIFrames.isInvincible) {
          createParticles(g, p.x, p.y, 0x60a5fa, 3);
          p.active = false;
          continue;
        }
        const { actualDmg, shieldAbsorbed } = applyDamageWithShield(g, g.player, p.damage, g.player.x, g.player.y);
        createParticles(g, p.x, p.y, 0xef4444, 5);
        p.active = false;
        spawnDamageNumber(g, g.player.x, g.player.y - 10, actualDmg, { hitType: 'playerHit', shieldDamage: shieldAbsorbed });
        triggerScreenShake(g, p.type === 'enemy_missile' ? 'bigExplosion' : 'playerHit');
        triggerPlayerIFrames(g);
        if (g.player.hp <= 0) { setGameState('gameover'); return; }
      }
    } else {
      // ── Player projectile hits enemies ──
      for (let e of g.enemies) {
        if (!e.active || p.hitList.includes(e.id)) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
          // Check directional shields first (tank elite variant)
          if (checkDirectionalShield(e, p.x, p.y, p.damage)) {
            createParticles(g, p.x, p.y, 0x60a5fa, 5);
            SoundManager.play('shield_hit');
            p.active = false;
            break;
          }
          SoundManager.play('hit');

          // Armor-pierce: mark enemy and skip shield absorption
          if (p.armorPierce) {
            applyArmorPierceMark(e, p.shieldBypassHits ?? 3);
          }

          const { actualDmg, shieldAbsorbed } = applyDamageWithShield(g, e, p.damage, e.x, e.y, { skipShield: isShieldBypassedByArmorPierce(e) });
          spawnDamageNumber(g, e.x, e.y, actualDmg, { shieldDamage: shieldAbsorbed });
          createParticles(g, p.x, p.y, p.type === 'plasma' ? 0x22d3ee : 0xfde047, 5);
          triggerScreenShake(g, p.type === 'plasma' || p.type === 'missile' ? 'explosion' : 2);
          if (p.pierce > 0) { p.pierce--; p.hitList.push(e.id); }
          else              { p.active = false; }
          break;
        }
      }

      if (!p.active) continue;

      // ── Player projectile hits mini-boss ──
      if (g.miniboss && g.miniboss.active && !p.hitList.includes('miniboss')) {
        if (Math.hypot(p.x - g.miniboss.x, p.y - g.miniboss.y) < g.miniboss.radius + p.radius) {
          SoundManager.play('hit');

          // Armor-pierce: mark miniboss and skip shield absorption
          if (p.armorPierce) {
            applyArmorPierceMark(g.miniboss, p.shieldBypassHits ?? 3);
          }

          const { actualDmg, shieldAbsorbed } = applyDamageWithShield(g, g.miniboss, p.damage, g.miniboss.x, g.miniboss.y, { skipShield: isShieldBypassedByArmorPierce(g.miniboss) });
          spawnDamageNumber(g, g.miniboss.x, g.miniboss.y, actualDmg, { shieldDamage: shieldAbsorbed });
          createParticles(g, p.x, p.y, p.type === 'plasma' ? 0x22d3ee : 0xfde047, 5);
          if (p.pierce > 0) { p.pierce--; p.hitList.push('miniboss'); }
          else               p.active = false;
        }
      }

      if (!p.active) continue;

      // ── Player projectile hits boss ──
      if (g.boss && g.boss.active && !p.hitList.includes('boss')) {
        if (Math.hypot(p.x - g.boss.x, p.y - g.boss.y) < g.boss.radius + p.radius) {
          SoundManager.play('hit');

          // Armor-pierce: mark boss and skip shield absorption
          if (p.armorPierce) {
            applyArmorPierceMark(g.boss, p.shieldBypassHits ?? 3);
          }

          const { actualDmg, shieldAbsorbed } = applyDamageWithShield(g, g.boss, p.damage, g.boss.x, g.boss.y, { skipShield: isShieldBypassedByArmorPierce(g.boss) });
          onBossDamaged(g.boss);
          spawnDamageNumber(g, g.boss.x, g.boss.y, actualDmg, { shieldDamage: shieldAbsorbed });
          createParticles(g, p.x, p.y, p.type === 'plasma' ? 0x22d3ee : 0xfde047, 5);
          triggerFovHit(g);
          if (p.pierce > 0) { p.pierce--; p.hitList.push('boss'); }
          else               p.active = false;
        }
      }
    }
  }
};
