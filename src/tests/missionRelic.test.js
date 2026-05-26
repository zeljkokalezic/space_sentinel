import { describe, it, expect, vi } from 'vitest';
import { createTestState } from './helpers';
import { tryAddRelic, getRandomRelic } from '../engine/relicSystem';
import { RELIC_DATA } from '../constants/relics';

describe('mission random relic find', () => {
  it('getRandomRelic returns rare relic', () => {
    const relic = getRandomRelic('rare');
    expect(relic.rarity).toBe('rare');
  });

  it('tryAddRelic works for random finds', () => {
    const g = createTestState();
    const relic = getRandomRelic('rare');
    expect(tryAddRelic(g, relic.id)).toBe(true);
    expect(g.relics).toContain(relic.id);
  });

  it('respects slot limit for random finds', () => {
    const g = createTestState({
      relics: ['overclocked_cores', 'scrap_magnet', 'salvager', 'phase_shield', 'reinforced_hull'],
    });
    const relic = getRandomRelic('rare');
    expect(tryAddRelic(g, relic.id)).toBe(false);
    expect(g.relics.length).toBe(5);
  });
});

describe('applyPerFrameEffects', () => {
  it('does not crash with empty game state', async () => {
    const { applyPerFrameEffects } = await import('../engine/relicSystem');
    const g = createTestState();
    expect(() => applyPerFrameEffects(0.016, g)).not.toThrow();
  });
});
