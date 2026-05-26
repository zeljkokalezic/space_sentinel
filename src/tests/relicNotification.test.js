/**
 * Tests for triggerRelicAcquired notification + getActiveSynergies.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestState } from './helpers';
import { tryAddRelic, triggerRelicAcquired, getActiveSynergies } from '../engine/relicSystem';
import { RELIC_DATA } from '../constants/relics';

// Mock SoundManager so it doesn't try to create AudioContext in tests
let soundCalls = [];
vi.mock('../engine/audio', () => ({
  SoundManager: {
    play: vi.fn((name) => { soundCalls.push(name); }),
  },
}));

// Mock window for node environment (triggerRelicAcquired uses innerWidth/innerHeight)
beforeEach(() => {
  globalThis.window = { innerWidth: 1920, innerHeight: 1080 };
  soundCalls = [];
});

describe('triggerRelicAcquired', () => {
  it('creates a visual effect on successful relic acquire', () => {
    const g = createTestState();
    const relic = RELIC_DATA[0];
    triggerRelicAcquired(g, relic.id);

    expect(g.effects).toHaveLength(1);
    expect(g.effects[0].type).toBe('relic_acquired');
    expect(g.effects[0].text).toContain(relic.name);
    expect(g.effects[0].icon).toBe(relic.icon);
  });

  it('plays the relic_acquired sound', () => {
    const g = createTestState();
    const relic = RELIC_DATA[0];
    triggerRelicAcquired(g, relic.id);

    expect(soundCalls).toContain('relic_acquired');
  });

  it('does not crash with null relic', () => {
    const g = createTestState();
    expect(() => triggerRelicAcquired(g, 'nonexistent')).not.toThrow();
    expect(g.effects).toHaveLength(0);
  });

  it('creates effect with correct position and color', () => {
    const g = createTestState();
    const relic = RELIC_DATA[0];
    triggerRelicAcquired(g, relic.id);

    const effect = g.effects[0];
    expect(effect.x).toBe(1920 / 2);
    expect(effect.y).toBe(Math.max(150, 1080 / 4));
    expect(effect.life).toBe(3);
    expect(effect.maxLife).toBe(3);
    expect(effect.color).toBe('#fbbf24');
  });

  it('initializes g.effects array if missing', () => {
    const g = createTestState();
    delete g.effects;
    const relic = RELIC_DATA[0];
    triggerRelicAcquired(g, relic.id);

    expect(g.effects).toBeDefined();
    expect(g.effects).toHaveLength(1);
  });
});

describe('tryAddRelic calls triggerRelicAcquired', () => {
  it('triggers notification when adding a new relic', () => {
    const g = createTestState();
    const relic = RELIC_DATA[0];

    expect(g.effects).toHaveLength(0);
    tryAddRelic(g, relic.id);

    expect(g.relics).toContain(relic.id);
    expect(g.effects).toHaveLength(1);
    expect(g.effects[0].type).toBe('relic_acquired');
    expect(soundCalls).toContain('relic_acquired');
  });

  it('does not trigger notification for duplicate relic', () => {
    const g = createTestState();
    const relic = RELIC_DATA[0];

    tryAddRelic(g, relic.id);
    const effectsAfterFirst = g.effects.length;

    tryAddRelic(g, relic.id);

    expect(g.effects.length).toBe(effectsAfterFirst);
  });
});

describe('getActiveSynergies', () => {
  it('returns empty array for no relics', () => {
    const g = createTestState();
    expect(getActiveSynergies(g)).toEqual([]);
  });

  it('returns synergies for matching relic pairs', () => {
    const g = createTestState({
      relics: ['plasma_conduit', 'cluster_rounds']
    });
    const synergies = getActiveSynergies(g);
    expect(synergies.length).toBeGreaterThan(0);
    expect(synergies[0].name).toBe('Plasma Storm');
  });

  it('returns multiple synergies for multiple matching pairs', () => {
    const g = createTestState({
      relics: ['scrap_magnet', 'salvager', 'plasma_conduit', 'cluster_rounds']
    });
    const synergies = getActiveSynergies(g);
    expect(synergies.length).toBe(2);
  });

  it('returns empty array when only one half of a pair is present', () => {
    const g = createTestState({
      relics: ['plasma_conduit']
    });
    expect(getActiveSynergies(g)).toEqual([]);
  });
});
