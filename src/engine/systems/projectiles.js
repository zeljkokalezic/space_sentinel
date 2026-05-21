/**
 * systems/projectiles.js — Projectile movement, homing, collision detection.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, triggerScreenShake } from '../combat';
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
        let dmg = p.damage;
        if (g.player.shield > 0) {
          const absorb = Math.min(g.player.shield, dmg);
          g.player.shield -= absorb; dmg -= absorb;
        }
        g.player.hp -= dmg;
        createParticles(g, p.x, p.y, 0xef4444, 5);
        p.active = false;
        g.effects.push({ type: 'dmg', x: g.player.x, y: g.player.y - 10, text: Math.ceil(dmg).toString(), life: 0.8 });
        triggerScreenShake(g, p.type === 'enemy_missile' ? 'bigExplosion' : 'playerHit');
        if (g.player.hp <= 0) { setGameState('gameover'); return; }
      }
    } else {
      // ── Player projectile hits enemies ──
      for (let e of g.enemies) {
        if (!e.active || p.hitList.includes(e.id)) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
          SoundManager.play('hit');
          let actualDmg = p.damage;
          if (e.shield > 0) { const absorb = Math.min(e.shield, actualDmg); e.shield -= absorb; actualDmg -= absorb; }
          e.hp -= actualDmg;
          g.effects.push({ type: 'dmg', x: e.x + (Math.random() - 0.5) * 10, y: e.y + (Math.random() - 0.5) * 10, text: Math.ceil(actualDmg).toString(), life: 0.8 });
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
          if (g.miniboss.shield > 0) { const absorb = Math.min(g.miniboss.shield, actualDmg); g.miniboss.shield -= absorb; actualDmg -= absorb; }
          g.miniboss.hp -= actualDmg;
          g.effects.push({ type: 'dmg', x: g.miniboss.x + (Math.random() - 0.5) * 15, y: g.miniboss.y + (Math.random() - 0.5) * 15, text: Math.ceil(actualDmg).toString(), life: 0.8 });
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
          if (g.boss.shield > 0) { const absorb = Math.min(g.boss.shield, actualDmg); g.boss.shield -= absorb; actualDmg -= absorb; }
          g.boss.hp -= actualDmg;
          g.effects.push({ type: 'dmg', x: g.boss.x + (Math.random() - 0.5) * 15, y: g.boss.y + (Math.random() - 0.5) * 15, text: Math.ceil(actualDmg).toString(), life: 0.8 });
          createParticles(g, p.x, p.y, p.type === 'plasma' ? 0x22d3ee : 0xfde047, 5);
          if (p.pierce > 0) { p.pierce--; p.hitList.push('boss'); }
          else               p.active = false;
        }
      }
    }
  }
};
