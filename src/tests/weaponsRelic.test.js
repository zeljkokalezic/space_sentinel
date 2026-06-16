import { describe, it, expect, vi, afterEach } from 'vitest';
import { updateWeapons } from '../engine/systems/weapons';
import { createTestState, createTestEnemy } from './helpers';
import { GAME_CONFIG } from '../constants/gameConfig';

vi.mock('../engine/audio', () => ({
  SoundManager: {
    play: vi.fn(),
  },
}));

describe('weapons relic integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies damage multiplier from berserker_chip', () => {
    const g = createTestState({
      relics: ['berserker_chip'],
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      player: { ...createTestState().player, aimAngle: 0 },
      projectiles: [],
      enemies: [createTestEnemy(500, 0)],
    });

    updateWeapons(0.016, g, vi.fn());

    // Check that a projectile was fired with increased damage
    const proj = g.projectiles.find(p => p.type === 'autocannon');
    expect(proj).toBeDefined();
    // Base damage: 10 + 1*5 = 15. With berserker: 15 * 1.3 = 19.5
    expect(proj.damage).toBeCloseTo(19.5, 1);
  });

  it('applies fire rate multiplier from overclocked_cores', () => {
    const g = createTestState({
      relics: ['overclocked_cores'],
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      player: { ...createTestState().player, aimAngle: 0 },
      projectiles: [],
      enemies: [createTestEnemy(500, 0)],
    });

    updateWeapons(0.016, g, vi.fn());

    // Cooldown should be reduced by 0.85x
    // Base cooldown: 0.4 - 1*0.025 = 0.375. With overclocked: 0.375 * 0.85 = 0.31875
    expect(g.cooldowns.autocannon).toBeCloseTo(0.31875, 3);
  });

  it('applies plasma damage multiplier from plasma_conduit', () => {
    const g = createTestState({
      relics: ['plasma_conduit'],
      levels: { autocannon: 0, plasma: 1, missiles: 0, pointDefense: 0, autoAim: 0 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      player: { ...createTestState().player, aimAngle: 0 },
      projectiles: [],
      enemies: [createTestEnemy(500, 0)],
    });

    updateWeapons(0.016, g, vi.fn());

    const proj = g.projectiles.find(p => p.type === 'plasma');
    expect(proj).toBeDefined();
    // Base plasma damage: 30 + 1*15 = 45. With plasma_conduit: 45 * 1.25 = 56.25
    expect(proj.damage).toBeCloseTo(56.25, 1);
  });

  it('applies missile split from cluster_rounds', () => {
    const g = createTestState({
      relics: ['cluster_rounds'],
      levels: { autocannon: 0, plasma: 0, missiles: 2, pointDefense: 0, autoAim: 0 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      player: { ...createTestState().player, aimAngle: 0 },
      projectiles: [],
      enemies: [createTestEnemy(500, 0)],
    });

    updateWeapons(0.016, g, vi.fn());

    // 2 missiles * 3 split = 6 missiles fired
    const missiles = g.projectiles.filter(p => p.type === 'missile');
    expect(missiles.length).toBe(6);
  });

  it('no relic multipliers when no relics', () => {
    const g = createTestState({
      relics: [],
      levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      player: { ...createTestState().player, aimAngle: 0 },
      projectiles: [],
      enemies: [createTestEnemy(500, 0)],
    });

    updateWeapons(0.016, g, vi.fn());

    const proj = g.projectiles.find(p => p.type === 'autocannon');
    expect(proj).toBeDefined();
    // Base damage: 10 + 1*5 = 15. No relic multiplier.
    expect(proj.damage).toBeCloseTo(15, 1);
  });

  it('stacks multiple relic multipliers', () => {
    const g = createTestState({
      relics: ['berserker_chip', 'plasma_conduit'],
      levels: { autocannon: 0, plasma: 1, missiles: 0, pointDefense: 0, autoAim: 0 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      player: { ...createTestState().player, aimAngle: 0 },
      projectiles: [],
      enemies: [createTestEnemy(500, 0)],
    });

    updateWeapons(0.016, g, vi.fn());

    const proj = g.projectiles.find(p => p.type === 'plasma');
    expect(proj).toBeDefined();
    // Base: 45. berserker: 45 * 1.3 = 58.5. plasma_conduit: 58.5 * 1.25 = 73.125
    expect(proj.damage).toBeCloseTo(73.125, 1);
  });

  // ── Crit chance (Shrapnel relic) ──
  describe('crit chance (Shrapnel relic)', () => {
    it('fires projectile with isCrit=true and boosted damage when Math.random is low', () => {
      // Shrapnel grants 10% crit chance
      const g = createTestState({
        relics: ['shrapnel'],
        levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
        cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
        player: { ...createTestState().player, aimAngle: 0 },
        projectiles: [],
        enemies: [createTestEnemy(500, 0)],
      });

      const C = GAME_CONFIG;
      // Base damage at level 1: 10 + 1*5 = 15. Crit: 15 * 2.0 = 30.
      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      updateWeapons(0.016, g, vi.fn());

      const proj = g.projectiles.find(p => p.type === 'autocannon');
      expect(proj).toBeDefined();
      expect(proj.isCrit).toBe(true);
      expect(proj.damage).toBeCloseTo(15 * C.critMultiplier, 1);
    });

    it('fires projectile without isCrit when no crit relic', () => {
      const g = createTestState({
        relics: [],
        levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
        cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
        player: { ...createTestState().player, aimAngle: 0 },
        projectiles: [],
        enemies: [createTestEnemy(500, 0)],
      });

      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      updateWeapons(0.016, g, vi.fn());

      const proj = g.projectiles.find(p => p.type === 'autocannon');
      expect(proj).toBeDefined();
      expect(proj.isCrit).toBeUndefined();
      expect(proj.damage).toBe(15);
    });

    it('fires projectile without isCrit when Math.random is high', () => {
      const g = createTestState({
        relics: ['shrapnel'],
        levels: { autocannon: 1, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
        cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
        player: { ...createTestState().player, aimAngle: 0 },
        projectiles: [],
        enemies: [createTestEnemy(500, 0)],
      });

      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      updateWeapons(0.016, g, vi.fn());

      const proj = g.projectiles.find(p => p.type === 'autocannon');
      expect(proj).toBeDefined();
      expect(proj.isCrit).toBeUndefined();
      expect(proj.damage).toBe(15);
    });

    it('applies crit to plasma projectiles', () => {
      const g = createTestState({
        relics: ['shrapnel'],
        levels: { autocannon: 0, plasma: 1, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
        cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
        player: { ...createTestState().player, aimAngle: 0 },
        projectiles: [],
        enemies: [createTestEnemy(500, 0)],
      });

      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      updateWeapons(0.016, g, vi.fn());

      const proj = g.projectiles.find(p => p.type === 'plasma');
      expect(proj).toBeDefined();
      expect(proj.isCrit).toBe(true);
      expect(proj.damage).toBeCloseTo(45 * GAME_CONFIG.critMultiplier, 1);
    });

    it('applies crit to missile projectiles', () => {
      const g = createTestState({
        relics: ['shrapnel'],
        levels: { autocannon: 0, plasma: 0, missiles: 1, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
        cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
        player: { ...createTestState().player, aimAngle: 0 },
        projectiles: [],
        enemies: [createTestEnemy(500, 0)],
      });

      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      updateWeapons(0.016, g, vi.fn());

      const proj = g.projectiles.find(p => p.type === 'missile');
      expect(proj).toBeDefined();
      expect(proj.isCrit).toBe(true);
      expect(proj.damage).toBeCloseTo(25 * GAME_CONFIG.critMultiplier, 1);
    });

    it('rolls independent crit per projectile in multishot', () => {
      const g = createTestState({
        relics: ['shrapnel'],
        levels: { autocannon: 3, plasma: 0, missiles: 0, pointDefense: 0, autoAim: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1 },
        cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
        player: { ...createTestState().player, aimAngle: 0 },
        projectiles: [],
        enemies: [createTestEnemy(500, 0)],
      });

      // Level 3 autocannon fires 2 shots. Stub random: first shot crits (0.01), second does not (0.99).
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.01)   // shot 1: crit
        .mockReturnValueOnce(0.99);  // shot 2: no crit
      updateWeapons(0.016, g, vi.fn());

      expect(g.projectiles.length).toBe(2);
      const p1 = g.projectiles[0];
      expect(p1.isCrit).toBe(true);
      expect(p1.damage).toBeCloseTo(25 * GAME_CONFIG.critMultiplier, 1);

      const p2 = g.projectiles[1];
      expect(p2.isCrit).toBeUndefined();
      expect(p2.damage).toBe(25);
    });
  });
});
