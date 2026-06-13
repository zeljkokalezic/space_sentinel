/**
 * relicSystem.ts — Pure query layer for relic effects.
 */

import { RELIC_DATA } from '../constants/relics';
import type { RelicEffect, RelicRarity } from '../constants/relics';
import { SoundManager } from './audio';
import { spawnEffect } from './pool';
import { getViewportSize } from './viewport';
import type { GameState } from './state';

export interface RelicDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: RelicRarity;
  category: string;
  effect: RelicEffect;
  secondaryEffect?: RelicEffect;
  cost?: number;
}

/** Get relic definition by ID */
export function getRelicById(relicId: string): RelicDef | null {
  return (RELIC_DATA as RelicDef[]).find(r => r.id === relicId) || null;
}

/** Get all active relic definitions for a game state */
export function getActiveRelics(g: GameState): RelicDef[] {
  if (!g?.relics) return [];
  return g.relics.map(id => getRelicById(id)).filter(Boolean) as RelicDef[];
}

/** Check if game state has a specific relic */
export function hasRelic(g: GameState, relicId: string): boolean {
  if (!g?.relics) return false;
  return g.relics.includes(relicId);
}

/** Calculate damage multiplier from relics */
export function getDamageMult(g: GameState): number {
  if (!g?.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'damage_mult') mult *= relic.effect.value as number;
  }
  return mult;
}

/** Calculate fire rate multiplier from relics (lower = faster) */
export function getFireRateMult(g: GameState): number {
  if (!g?.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'fire_rate_mult') mult *= relic.effect.value as number;
  }
  return mult;
}

/** Calculate scrap multiplier from relics */
export function getScrapMult(g: GameState): number {
  if (!g?.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'scrap_mult') mult *= relic.effect.value as number;
  }
  return mult;
}

/** Calculate extra scrap per kill from Salvager */
export function getExtraScrapPerKill(g: GameState): number {
  if (!g?.relics) return 0;
  let extra = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'extra_scrap_per_kill') extra += relic.effect.value as number;
  }
  return extra;
}

/** Calculate dodge chance from relics */
export function getDodgeChance(g: GameState): number {
  if (!g?.relics) return 0;
  let chance = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'dodge_chance') chance += relic.effect.value as number;
  }
  return Math.min(chance, 0.5);
}

/** Calculate reflect chance from relics */
export function getReflectChance(g: GameState): number {
  if (!g?.relics) return 0;
  let chance = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'reflect_chance') chance += relic.effect.value as number;
  }
  return Math.min(chance, 0.5);
}

/** Calculate max HP bonus from relics */
export function getMaxHpBonus(g: GameState): number {
  if (!g?.relics) return 0;
  let bonus = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'max_hp_bonus') bonus += relic.effect.value as number;
  }
  return bonus;
}

/** Calculate max HP penalty multiplier from relics */
export function getMaxHpPenaltyMult(g: GameState): number {
  if (!g?.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.secondaryEffect?.type === 'max_hp_penalty') mult *= relic.secondaryEffect.value as number;
  }
  return mult;
}

/** Calculate low HP damage reduction from relics */
export function getLowHpDamageReduction(g: GameState): number {
  if (!g?.relics) return 0;
  let reduction = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'low_hp_damage_reduction') reduction += relic.effect.value as number;
  }
  return Math.min(reduction, 0.8);
}

/** Calculate plasma damage multiplier from relics */
export function getPlasmaDamageMult(g: GameState): number {
  if (!g?.relics) return 1.0;
  let mult = 1.0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'plasma_damage_mult') mult *= relic.effect.value as number;
  }
  return mult;
}

/** Calculate crit chance from relics */
export function getCritChance(g: GameState): number {
  if (!g?.relics) return 0;
  let chance = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'crit_chance') chance += relic.effect.value as number;
  }
  return Math.min(chance, 0.5);
}

/** Calculate HP ratio damage bonus */
export function getHpRatioDamageBonus(g: GameState, targetHpRatio: number): number {
  if (!g?.relics || targetHpRatio == null) return 0;
  let bonus = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'hp_ratio_damage') {
      const hpMissing = 1 - targetHpRatio;
      bonus += (relic.effect.value as number) * hpMissing * 10;
    }
  }
  return Math.min(bonus, 1.0);
}

/** Get missile split count from relics */
export function getMissileSplitCount(g: GameState): number {
  if (!g?.relics) return 1;
  let count = 1;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'missile_split') count = relic.effect.value as number;
  }
  return count;
}

/** Get HP regen between missions percentage */
export function getHpRegenBetweenMissions(g: GameState): number {
  if (!g?.relics) return 0;
  let regen = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.effect.type === 'hp_regen_between_missions') regen += relic.effect.value as number;
  }
  return Math.min(regen, 0.5);
}

/** Get self-damage chance per shot */
export function getSelfDamageChance(g: GameState): number {
  if (!g?.relics) return 0;
  let chance = 0;
  for (const id of g.relics) {
    const relic = getRelicById(id);
    if (!relic) continue;
    if (relic.secondaryEffect?.type === 'self_damage') chance += relic.secondaryEffect.value as number;
  }
  return chance;
}

/** Apply per-frame relic effects (self-damage, etc.) */
export function applyPerFrameEffects(_dt: number, _g: GameState): void {
  // Placeholder for future continuous relic effects
}

/** Attempt to add a relic (respects slot limit, no duplicates) */
export function tryAddRelic(g: GameState, relicId: string): boolean {
  if (!g) return false;
  if (!g.relics) g.relics = [];
  if (g.relics.includes(relicId)) return false;
  if (g.relics.length >= (g.relicSlotLimit || 5)) return false;
  g.relics.push(relicId);
  triggerRelicAcquired(g, relicId);
  return true;
}

/** Trigger when a relic is acquired */
export function triggerRelicAcquired(g: GameState, relicId: string): void {
  const relic = getRelicById(relicId);
  if (!relic) return;

  SoundManager.play('relic_acquired');

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
  } as Record<string, unknown>);
}

/** Get a random relic by rarity */
export function getRandomRelic(rarity: RelicRarity): RelicDef {
  const pool = (RELIC_DATA as RelicDef[]).filter(r => r.rarity === rarity);
  if (pool.length === 0) return (RELIC_DATA as RelicDef[])[Math.floor(Math.random() * RELIC_DATA.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Get 3 random relics for starting choice */
export function getStartingRelicOptions(): RelicDef[] {
  const pool = [...RELIC_DATA as RelicDef[]];
  const options: RelicDef[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    options.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return options;
}

/** Check if navigation computer relic is active */
export function hasNavigationComputer(g: GameState): boolean {
  return hasRelic(g, 'navigation_computer');
}

/** Get active relic synergy definitions */
export function getActiveSynergies(g: GameState): Array<{ name: string; description: string }> {
  const synergies: Array<{ name: string; description: string }> = [];
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
