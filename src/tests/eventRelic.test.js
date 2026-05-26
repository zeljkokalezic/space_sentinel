import { describe, it, expect } from 'vitest';
import { EVENTS_DATA } from '../constants/events';
import { tryAddRelic, getRandomRelic } from '../engine/relicSystem';
import { createTestState } from './helpers';

describe('event relic rewards', () => {
  it('has events with relicReward field', () => {
    const eventsWithRelics = EVENTS_DATA.filter(e =>
      e.choices.some(c => c.relicReward)
    );
    expect(eventsWithRelics.length).toBeGreaterThanOrEqual(3);
  });

  it('relicReward has valid rarity', () => {
    for (const event of EVENTS_DATA) {
      for (const choice of event.choices) {
        if (choice.relicReward) {
          expect(['common', 'uncommon', 'rare']).toContain(choice.relicReward.rarity);
        }
      }
    }
  });

  it('getRandomRelic returns correct rarity for event rewards', () => {
    for (let i = 0; i < 10; i++) {
      const relic = getRandomRelic('common');
      expect(relic.rarity).toBe('common');
    }
  });

  it('tryAddRelic works from event context', () => {
    const g = createTestState();
    const relic = getRandomRelic('common');
    const result = tryAddRelic(g, relic.id);
    expect(result).toBe(true);
    expect(g.relics).toContain(relic.id);
  });

  it('events with relicReward still have resolve function', () => {
    for (const event of EVENTS_DATA) {
      for (const choice of event.choices) {
        if (choice.relicReward) {
          expect(choice.resolve).toBeDefined();
        }
      }
    }
  });
});
