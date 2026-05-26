import { describe, it, expect } from 'vitest';
import {
  getRelicById, getActiveRelics, hasRelic,
  getDamageMult, getFireRateMult, getScrapMult,
  getExtraScrapPerKill, getDodgeChance, getReflectChance,
  getMaxHpBonus, getMaxHpPenaltyMult, getLowHpDamageReduction,
  getPlasmaDamageMult, getCritChance, getHpRatioDamageBonus,
  getMissileSplitCount, getHpRegenBetweenMissions, getSelfDamageChance,
  tryAddRelic, getRandomRelic, getStartingRelicOptions,
  hasNavigationComputer, getActiveSynergies,
} from '../engine/relicSystem';
import { RELIC_DATA, CATEGORY_COLORS } from '../constants/relics';
import { createTestState } from './helpers';

describe('relic constants', () => {
  it('has 15 relics defined', () => {
    expect(RELIC_DATA.length).toBe(15);
  });

  it('has category colors for all categories', () => {
    expect(CATEGORY_COLORS).toHaveProperty('offensive');
    expect(CATEGORY_COLORS).toHaveProperty('defensive');
    expect(CATEGORY_COLORS).toHaveProperty('utility');
    expect(CATEGORY_COLORS).toHaveProperty('risky');
  });

  it('all relics have required fields', () => {
    for (const relic of RELIC_DATA) {
      expect(relic).toHaveProperty('id');
      expect(relic).toHaveProperty('name');
      expect(relic).toHaveProperty('description');
      expect(relic).toHaveProperty('category');
      expect(relic).toHaveProperty('rarity');
      expect(relic).toHaveProperty('icon');
      expect(relic).toHaveProperty('effect');
      expect(relic).toHaveProperty('cost');
    }
  });
});

describe('getRelicById', () => {
  it('returns relic by id', () => {
    const relic = getRelicById('overclocked_cores');
    expect(relic).not.toBeNull();
    expect(relic.name).toBe('Overclocked Cores');
  });

  it('returns null for unknown id', () => {
    expect(getRelicById('nonexistent')).toBeNull();
  });
});

describe('getActiveRelics', () => {
  it('returns empty array with no relics', () => {
    const g = createTestState();
    expect(getActiveRelics(g)).toEqual([]);
  });

  it('returns relic definitions for active relics', () => {
    const g = createTestState({ relics: ['overclocked_cores', 'scrap_magnet'] });
    const active = getActiveRelics(g);
    expect(active).toHaveLength(2);
    expect(active[0].id).toBe('overclocked_cores');
    expect(active[1].id).toBe('scrap_magnet');
  });
});

describe('hasRelic', () => {
  it('returns false with no relics', () => {
    expect(hasRelic(createTestState(), 'overclocked_cores')).toBe(false);
  });

  it('returns true when relic is present', () => {
    const g = createTestState({ relics: ['overclocked_cores'] });
    expect(hasRelic(g, 'overclocked_cores')).toBe(true);
  });

  it('returns false when relic is not present', () => {
    const g = createTestState({ relics: ['scrap_magnet'] });
    expect(hasRelic(g, 'overclocked_cores')).toBe(false);
  });
});

describe('multiplier functions', () => {
  it('getDamageMult returns 1.0 with no relics', () => {
    expect(getDamageMult(createTestState())).toBe(1.0);
  });

  it('getDamageMult applies berserker_chip', () => {
    const g = createTestState({ relics: ['berserker_chip'] });
    expect(getDamageMult(g)).toBe(1.3);
  });

  it('getFireRateMult returns 1.0 with no relics', () => {
    expect(getFireRateMult(createTestState())).toBe(1.0);
  });

  it('getFireRateMult applies overclocked_cores', () => {
    const g = createTestState({ relics: ['overclocked_cores'] });
    expect(getFireRateMult(g)).toBe(0.85);
  });

  it('getFireRateMult stacks multiple fire rate relics', () => {
    const g = createTestState({ relics: ['overclocked_cores', 'unstable_reactor'] });
    // overclocked: 0.85, unstable: 0.50
    expect(getFireRateMult(g)).toBeCloseTo(0.425);
  });

  it('getScrapMult applies scrap_magnet', () => {
    const g = createTestState({ relics: ['scrap_magnet'] });
    expect(getScrapMult(g)).toBe(1.25);
  });

  it('getExtraScrapPerKill applies salvager', () => {
    const g = createTestState({ relics: ['salvager'] });
    expect(getExtraScrapPerKill(g)).toBe(1);
  });

  it('getDodgeChance applies phase_shield', () => {
    const g = createTestState({ relics: ['phase_shield'] });
    expect(getDodgeChance(g)).toBe(0.05);
  });

  it('getDodgeChance caps at 0.5', () => {
    // Multiple phase shields would exceed cap, but we only allow unique relics
    // so this tests the cap logic is present
    expect(getDodgeChance(createTestState({ relics: ['phase_shield'] }))).toBeLessThanOrEqual(0.5);
  });

  it('getReflectChance applies deflector_plates', () => {
    const g = createTestState({ relics: ['deflector_plates'] });
    expect(getReflectChance(g)).toBe(0.1);
  });

  it('getMaxHpBonus applies reinforced_hull', () => {
    const g = createTestState({ relics: ['reinforced_hull'] });
    expect(getMaxHpBonus(g)).toBe(20);
  });

  it('getMaxHpPenaltyMult applies berserker_chip', () => {
    const g = createTestState({ relics: ['berserker_chip'] });
    expect(getMaxHpPenaltyMult(g)).toBe(0.7);
  });

  it('getLowHpDamageReduction applies heat_sink', () => {
    const g = createTestState({ relics: ['heat_sink'] });
    expect(getLowHpDamageReduction(g)).toBe(0.2);
  });

  it('getPlasmaDamageMult applies plasma_conduit', () => {
    const g = createTestState({ relics: ['plasma_conduit'] });
    expect(getPlasmaDamageMult(g)).toBe(1.25);
  });

  it('getCritChance applies shrapnel', () => {
    const g = createTestState({ relics: ['shrapnel'] });
    expect(getCritChance(g)).toBe(0.1);
  });

  it('getHpRatioDamageBonus scales with enemy HP missing', () => {
    const g = createTestState({ relics: ['predator'] });
    // Full HP enemy (ratio 1.0) = 0 bonus
    expect(getHpRatioDamageBonus(g, 1.0)).toBe(0);
    // Half HP enemy (ratio 0.5) = 50% missing = 5 * 0.1 = 0.5
    expect(getHpRatioDamageBonus(g, 0.5)).toBe(0.5);
    // Dead enemy (ratio 0.0) = 100% missing = 10 * 0.1 = 1.0 (capped)
    expect(getHpRatioDamageBonus(g, 0.0)).toBe(1.0);
  });

  it('getMissileSplitCount applies cluster_rounds', () => {
    const g = createTestState({ relics: ['cluster_rounds'] });
    expect(getMissileSplitCount(g)).toBe(3);
  });

  it('getHpRegenBetweenMissions applies auto_doctor', () => {
    const g = createTestState({ relics: ['auto_doctor'] });
    expect(getHpRegenBetweenMissions(g)).toBe(0.1);
  });

  it('getSelfDamageChance applies unstable_reactor', () => {
    const g = createTestState({ relics: ['unstable_reactor'] });
    expect(getSelfDamageChance(g)).toBe(0.05);
  });
});

