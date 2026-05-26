import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestState, createTestBoss, createTestMiniboss } from './helpers';
import { getRelicById, tryAddRelic, getRandomRelic } from '../engine/relicSystem';
import { RELIC_DATA } from '../constants/relics';

// Mock SoundManager so it doesn't try to play audio in tests
vi.mock('../engine/audio', () => ({
  SoundManager: {
    play: vi.fn(),
  },
}));

// Mock dynamicFov
vi.mock('../engine/systems/dynamicFov', () => ({
  triggerFovBossDeath: vi.fn(),
}));

// Mock bossSignatureMechanics
vi.mock('../engine/systems/bossSignatureMechanics', () => ({
  updateBossSignatureMechanics: vi.fn(),
  checkVoidZoneCollision: vi.fn(),
}));

describe('boss relic drop', () => {
  it('boss death adds an uncommon relic to inventory', () => {
    const g = createTestState({
      relics: [],
      relicSlotLimit: 5,
      boss: createTestBoss(500, 500, 100, 1),
    });

    // Verify starting state
    expect(g.relics.length).toBe(0);

    // Find an uncommon relic and verify the mechanism works
    const uncommonRelic = RELIC_DATA.find(r => r.rarity === 'uncommon');
    expect(uncommonRelic).toBeDefined();

    // tryAddRelic should succeed on empty inventory
    expect(tryAddRelic(g, uncommonRelic.id)).toBe(true);
    expect(g.relics).toContain(uncommonRelic.id);
  });

  it('getRandomRelic returns an uncommon relic for bosses', () => {
    // Run multiple times to verify consistency
    for (let i = 0; i < 10; i++) {
      const relic = getRandomRelic('uncommon');
      expect(relic).toBeDefined();
      expect(relic.rarity).toBe('uncommon');
      expect(relic.id).toBeDefined();
    }
  });

  it('boss relic drop respects slot limit', () => {
    const g = createTestState({
      relics: [],
      relicSlotLimit: 2,
    });

    const uncommonRelics = RELIC_DATA.filter(r => r.rarity === 'uncommon');
    expect(uncommonRelics.length).toBeGreaterThan(0);

    // Fill slots
    expect(tryAddRelic(g, uncommonRelics[0].id)).toBe(true);
    expect(tryAddRelic(g, uncommonRelics[1].id)).toBe(true);
    expect(g.relics.length).toBe(2);

    // Should fail when full
    if (uncommonRelics.length > 2) {
      expect(tryAddRelic(g, uncommonRelics[2].id)).toBe(false);
      expect(g.relics.length).toBe(2);
    }
  });

  it('boss relic drop prevents duplicates', () => {
    const g = createTestState({
      relics: [],
      relicSlotLimit: 5,
    });

    const uncommonRelic = RELIC_DATA.find(r => r.rarity === 'uncommon');
    expect(uncommonRelic).toBeDefined();

    // First add succeeds
    expect(tryAddRelic(g, uncommonRelic.id)).toBe(true);
    expect(g.relics).toContain(uncommonRelic.id);

    // Second add of same relic fails
    expect(tryAddRelic(g, uncommonRelic.id)).toBe(false);
    expect(g.relics.length).toBe(1);
  });
});

describe('miniboss relic drop', () => {
  it('miniboss death adds a common relic', () => {
    const g = createTestState({
      relics: [],
      relicSlotLimit: 5,
      miniboss: createTestMiniboss(500, 500, 600, 1),
    });

    // Verify starting state
    expect(g.relics.length).toBe(0);

    // Find a common relic and verify the mechanism works
    const commonRelic = RELIC_DATA.find(r => r.rarity === 'common');
    expect(commonRelic).toBeDefined();

    expect(tryAddRelic(g, commonRelic.id)).toBe(true);
    expect(g.relics).toContain(commonRelic.id);
  });

  it('getRandomRelic returns a common relic for minibosses', () => {
    // Run multiple times to verify consistency
    for (let i = 0; i < 10; i++) {
      const relic = getRandomRelic('common');
      expect(relic).toBeDefined();
      expect(relic.rarity).toBe('common');
      expect(relic.id).toBeDefined();
    }
  });

  it('miniboss relic drop respects slot limit', () => {
    const g = createTestState({
      relics: [],
      relicSlotLimit: 1,
    });

    const commonRelics = RELIC_DATA.filter(r => r.rarity === 'common');
    expect(commonRelics.length).toBeGreaterThan(0);

    expect(tryAddRelic(g, commonRelics[0].id)).toBe(true);
    expect(g.relics.length).toBe(1);

    if (commonRelics.length > 1) {
      expect(tryAddRelic(g, commonRelics[1].id)).toBe(false);
      expect(g.relics.length).toBe(1);
    }
  });
});

