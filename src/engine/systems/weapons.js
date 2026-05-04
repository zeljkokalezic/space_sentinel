/**
 * systems/weapons.js — Player weapon firing logic (autocannon, plasma, missiles, pointDefense).
 */
import { fireProjectile, getNearestEnemy } from '../combat';

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updateWeapons = (dt, g) => {
  const hasTarget = g.levels.autoAim > 0
    ? (getNearestEnemy(g.player.x, g.player.y, g.enemies) !== null)
    : true;

  // ── Autocannon ──
  if (g.levels.autocannon > 0 && g.cooldowns.autocannon <= 0 && hasTarget) {
    const angle = g.player.aimAngle;
    const dmg = 10 + g.levels.autocannon * 5;
    const shots = 1 + Math.floor(g.levels.autocannon / 3);
    const perpX = -Math.sin(angle);
    const perpY =  Math.cos(angle);
    for (let i = 0; i < shots; i++) {
      const lateralOff = (i - (shots - 1) / 2) * 18;
      const bx = g.player.x + Math.cos(angle) * 50 + perpX * lateralOff;
      const by = g.player.y + Math.sin(angle) * 50 + perpY * lateralOff;
      fireProjectile(g, bx, by, angle, 700 + (Math.random() * 50), dmg, 'autocannon', false);
    }
    g.cooldowns.autocannon = Math.max(0.08, 0.4 - g.levels.autocannon * 0.025);
  }

  // ── Plasma Piercer ──
  if (g.levels.plasma > 0 && g.cooldowns.plasma <= 0 && hasTarget) {
    const angle = g.player.aimAngle;
    const shots = 1 + Math.floor(g.levels.plasma / 3);
    const perpX = -Math.sin(angle);
    const perpY =  Math.cos(angle);
    for (let i = 0; i < shots; i++) {
      const lateralOff = (i - (shots - 1) / 2) * 22;
      const bx = g.player.x + Math.cos(angle) * 50 + perpX * lateralOff;
      const by = g.player.y + Math.sin(angle) * 50 + perpY * lateralOff;
      fireProjectile(g, bx, by, angle, 350, 30 + g.levels.plasma * 15, 'plasma', 1 + Math.floor(g.levels.plasma / 2));
    }
    g.cooldowns.plasma = Math.max(0.5, 2.0 - g.levels.plasma * 0.1);
  }

  // ── Missiles (360-degree ring) ──
  if (g.levels.missiles > 0 && g.cooldowns.missiles <= 0) {
    const count = g.levels.missiles;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      fireProjectile(g, g.player.x, g.player.y, angle, 250, 20 + g.levels.missiles * 5, 'missile', 0);
    }
    g.cooldowns.missiles = Math.max(1.0, 3.0 - g.levels.missiles * 0.15);
  }

  // ── Point Defense (auto-targets nearby enemy missiles, then enemies) ──
  if (g.levels.pointDefense > 0 && g.cooldowns.pointDefense <= 0) {
    const range = 250 + g.levels.pointDefense * 10;
    const dmg = 50 + g.levels.pointDefense * 20;
    const maxHits = 1 + Math.floor(g.levels.pointDefense / 2);
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
          if (hits >= maxHits) break;
        }
      }
    }
    if (hit) g.cooldowns.pointDefense = Math.max(0.2, 0.5 - g.levels.pointDefense * 0.03);
  }

  // ── Shield regen ──
  if (g.levels.shield > 0 && g.cooldowns.shieldRegen <= 0 && g.player.shield < g.player.maxShield) {
    g.player.shield = Math.min(g.player.maxShield, g.player.shield + 2);
    g.cooldowns.shieldRegen = 0.5;
  }
};
