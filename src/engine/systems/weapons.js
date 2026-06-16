/**
 * systems/weapons.js — Player weapon firing logic (autocannon, plasma, missiles, pointDefense).
 */
import { fireProjectile, killEnemy, applyDamageWithShield, spawnDamageNumber, triggerShieldRestoration } from '../combat';
import { GAME_CONFIG } from '../../constants/gameConfig';
import { SoundManager } from '../audio';
import { getNearestHostileTarget } from '../targeting';
import { getActiveSynergies, applyPlasmaSynergy, applyAutocannonSynergy, applyPointDefenseSynergy } from '../weaponSynergies';
import { areWeaponsDisabled } from './weather';
import { getDamageMult, getFireRateMult, getPlasmaDamageMult, getCritChance, getMissileSplitCount, getSelfDamageChance } from '../relicSystem';
import { spawnEffect } from '../pool';

function rollUnstableReactorSelfDamage(g, chance) {
  if (chance > 0 && Math.random() < chance) {
    g.player.hp -= 1;
  }
}

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {function} completeMission — Mission completion callback
 */
export const updateWeapons = (dt, g, completeMission) => {
  // ── EMI disable check: skip all weapon firing if weapons are disabled ──
  if (areWeaponsDisabled(g)) return;

  const C = GAME_CONFIG;
  const hasTarget = g.levels.autoAim > 0
    ? (getNearestHostileTarget(g.player.x, g.player.y, g) !== null)
    : true;

  // ── Active buff multipliers ──
  const fireMult = g.activeBuffs.rapidFire ? 0.5 : 1;
  const dmgMult  = g.activeBuffs.damageSurge ? 2 : 1;

  // ── Compute active synergies ──
  const activeSynergies = getActiveSynergies(g.levels);

  // ── Relic multipliers ──
  const relicDmgMult = getDamageMult(g);
  const relicFireMult = getFireRateMult(g);
  const relicPlasmaMult = getPlasmaDamageMult(g);
  const relicCritChance = getCritChance(g);
  const relicMissileSplit = getMissileSplitCount(g);
  const relicSelfDmgChance = getSelfDamageChance(g);

  // ── Autocannon ──
  if (g.levels.autocannon > 0 && g.cooldowns.autocannon <= 0 && hasTarget) {
    SoundManager.play('shoot');
    const angle = g.player.aimAngle;
    const dmg = (C.weapons.autocannon.baseDamage + g.levels.autocannon * C.weapons.autocannon.damagePerLevel) * dmgMult * relicDmgMult;
    const shots = 1 + Math.floor(g.levels.autocannon / C.weapons.autocannon.shotsPerExtraLevels);
    const perpX = -Math.sin(angle);
    const perpY =  Math.cos(angle);
    for (let i = 0; i < shots; i++) {
      const lateralOff = (i - (shots - 1) / 2) * 18;
      const bx = g.player.x + Math.cos(angle) * 50 + perpX * lateralOff;
      const by = g.player.y + Math.sin(angle) * 50 + perpY * lateralOff;
      const pConfig = {};
      applyAutocannonSynergy(pConfig, activeSynergies);
      const isCrit = relicCritChance > 0 && Math.random() < relicCritChance;
      const shotDmg = isCrit ? dmg * C.critMultiplier : dmg;
      fireProjectile(g, bx, by, angle, C.weapons.autocannon.speed + (Math.random() * C.weapons.autocannon.speedVariance), shotDmg, 'autocannon', 0, { ...pConfig, isCrit });
    }
    g.cooldowns.autocannon = Math.max(C.weapons.autocannon.minCooldown, (C.weapons.autocannon.baseCooldown - g.levels.autocannon * C.weapons.autocannon.cooldownReduction) * fireMult * relicFireMult);
    rollUnstableReactorSelfDamage(g, relicSelfDmgChance);
  }

  // ── Plasma Piercer ──
  if (g.levels.plasma > 0 && g.cooldowns.plasma <= 0 && hasTarget) {
    SoundManager.play('shoot_plasma');
    const angle = g.player.aimAngle;
    const shots = 1 + Math.floor(g.levels.plasma / C.weapons.plasma.shotsPerExtraLevels);
    const perpX = -Math.sin(angle);
    const perpY =  Math.cos(angle);
    const baseDmg = (C.weapons.plasma.baseDamage + g.levels.plasma * C.weapons.plasma.damagePerLevel) * dmgMult * relicDmgMult * relicPlasmaMult;
    for (let i = 0; i < shots; i++) {
      const lateralOff = (i - (shots - 1) / 2) * 22;
      const bx = g.player.x + Math.cos(angle) * 50 + perpX * lateralOff;
      const by = g.player.y + Math.sin(angle) * 50 + perpY * lateralOff;
      const pConfig = {};
      applyPlasmaSynergy(pConfig, activeSynergies);
      const isCrit = relicCritChance > 0 && Math.random() < relicCritChance;
      const shotDmg = isCrit ? baseDmg * C.critMultiplier : baseDmg;
      fireProjectile(g, bx, by, angle, C.weapons.plasma.baseSpeed, shotDmg, 'plasma', 1 + Math.floor(g.levels.plasma / 2), { ...pConfig, isCrit });
    }
    g.cooldowns.plasma = Math.max(C.weapons.plasma.minCooldown, (C.weapons.plasma.baseCooldown - g.levels.plasma * C.weapons.plasma.cooldownReduction) * fireMult * relicFireMult);
    rollUnstableReactorSelfDamage(g, relicSelfDmgChance);
  }

  // ── Missiles (360-degree ring) ──
  if (g.levels.missiles > 0 && g.cooldowns.missiles <= 0) {
    SoundManager.play('shoot_missile');
    const count = g.levels.missiles * relicMissileSplit;
    const baseDmg = (C.weapons.missiles.baseDamage + g.levels.missiles * C.weapons.missiles.damagePerLevel) * dmgMult * relicDmgMult;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const isCrit = relicCritChance > 0 && Math.random() < relicCritChance;
      const shotDmg = isCrit ? baseDmg * C.critMultiplier : baseDmg;
      fireProjectile(g, g.player.x, g.player.y, angle, C.weapons.missiles.baseSpeed, shotDmg, 'missile', 0, { isCrit });
    }
    g.cooldowns.missiles = Math.max(C.weapons.missiles.minCooldown, (C.weapons.missiles.baseCooldown - g.levels.missiles * C.weapons.missiles.cooldownReduction) * fireMult * relicFireMult);
    rollUnstableReactorSelfDamage(g, relicSelfDmgChance);
  }

  // ── Point Defense (auto-targets nearby enemy missiles, then enemies) ──
  if (g.levels.pointDefense > 0 && g.cooldowns.pointDefense <= 0) {
    const range = C.weapons.pointDefense.baseRange + g.levels.pointDefense * C.weapons.pointDefense.rangePerLevel;
    const dmg = (C.weapons.pointDefense.baseDamage + g.levels.pointDefense * C.weapons.pointDefense.damagePerLevel) * dmgMult * relicDmgMult;
    const baseMaxHits = 1 + Math.floor(g.levels.pointDefense / C.weapons.pointDefense.maxHitsPer2Levels);
    const maxHits = applyPointDefenseSynergy(baseMaxHits, activeSynergies);
    let hits = 0;
    let hit = false;

    for (let m of g.projectiles) {
      if (!m.active || !m.isEnemy || m.type !== 'enemy_missile') continue;
      if (Math.hypot(m.x - g.player.x, m.y - g.player.y) < range) {
        m.active = false; hit = true;
        spawnEffect(g, { type: 'laser', source: g.player, target: m, life: 0.1 });
        spawnDamageNumber(g, m.x, m.y, dmg, { hitType: 'hull', isCrit: true, life: 0.5 });
        hits++;
        if (hits >= maxHits) break;
      }
    }

    if (hits < maxHits) {
      for (let e of g.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < range) {
          const { actualDmg: ad, shieldAbsorbed } = applyDamageWithShield(g, e, dmg, e.x, e.y);
          hit = true;
          spawnEffect(g, { type: 'laser', source: g.player, target: e, life: 0.1 });
          spawnDamageNumber(g, e.x, e.y, ad, { shieldDamage: shieldAbsorbed, isCrit: true });
          hits++;
          if (e.hp <= 0) {
            killEnemy(g, e, completeMission);
            SoundManager.play('explosion');
          }
          if (hits >= maxHits) break;
        }
      }
    }
    if (hit) g.cooldowns.pointDefense = Math.max(C.weapons.pointDefense.minCooldown, (C.weapons.pointDefense.baseCooldown - g.levels.pointDefense * C.weapons.pointDefense.cooldownReduction) * fireMult * relicFireMult);
  }

  g.cooldowns.shieldRegen -= dt;
  if (g.cooldowns.shieldRegen <= 0 && g.player.shield < g.player.maxShield) {
    const prevShield = g.player.shield;
    g.player.shield = Math.min(g.player.maxShield, g.player.shield + C.shield.regenAmount);
    g.cooldowns.shieldRegen = C.shield.regenCooldown;

    // Track depleted state: mark when shield drops to 0
    if (prevShield <= 0) {
      g.player._shieldWasDepleted = true;
    }

    // Trigger celebration when shield fully restores from depleted state
    if (g.player._shieldWasDepleted && g.player.shield >= g.player.maxShield) {
      g.player._shieldWasDepleted = false;
      triggerShieldRestoration(g);
    }
  }
};
