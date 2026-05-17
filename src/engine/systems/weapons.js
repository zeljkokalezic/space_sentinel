/**
 * systems/weapons.js — Player weapon firing logic (autocannon, plasma, missiles, pointDefense).
 */
import { fireProjectile, killEnemy } from '../combat';
import { GAME_CONFIG } from '../../constants/gameConfig';
import { SoundManager } from '../audio';
import { getNearestHostileTarget } from '../targeting';

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {function} completeMission — Mission completion callback
 */
export const updateWeapons = (dt, g, completeMission) => {
  const C = GAME_CONFIG;
  const hasTarget = g.levels.autoAim > 0
    ? (getNearestHostileTarget(g.player.x, g.player.y, g) !== null)
    : true;

  // ── Active buff multipliers ──
  const fireMult = g.activeBuffs.rapidFire ? 0.5 : 1;
  const dmgMult  = g.activeBuffs.damageSurge ? 2 : 1;

  // ── Autocannon ──
  if (g.levels.autocannon > 0 && g.cooldowns.autocannon <= 0 && hasTarget) {
    SoundManager.play('shoot');
    const angle = g.player.aimAngle;
    const dmg = (C.weapons.autocannon.baseDamage + g.levels.autocannon * C.weapons.autocannon.damagePerLevel) * dmgMult;
    const shots = 1 + Math.floor(g.levels.autocannon / C.weapons.autocannon.shotsPerExtraLevels);
    const perpX = -Math.sin(angle);
    const perpY =  Math.cos(angle);
    for (let i = 0; i < shots; i++) {
      const lateralOff = (i - (shots - 1) / 2) * 18;
      const bx = g.player.x + Math.cos(angle) * 50 + perpX * lateralOff;
      const by = g.player.y + Math.sin(angle) * 50 + perpY * lateralOff;
      fireProjectile(g, bx, by, angle, C.weapons.autocannon.speed + (Math.random() * C.weapons.autocannon.speedVariance), dmg, 'autocannon', 0);
    }
    g.cooldowns.autocannon = Math.max(C.weapons.autocannon.minCooldown, (C.weapons.autocannon.baseCooldown - g.levels.autocannon * C.weapons.autocannon.cooldownReduction) * fireMult);
  }

  // ── Plasma Piercer ──
  if (g.levels.plasma > 0 && g.cooldowns.plasma <= 0 && hasTarget) {
    SoundManager.play('shoot_plasma');
    const angle = g.player.aimAngle;
    const shots = 1 + Math.floor(g.levels.plasma / C.weapons.plasma.shotsPerExtraLevels);
    const perpX = -Math.sin(angle);
    const perpY =  Math.cos(angle);
    for (let i = 0; i < shots; i++) {
      const lateralOff = (i - (shots - 1) / 2) * 22;
      const bx = g.player.x + Math.cos(angle) * 50 + perpX * lateralOff;
      const by = g.player.y + Math.sin(angle) * 50 + perpY * lateralOff;
      fireProjectile(g, bx, by, angle, C.weapons.plasma.baseSpeed, (C.weapons.plasma.baseDamage + g.levels.plasma * C.weapons.plasma.damagePerLevel) * dmgMult, 'plasma', 1 + Math.floor(g.levels.plasma / 2));
    }
    g.cooldowns.plasma = Math.max(C.weapons.plasma.minCooldown, (C.weapons.plasma.baseCooldown - g.levels.plasma * C.weapons.plasma.cooldownReduction) * fireMult);
  }

  // ── Missiles (360-degree ring) ──
  if (g.levels.missiles > 0 && g.cooldowns.missiles <= 0) {
    SoundManager.play('shoot_missile');
    const count = g.levels.missiles;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      fireProjectile(g, g.player.x, g.player.y, angle, C.weapons.missiles.baseSpeed, (C.weapons.missiles.baseDamage + g.levels.missiles * C.weapons.missiles.damagePerLevel) * dmgMult, 'missile', 0);
    }
    g.cooldowns.missiles = Math.max(C.weapons.missiles.minCooldown, (C.weapons.missiles.baseCooldown - g.levels.missiles * C.weapons.missiles.cooldownReduction) * fireMult);
  }

  // ── Point Defense (auto-targets nearby enemy missiles, then enemies) ──
  if (g.levels.pointDefense > 0 && g.cooldowns.pointDefense <= 0) {
    const range = C.weapons.pointDefense.baseRange + g.levels.pointDefense * C.weapons.pointDefense.rangePerLevel;
    const dmg = (C.weapons.pointDefense.baseDamage + g.levels.pointDefense * C.weapons.pointDefense.damagePerLevel) * dmgMult;
    const maxHits = 1 + Math.floor(g.levels.pointDefense / C.weapons.pointDefense.maxHitsPer2Levels);
    let hits = 0;
    let hit = false;

    const enemyMissiles = g.projectiles.filter(p => p.active && p.isEnemy && p.type === 'enemy_missile');
    for (let m of enemyMissiles) {
      if (Math.hypot(m.x - g.player.x, m.y - g.player.y) < range) {
        m.active = false; hit = true;
        g.effects.push({ type: 'laser', source: g.player, target: m, life: 0.1 });
        g.effects.push({ type: 'dmg', x: m.x, y: m.y, text: 'CRIT', life: 0.5 });
        hits++;
        if (hits >= maxHits) break;
      }
    }

    if (hits < maxHits) {
      for (let e of g.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < range) {
          let ad = dmg;
          if (e.shield > 0) { const ab = Math.min(e.shield, ad); e.shield -= ab; ad -= ab; }
          e.hp -= ad; hit = true;
          g.effects.push({ type: 'laser', source: g.player, target: e, life: 0.1 });
          g.effects.push({ type: 'dmg', x: e.x, y: e.y, text: Math.ceil(dmg).toString(), life: 0.8 });
          hits++;
          if (e.hp <= 0) {
            killEnemy(g, e, completeMission);
            SoundManager.play('explosion');
          }
          if (hits >= maxHits) break;
        }
      }
    }
    if (hit) g.cooldowns.pointDefense = Math.max(C.weapons.pointDefense.minCooldown, (C.weapons.pointDefense.baseCooldown - g.levels.pointDefense * C.weapons.pointDefense.cooldownReduction) * fireMult);
  }

  g.cooldowns.shieldRegen -= dt;
  if (g.cooldowns.shieldRegen <= 0 && g.player.shield < g.player.maxShield) {
    g.player.shield = Math.min(g.player.maxShield, g.player.shield + C.shield.regenAmount);
    g.cooldowns.shieldRegen = C.shield.regenCooldown;
  }
};
