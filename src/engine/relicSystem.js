/**
 * relicSystem.js — Pure query layer for relic effects.
 *
 * All functions take `g` (game state) and return values.
 * No side effects except `tryAddRelic`.
 */

import { RELIC_DATA } from '../constants/relics';
import { SoundManager } from './audio';
import { spawnEffect } from './pool';
import { getViewportSize } from './combat';

/** Get relic definition by ID */
export function getRelicById(relicId) {
  return RELIC_DATA.find(r => r.id === relicId) || null;
}

/** Get all active relic definitions for a game state */
export function getActiveRelics(g) {
  if (!g || !g.relics) return [];
  return g.relics.map(id => getRelicById(id)).filter(Boolean);
}

/** Check if game state has a specific relic */
export function hasRelic(g, relicId) {
  if (!g || !g.relics) return false;
  return g.relics.includes(relicId);
}

/** Calculate damage multiplier from relics */
export function getDamageMult(g) {
  if (!g || !g.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'damage_mult') mult *= relic.effect.value;
  }
  return mult;
}

/** Calculate fire rate multiplier from relics (lower = faster) */
export function getFireRateMult(g) {
  if (!g || !g.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'fire_rate_mult') mult *= relic.effect.value;
  }
  return mult;
}

/** Calculate scrap multiplier from relics */
export function getScrapMult(g) {
  if (!g || !g.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'scrap_mult') mult *= relic.effect.value;
  }
  return mult;
}

/** Calculate extra scrap per kill from Salvager */
export function getExtraScrapPerKill(g) {
  if (!g || !g.relics) return 0;
  let extra = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'extra_scrap_per_kill') extra += relic.effect.value;
  }
  return extra;
}

/** Calculate dodge chance from relics */
export function getDodgeChance(g) {
  if (!g || !g.relics) return 0;
  let chance = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'dodge_chance') chance += relic.effect.value;
  }
  return Math.min(chance, 0.5); // Cap at 50%
}

/** Calculate reflect chance from relics */
export function getReflectChance(g) {
  if (!g || !g.relics) return 0;
  let chance = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'reflect_chance') chance += relic.effect.value;
  }
  return Math.min(chance, 0.5); // Cap at 50%
}

/** Calculate max HP bonus from relics */
export function getMaxHpBonus(g) {
  if (!g || !g.relics) return 0;
  let bonus = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'max_hp_bonus') bonus += relic.effect.value;
  }
  return bonus;
}

/** Calculate max HP penalty multiplier from relics (e.g., berserker_chip) */
export function getMaxHpPenaltyMult(g) {
  if (!g || !g.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.secondaryEffect && relic.secondaryEffect.type === 'max_hp_penalty') mult *= relic.secondaryEffect.value;
  }
  return mult;
}

/** Calculate low HP damage reduction from relics */
export function getLowHpDamageReduction(g) {
  if (!g || !g.relics) return 0;
  let reduction = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'low_hp_damage_reduction') reduction += relic.effect.value;
  }
  return Math.min(reduction, 0.8); // Cap at 80%
}

/** Calculate plasma damage multiplier from relics */
export function getPlasmaDamageMult(g) {
  if (!g || !g.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'plasma_damage_mult') mult *= relic.effect.value;
  }
  return mult;
}

/** Calculate crit chance from relics */
export function getCritChance(g) {
  if (!g || !g.relics) return 0;
  let chance = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'crit_chance') chance += relic.effect.value;
  }
  return Math.min(chance, 0.5); // Cap at 50%
}

/** Calculate HP ratio damage bonus (Predator: +10% dmg per 10% enemy HP missing) */
export function getHpRatioDamageBonus(g, targetHpRatio) {
  if (!g || !g.relics || targetHpRatio == null) return 0;
  let bonus = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'hp_ratio_damage') {
      // targetHpRatio is 0-1 (1 = full HP). Missing = 1 - ratio.
      const hpMissing = 1 - targetHpRatio;
      bonus += relic.effect.value * hpMissing * 10; // 10% per 10% missing
    }
  }
  return Math.min(bonus, 1.0); // Cap at +100%
}

