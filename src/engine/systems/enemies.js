/**
 * systems/enemies.js — Enemy AI movement, firing, collision.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles } from '../combat';
import { tryFireEnemyWeapon } from './enemyFire';
import { SoundManager } from '../audio';

/**

 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {function} completeMission — Mission completion callback
 * @param {function} setGameState — React state setter callback
 */
export const updateEnemies = (dt, g, currentDiffMult, completeMission, setGameState) => {
  const C = GAME_CONFIG;
  for (let e of g.enemies) {
    if (!e.active) continue;

    const distToPlayer = Math.hypot(g.player.x - e.x, g.player.y - e.y);
    const angle = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    let moveAngle = angle;
    if (e.type === 'interceptor') moveAngle += Math.sin(g.totalTime * 4 + e.id) * 0.8;

    let moveSpeed = e.speed;
    if (e.type === 'shooter') {
      if      (distToPlayer < C.player.radius * 8) moveSpeed = e.speed * -0.5;
      else if (distToPlayer < C.player.radius * 10) moveSpeed = 0;
    } else if (e.type === 'missile_boat') {
      if      (distToPlayer < C.player.radius * 13) moveSpeed = e.speed * -1;
      else if (distToPlayer < C.player.radius * 18) moveSpeed = 0;
    }

    e.x += Math.cos(moveAngle) * moveSpeed * dt;
    e.y += Math.sin(moveAngle) * moveSpeed * dt;

    // ── Enemy firing ──
    tryFireEnemyWeapon(e, angle, distToPlayer, dt, currentDiffMult, g);

    // ── Enemy rams player ──
    if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < e.radius + g.player.radius) {
      const baseDmg = e.type === 'heavy' ? 20 : C.weapons.autocannon.baseDamage;
      let dmg = baseDmg * currentDiffMult;
      let shieldAbsorbed = false;
      if (g.player.shield > 0) {
        const absorb = Math.min(g.player.shield, dmg);
        g.player.shield -= absorb; dmg -= absorb;
        if (absorb > 0) shieldAbsorbed = true;
      }
      if (shieldAbsorbed) SoundManager.play('shield_hit');
      else SoundManager.play('player_hit');
      g.player.hp -= dmg;
      let eDamage = C.weapons.missiles.baseDamage;
      if (e.shield > 0) { const absorb = Math.min(e.shield, eDamage); e.shield -= absorb; eDamage -= absorb; }
      e.hp -= eDamage;
      g.effects.push({ type: 'dmg', x: e.x, y: e.y - 10, text: String(baseDmg * currentDiffMult), life: 0.8 });
      e.x += Math.cos(angle + Math.PI) * 30;
      e.y += Math.sin(angle + Math.PI) * 30;
      createParticles(g, e.x, e.y, 0xef4444, 10);
      if (g.player.hp <= 0) { setGameState('gameover'); return; }
    }

    // ── Enemy dies ──
    if (e.hp <= 0) {
      e.active = false;
      if (g.stats) g.stats.enemiesDestroyed++;
      if (g.mission.type === 'kill') {
        g.mission.current++;
        if (g.mission.current >= g.mission.target) completeMission();
      } else if (g.mission.type === 'kill_elite' && (e.type === 'missile_boat' || e.type === 'shielded' || e.type === 'heavy')) {
        g.mission.current++;
        if (g.mission.current >= g.mission.target) completeMission();
      }
      createParticles(g, e.x, e.y, e.color, 15);
      const val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
      g.pickups.push({ x: e.x, y: e.y, value: val, active: true, radius: 6 });
    }
  }
};