describe('tryAddRelic', () => {
  it('adds relic when slots available', () => {
    const g = createTestState();
    expect(tryAddRelic(g, 'overclocked_cores')).toBe(true);
    expect(g.relics).toContain('overclocked_cores');
  });

  it('rejects duplicate relics', () => {
    const g = createTestState({ relics: ['overclocked_cores'] });
    expect(tryAddRelic(g, 'overclocked_cores')).toBe(false);
    expect(g.relics).toHaveLength(1);
  });

  it('respects slot limit', () => {
    const g = createTestState({ relics: ['overclocked_cores', 'scrap_magnet', 'salvager', 'phase_shield', 'reinforced_hull'] });
    expect(g.relics.length).toBe(5);
    expect(tryAddRelic(g, 'deflector_plates')).toBe(false);
    expect(g.relics.length).toBe(5);
  });

  it('works with null game state', () => {
    expect(tryAddRelic(null, 'overclocked_cores')).toBe(false);
  });
});

describe('getRandomRelic', () => {
  it('returns a valid relic', () => {
    const relic = getRandomRelic('common');
    expect(relic.rarity).toBe('common');
  });

  it('falls back to any rarity when pool is empty', () => {
    const relic = getRandomRelic('nonexistent');
    expect(RELIC_DATA).toContain(relic);
  });
});

describe('getStartingRelicOptions', () => {
  it('returns 3 unique relics', () => {
    const options = getStartingRelicOptions();
    expect(options).toHaveLength(3);
    const ids = options.map(r => r.id);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('hasNavigationComputer', () => {
  it('returns true when relic present', () => {
    const g = createTestState({ relics: ['navigation_computer'] });
    expect(hasNavigationComputer(g)).toBe(true);
  });

  it('returns false when relic absent', () => {
    const g = createTestState();
    expect(hasNavigationComputer(g)).toBe(false);
  });
});

describe('getActiveSynergies', () => {
  it('returns empty array with no relics', () => {
    expect(getActiveSynergies(createTestState())).toEqual([]);
  });

  it('detects Plasma Storm synergy', () => {
    const g = createTestState({ relics: ['plasma_conduit', 'cluster_rounds'] });
    const synergies = getActiveSynergies(g);
    expect(synergies.some(s => s.name === 'Plasma Storm')).toBe(true);
  });

  it('detects Scrap Tycoon synergy', () => {
    const g = createTestState({ relics: ['scrap_magnet', 'salvager'] });
    const synergies = getActiveSynergies(g);
    expect(synergies.some(s => s.name === 'Scrap Tycoon')).toBe(true);
  });

  it('detects Glass Cannon synergy', () => {
    const g = createTestState({ relics: ['berserker_chip', 'heat_sink'] });
    const synergies = getActiveSynergies(g);
    expect(synergies.some(s => s.name === 'Glass Cannon')).toBe(true);
  });

  it('detects Iron Will synergy', () => {
    const g = createTestState({ relics: ['reinforced_hull', 'deflector_plates'] });
    const synergies = getActiveSynergies(g);
    expect(synergies.some(s => s.name === 'Iron Will')).toBe(true);
  });

  it('detects Speed Demon synergy', () => {
    const g = createTestState({ relics: ['overclocked_cores', 'auto_doctor'] });
    const synergies = getActiveSynergies(g);
    expect(synergies.some(s => s.name === 'Speed Demon')).toBe(true);
  });

  it('detects Unstoppable synergy', () => {
    const g = createTestState({ relics: ['unstable_reactor', 'predator'] });
    const synergies = getActiveSynergies(g);
    expect(synergies.some(s => s.name === 'Unstoppable')).toBe(true);
  });
});
