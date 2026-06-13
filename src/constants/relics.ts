/**
 * relics.ts — Relic definitions and category metadata.
 *
 * Relics are persistent passive modifiers collected during a run.
 * Each relic has an effect type and value consumed by relicSystem.js.
 */

export type RelicCategory = 'offensive' | 'defensive' | 'utility' | 'risky';
export type RelicRarity = 'common' | 'uncommon' | 'rare';

export type RelicEffectType =
  | 'fire_rate_mult'
  | 'plasma_damage_mult'
  | 'hp_ratio_damage'
  | 'missile_split'
  | 'crit_chance'
  | 'max_hp_bonus'
  | 'dodge_chance'
  | 'low_hp_damage_reduction'
  | 'reflect_chance'
  | 'scrap_mult'
  | 'extra_scrap_per_kill'
  | 'reveal_next_node'
  | 'hp_regen_between_missions'
  | 'damage_mult'
  | 'max_hp_penalty'
  | 'self_damage';

export interface RelicEffect {
  type: RelicEffectType;
  value: number;
}

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  category: RelicCategory;
  rarity: RelicRarity;
  icon: string;
  effect: RelicEffect;
  secondaryEffect?: RelicEffect;
  color?: string;
  cost: number;
}

export const RELIC_DATA: RelicDefinition[] = [
  {
    id: 'overclocked_cores',
    name: 'Overclocked Cores',
    description: '+15% fire rate, -5% accuracy',
    category: 'offensive',
    rarity: 'common',
    icon: '⚡',
    effect: { type: 'fire_rate_mult', value: 0.85 },
    cost: 100,
  },
  {
    id: 'plasma_conduit',
    name: 'Plasma Conduit',
    description: '+25% plasma damage',
    category: 'offensive',
    rarity: 'uncommon',
    icon: '🔥',
    effect: { type: 'plasma_damage_mult', value: 1.25 },
    cost: 150,
  },
  {
    id: 'predator',
    name: 'Predator',
    description: '+10% dmg per 10% enemy HP missing',
    category: 'offensive',
    rarity: 'uncommon',
    icon: '🎯',
    effect: { type: 'hp_ratio_damage', value: 0.10 },
    cost: 200,
  },
  {
    id: 'cluster_rounds',
    name: 'Cluster Rounds',
    description: 'Missiles split into 3 on hit',
    category: 'offensive',
    rarity: 'rare',
    icon: '💫',
    effect: { type: 'missile_split', value: 3 },
    cost: 300,
  },
  {
    id: 'shrapnel',
    name: 'Shrapnel',
    description: '10% chance for 2x damage',
    category: 'offensive',
    rarity: 'uncommon',
    icon: '💥',
    effect: { type: 'crit_chance', value: 0.10 },
    cost: 150,
  },
  {
    id: 'reinforced_hull',
    name: 'Reinforced Hull',
    description: '+20 max HP',
    category: 'defensive',
    rarity: 'common',
    icon: '🛡',
    effect: { type: 'max_hp_bonus', value: 20 },
    cost: 100,
  },
  {
    id: 'phase_shield',
    name: 'Phase Shield',
    description: '5% dodge chance',
    category: 'defensive',
    rarity: 'uncommon',
    icon: '✨',
    effect: { type: 'dodge_chance', value: 0.05 },
    cost: 200,
  },
  {
    id: 'heat_sink',
    name: 'Heat Sink',
    description: '-20% dmg taken below 30% HP',
    category: 'defensive',
    rarity: 'uncommon',
    icon: '❄',
    effect: { type: 'low_hp_damage_reduction', value: 0.20 },
    cost: 150,
  },
  {
    id: 'deflector_plates',
    name: 'Deflector Plates',
    description: 'Reflect 10% damage',
    category: 'defensive',
    rarity: 'rare',
    icon: '🔰',
    effect: { type: 'reflect_chance', value: 0.10 },
    cost: 250,
  },
  {
    id: 'scrap_magnet',
    name: 'Scrap Magnet',
    description: '+25% scrap from all sources',
    category: 'utility',
    rarity: 'common',
    icon: '🧲',
    effect: { type: 'scrap_mult', value: 1.25 },
    cost: 100,
  },
  {
    id: 'salvager',
    name: 'Salvager',
    description: 'Enemies drop +1 extra scrap',
    category: 'utility',
    rarity: 'common',
    icon: '♻',
    effect: { type: 'extra_scrap_per_kill', value: 1 },
    cost: 100,
  },
  {
    id: 'navigation_computer',
    name: 'Navigation Computer',
    description: 'Reveal next node on map',
    category: 'utility',
    rarity: 'uncommon',
    icon: '🗺',
    effect: { type: 'reveal_next_node', value: 1 },
    cost: 150,
  },
  {
    id: 'auto_doctor',
    name: 'Auto-Doctor',
    description: '+10% HP regen between missions',
    category: 'utility',
    rarity: 'uncommon',
    icon: '💊',
    effect: { type: 'hp_regen_between_missions', value: 0.10 },
    cost: 150,
  },
  {
    id: 'berserker_chip',
    name: 'Berserker Chip',
    description: '+30% damage, -30% max HP',
    category: 'risky',
    rarity: 'rare',
    icon: '☠',
    effect: { type: 'damage_mult', value: 1.30 },
    secondaryEffect: { type: 'max_hp_penalty', value: 0.70 },
    cost: 250,
  },
  {
    id: 'unstable_reactor',
    name: 'Unstable Reactor',
    description: '+50% fire rate, 5% self-damage per shot',
    category: 'risky',
    rarity: 'rare',
    icon: '⚛',
    effect: { type: 'fire_rate_mult', value: 0.50 },
    secondaryEffect: { type: 'self_damage', value: 0.05 },
    cost: 300,
  },
];

export const CATEGORY_COLORS: Record<RelicCategory, string> = {
  offensive: '#ef4444',
  defensive: '#3b82f6',
  utility: '#22c55e',
  risky: '#a855f7',
};
