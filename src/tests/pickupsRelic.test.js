import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updatePickups } from '../engine/systems/pickups';
import { killEnemy } from '../engine/combat';
import { createTestState, createTestPickup, createTestEnemy } from './helpers';

// Mock SoundManager so it doesn't try to play audio in tests
vi.mock('../engine/audio', () => ({
  SoundManager: {
    play: vi.fn(),
  },
}));

// Mock targeting to avoid side effects in killEnemy
vi.mock('../engine/targeting', () => ({
  getHostileTargets: vi.fn(() => []),
}));

// Mock particles system
vi.mock('../engine/systems/particles', () => ({
  createParticlesWithType: vi.fn(),
}));

// Mock spawner
vi.mock('../engine/spawner', () => ({
  spawnMiniInterceptors: vi.fn(),
}));

// Mock weaponSynergies
vi.mock('../engine/weaponSynergies', () => ({
  applyMissileKillSynergy: vi.fn(() => []),
  getActiveSynergies: vi.fn(() => []),
}));

describe('pickups relic integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scrap multiplier from scrap_magnet', () => {
    it('applies scrap multiplier from scrap_magnet', () => {
      const g = createTestState({
        relics: ['scrap_magnet'],
        scrap: 0,
        totalScrapEarned: 0,
        player: { ...createTestState().player, magnetRadius: 200 },
        pickups: [createTestPickup(10, 10, 5)], // 5 value pickup near player
      });

      updatePickups(0.016, g);

      // scrap_magnet gives 1.25x: 5 * 1.25 = 6.25 -> floor = 6
      // Pickup should be collected (within magnetRadius)
      expect(g.pickups[0].active).toBe(false);
      expect(g.scrap).toBe(6);
    });

    it('no scrap multiplier without relics', () => {
      const g = createTestState({
        relics: [],
        scrap: 0,
        totalScrapEarned: 0,
        player: { ...createTestState().player, magnetRadius: 200 },
        pickups: [createTestPickup(10, 10, 5)],
      });

      updatePickups(0.016, g);

      expect(g.pickups[0].active).toBe(false);
      expect(g.scrap).toBe(5);
    });

    it('chains scrap multiplier with combo multiplier', () => {
      const g = createTestState({
        relics: ['scrap_magnet'],
        scrap: 0,
        totalScrapEarned: 0,
        combo: { count: 5, timer: 2, multiplier: 2 }, // 2x combo
        player: { ...createTestState().player, magnetRadius: 200 },
        pickups: [createTestPickup(10, 10, 5)],
      });

      updatePickups(0.016, g);

      // 5 * 2 (combo) * 1.25 (relic) = 12.5 -> floor = 12
      expect(g.pickups[0].active).toBe(false);
      expect(g.scrap).toBe(12);
    });
  });

  describe('Salvager extra scrap per kill', () => {
    it('adds extra scrap per kill with salvager relic', () => {
      const g = createTestState({
        relics: ['salvager'],
        pickups: [],
      });

      const enemy = createTestEnemy(100, 100, 'fighter');
      killEnemy(g, enemy);

      // fighter base scrap = 1, salvager adds +1 = 2
      expect(g.pickups.length).toBe(1);
      expect(g.pickups[0].value).toBe(2);
    });

    it('no extra scrap without salvager relic', () => {
      const g = createTestState({
        relics: [],
        pickups: [],
      });

      const enemy = createTestEnemy(100, 100, 'fighter');
      killEnemy(g, enemy);

      expect(g.pickups.length).toBe(1);
      expect(g.pickups[0].value).toBe(1);
    });

    it('salvager bonus applies to heavy enemies too', () => {
      const g = createTestState({
        relics: ['salvager'],
        pickups: [],
      });

      const enemy = createTestEnemy(100, 100, 'heavy');
      killEnemy(g, enemy);

      // heavy base scrap = 5, salvager adds +1 = 6
      expect(g.pickups.length).toBe(1);
      expect(g.pickups[0].value).toBe(6);
    });

    it('salvager bonus stacks with rampage mode', () => {
      const g = createTestState({
        relics: ['salvager'],
        pickups: [],
        adaptiveDifficulty: { ...createTestState().adaptiveDifficulty, rampageMode: true },
      });

      const enemy = createTestEnemy(100, 100, 'fighter');
      killEnemy(g, enemy);

      // fighter base = 1, rampage 3x = 3, salvager +1 = 4
      expect(g.pickups.length).toBe(1);
      expect(g.pickups[0].value).toBe(4);
    });
  });
});
