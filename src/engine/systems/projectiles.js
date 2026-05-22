/**
 * systems/projectiles.js — Projectile movement, homing, collision detection.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, triggerScreenShake, triggerPlayerIFrames, checkShieldBreak, spawnDamageNumber } from '../combat';
import { SoundManager } from '../audio';

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

    p.x += p.vx * dt;
    p.y += p.vy * dt;

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
        let dmg = p.damage;
        let shieldAbsorbed = 0;
        if (g.player.shield > 0) {
          shieldAbsorbed = Math.min(g.player.shield, dmg);
          g.player.shield -= shieldAbsorbed; dmg -= shieldAbsorbed;
        }
        g.player.hp -= dmg;
        createParticles(g, p.x, p.y, 0xef4444, 5);
        p.active = false;
        spawnDamageNumber(g, g.player.x, g.player.y - 10, dmg, { hitType: 'playerHit', shieldDamage: shieldAbsorbed });
        triggerScreenShake(g, p.type === 'enemy_missile' ? 'bigExplosion' : 'playerHit');
        triggerPlayerIFrames(g);
        if (g.player.hp <= 0) { setGameState('gameover'); return; }
      }
    } else {
      // ── Player projectile hits enemies ──
      for (let e of g.enemies) {
        if (!e.active || p.hitList.includes(e.id)) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
          SoundManager.play('hit');
          let actualDmg = p.damage;
          let shieldAbsorbed = 0;
          const shieldWasFull = e.shield > 0 && e.maxShield > 0;
          if (e.shield > 0) { shieldAbsorbed = Math.min(e.shield, actualDmg); e.shield -= shieldAbsorbed; actualDmg -= shieldAbsorbed; }
          e.hp -= actualDmg;
          if (shieldWasFull && e.shield <= 0) {
            checkShieldBreak(g, e, e.x, e.y);
          }
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
          let actualDmg = p.damage;
          let shieldAbsorbed = 0;
          const mbShieldWasFull = g.miniboss.shield > 0 && g.miniboss.maxShield > 0;
          if (g.miniboss.shield > 0) { shieldAbsorbed = Math.min(g.miniboss.shield, actualDmg); g.miniboss.shield -= shieldAbsorbed; actualDmg -= shieldAbsorbed; }
          g.miniboss.hp -= actualDmg;
          if (mbShieldWasFull && g.miniboss.shield <= 0) {
            checkShieldBreak(g, g.miniboss, g.miniboss.x, g.miniboss.y);
          }
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
          let actualDmg = p.damage;
          let shieldAbsorbed = 0;
          const bossShieldWasFull = g.boss.shield > 0 && g.boss.maxShield > 0;
          if (g.boss.shield > 0) { shieldAbsorbed = Math.min(g.boss.shield, actualDmg); g.boss.shield -= shieldAbsorbed; actualDmg -= shieldAbsorbed; }
          g.boss.hp -= actualDmg;
          if (bossShieldWasFull && g.boss.shield <= 0) {
            checkShieldBreak(g, g.boss, g.boss.x, g.boss.y);
          }
          spawnDamageNumber(g, g.boss.x, g.boss.y, actualDmg, { shieldDamage: shieldAbsorbed });
          createParticles(g, p.x, p.y, p.type === 'plasma' ? 0x22d3ee : 0xfde047, 5);
          if (p.pierce > 0) { p.pierce--; p.hitList.push('boss'); }
          else               p.active = false;
        }
      }
    }
  }
};