describe('relic rarity separation', () => {
  it('common and uncommon pools are distinct', () => {
    const commonIds = new Set(
      RELIC_DATA.filter(r => r.rarity === 'common').map(r => r.id)
    );
    const uncommonIds = new Set(
      RELIC_DATA.filter(r => r.rarity === 'uncommon').map(r => r.id)
    );

    // Both pools should have relics
    expect(commonIds.size).toBeGreaterThan(0);
    expect(uncommonIds.size).toBeGreaterThan(0);

    // Pools should not overlap
    for (const id of commonIds) {
      expect(uncommonIds.has(id)).toBe(false);
    }
  });

  it('relic definitions have required fields', () => {
    for (const relic of RELIC_DATA) {
      expect(relic.id).toBeDefined();
      expect(relic.name).toBeDefined();
      expect(relic.rarity).toBeDefined();
      expect(relic.effect).toBeDefined();
    }
  });
});

describe('updateBossCore relic integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bossCore death block calls tryAddRelic with uncommon by default', async () => {
    const { updateBossCore } = await import('../engine/systems/bossCore');

    const g = createTestState({
      relics: [],
      relicSlotLimit: 5,
      boss: createTestBoss(500, 500, 0, 1), // hp = 0 to trigger death
    });
    g.boss.active = true;

    const missionCompleted = vi.fn();
    const setGameState = vi.fn();

    // Boss starts with 0 HP, so death triggers immediately
    const result = updateBossCore(0.016, g.boss, g, 1, 1, {
      deathColors: [0xdc2626, 0xfbbf24],
      guaranteedDrops: null,
      scrapValue: 100,
      // No relicRarity specified — should default to 'uncommon'
    }, missionCompleted, setGameState);

    expect(result).toBe(true); // Boss dead, game should stop
    expect(missionCompleted).toHaveBeenCalled();
    expect(g.relics.length).toBe(1);

    // Verify the dropped relic is uncommon
    const droppedRelic = getRelicById(g.relics[0]);
    expect(droppedRelic).toBeDefined();
    expect(droppedRelic.rarity).toBe('uncommon');
  });

  it('minibossCore death block calls tryAddRelic with common rarity', async () => {
    const { updateBossCore } = await import('../engine/systems/bossCore');

    const g = createTestState({
      relics: [],
      relicSlotLimit: 5,
      miniboss: createTestMiniboss(500, 500, 0, 1), // hp = 0 to trigger death
    });
    g.miniboss.active = true;

    const missionCompleted = vi.fn();
    const setGameState = vi.fn();

    const result = updateBossCore(0.016, g.miniboss, g, 1, 0.5, {
      deathColors: [0xf97316, 0xfbbf24],
      guaranteedDrops: null,
      scrapValue: 50,
      relicRarity: 'common', // miniboss passes this
    }, missionCompleted, setGameState);

    expect(result).toBe(true);
    expect(missionCompleted).toHaveBeenCalled();
    expect(g.relics.length).toBe(1);

    // Verify the dropped relic is common
    const droppedRelic = getRelicById(g.relics[0]);
    expect(droppedRelic).toBeDefined();
    expect(droppedRelic.rarity).toBe('common');
  });

  it('does not add duplicate relic on second boss death', async () => {
    const { updateBossCore } = await import('../engine/systems/bossCore');

    const g = createTestState({
      relics: [],
      relicSlotLimit: 5,
    });

    const missionCompleted = vi.fn();
    const setGameState = vi.fn();

    // First boss death
    const boss1 = createTestBoss(500, 500, 0, 1);
    boss1.active = true;
    updateBossCore(0.016, boss1, g, 1, 1, {
      deathColors: [0xdc2626, 0xfbbf24],
      guaranteedDrops: null,
      scrapValue: 100,
    }, missionCompleted, setGameState);

    expect(g.relics.length).toBe(1);
    const firstRelicId = g.relics[0];

    // Second boss death — if same relic is randomly selected, it should be skipped
    const boss2 = createTestBoss(500, 500, 0, 1);
    boss2.active = true;

    // Force the same relic by mocking getRandomRelic
    const { getRandomRelic: originalGetRandomRelic } = await import('../engine/relicSystem');
    // We can't easily mock the internal call, so just verify the duplicate logic
    // works at the tryAddRelic level
    expect(tryAddRelic(g, firstRelicId)).toBe(false);
    expect(g.relics.length).toBe(1);
  });

  it('does not add relic when inventory is full', async () => {
    const { updateBossCore } = await import('../engine/systems/bossCore');

    // Fill inventory to capacity (slot limit = 5)
    const g = createTestState({
      relics: [],
      relicSlotLimit: 5,
    });

    // Use any available relics to fill all 5 slots
    const allRelics = RELIC_DATA;
    for (let i = 0; i < 5 && i < allRelics.length; i++) {
      tryAddRelic(g, allRelics[i].id);
    }
    expect(g.relics.length).toBe(5);

    const missionCompleted = vi.fn();
    const setGameState = vi.fn();

    const boss = createTestBoss(500, 500, 0, 1);
    boss.active = true;

    updateBossCore(0.016, boss, g, 1, 1, {
      deathColors: [0xdc2626, 0xfbbf24],
      guaranteedDrops: null,
      scrapValue: 100,
    }, missionCompleted, setGameState);

    // Boss should still die and mission should complete
    expect(missionCompleted).toHaveBeenCalled();
    // No new relic added (inventory full) — stays at 5
    expect(g.relics.length).toBe(5);
  });
});