/** Get missile split count from relics */
export function getMissileSplitCount(g) {
  if (!g || !g.relics) return 1;
  let count = 1;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'missile_split') count = relic.effect.value;
  }
  return count;
}

/** Get HP regen between missions percentage */
export function getHpRegenBetweenMissions(g) {
  if (!g || !g.relics) return 0;
  let regen = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'hp_regen_between_missions') regen += relic.effect.value;
  }
  return Math.min(regen, 0.5); // Cap at 50%
}

/** Get self-damage chance per shot (Unstable Reactor) */
export function getSelfDamageChance(g) {
  if (!g || !g.relics) return 0;
  let chance = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.secondaryEffect && relic.secondaryEffect.type === 'self_damage') chance += relic.secondaryEffect.value;
  }
  return chance;
}

/** Apply per-frame relic effects (self-damage, etc.) */
// eslint-disable-next-line no-unused-vars
export function applyPerFrameEffects(dt, g) {
  // Currently no continuous per-frame effects — placeholder for future relics
}

/** Attempt to add a relic (respects slot limit, no duplicates) */
export function tryAddRelic(g, relicId) {
  if (!g) return false;
  if (!g.relics) g.relics = [];
  if (g.relics.includes(relicId)) return false; // Duplicate
  if (g.relics.length >= (g.relicSlotLimit || 5)) return false; // Full
  g.relics.push(relicId);
  triggerRelicAcquired(g, relicId);
  return true;
}

/** Trigger when a relic is acquired — plays sound + creates visual notification */
export function triggerRelicAcquired(g, relicId) {
  const relic = getRelicById(relicId);
  if (!relic) return;

  // Play sound
  SoundManager.play('relic_acquired');

  // Create visual notification effect
  const { vw: w, vh: h } = getViewportSize();
  spawnEffect(g, {
    type: 'relic_acquired',
    x: w / 2,
    y: Math.max(150, h / 4),
    text: `RELIC ACQUIRED: ${relic.name}`,
    icon: relic.icon,
    life: 3,
    maxLife: 3,
    color: relic.color || '#fbbf24',
  });
}

/** Get a random relic by rarity */
export function getRandomRelic(rarity) {
  const pool = RELIC_DATA.filter(r => r.rarity === rarity);
  if (pool.length === 0) return RELIC_DATA[Math.floor(Math.random() * RELIC_DATA.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Get 3 random relics for starting choice */
export function getStartingRelicOptions() {
  const pool = [...RELIC_DATA];
  const options = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    options.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return options;
}

/** Check if navigation computer relic is active */
export function hasNavigationComputer(g) {
  return hasRelic(g, 'navigation_computer');
}

/** Get active synergy definitions */
export function getActiveSynergies(g) {
  const synergies = [];
  if (hasRelic(g, 'plasma_conduit') && hasRelic(g, 'cluster_rounds')) {
    synergies.push({ name: 'Plasma Storm', description: 'Plasma missiles deal +50% damage' });
  }
  if (hasRelic(g, 'scrap_magnet') && hasRelic(g, 'salvager')) {
    synergies.push({ name: 'Scrap Tycoon', description: '+50% total scrap instead of +25%' });
  }
  if (hasRelic(g, 'berserker_chip') && hasRelic(g, 'heat_sink')) {
    synergies.push({ name: 'Glass Cannon', description: 'Heat Sink activates at 50% HP instead of 30%' });
  }
  if (hasRelic(g, 'reinforced_hull') && hasRelic(g, 'deflector_plates')) {
    synergies.push({ name: 'Iron Will', description: 'Reflect 20% instead of 10%' });
  }
  if (hasRelic(g, 'overclocked_cores') && hasRelic(g, 'auto_doctor')) {
    synergies.push({ name: 'Speed Demon', description: '+5% HP regen during combat' });
  }
  if (hasRelic(g, 'unstable_reactor') && hasRelic(g, 'predator')) {
    synergies.push({ name: 'Unstoppable', description: 'Self-damage reduced to 2%' });
  }
  return synergies;
}
