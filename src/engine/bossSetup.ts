/**
 * bossSetup.ts — Boss fight initialization and cleanup.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { BOSS_ROSTER } from '../constants/bosses';
import { createParticles } from './combat';
import { SoundManager } from './audio';
import { spawnEffect } from './pool';
import { createDefaultBoss } from './state';
import type { GameState, BossState } from './state';

interface BossSetupConfig {
  stateKey: string;
  spawnDist: number;
  defaultColor: number;
  hpCalc: (variant: Record<string, unknown>, level: number, C: typeof GAME_CONFIG) => { hp: number; radius: number; speed: number };
}

export const setupBossCore = (g: GameState, level: number, roster: Record<string, unknown>[], config: BossSetupConfig): BossState => {
  const C = GAME_CONFIG;
  const variantIdx = (g as Record<string, unknown>).devVariantIndex != null ? (g as Record<string, unknown>).devVariantIndex as number : level % roster.length;
  const variant = roster[variantIdx];
  const { hp, radius, speed } = config.hpCalc(variant, level, C);
  const angle = Math.random() * Math.PI * 2;

  const state: BossState = {
    id: variant.id as string,
    name: variant.name as string,
    color: variant.color as number,
    innerColor: variant.innerColor as number,
    geometry: variant.geometry as string,
    attackPatterns: variant.attackPatterns,
    deathColors: variant.deathColors as number[],
    guaranteedDrops: variant.guaranteedDrops as string[] | null,
    scrapReward: variant.scrapReward as number,

    active: true,
    x: g.player.x + Math.cos(angle) * config.spawnDist,
    y: g.player.y + Math.sin(angle) * config.spawnDist,
    hp, maxHp: hp, phase: 1, attackTimer: 2,
    chargeTimer: C.boss.chargeCooldown,
    chargeTarget: { x: 0, y: 0 }, isCharging: false,
    radius, speed, fireCooldown: C.boss.fireCooldown,
    spiralAngle: 0, shield: 0, maxShield: 0,
    rage: false, rageAuraTimer: 0, rageEmberTimer: 0,
    voidZones: [], regenTimer: 0, regenActive: false,
    phaseShiftTimer: 0, decoy: null,
  };

  (g as Record<string, unknown>)[config.stateKey] = { ...(g as Record<string, unknown>)[config.stateKey] as Record<string, unknown>, ...state };
  g.spawnCooldown = 999;

  spawnEffect(g, { type: 'boss_intro', text: variant.introText, life: 2.5, big: false } as Record<string, unknown>);
  spawnEffect(g, { type: 'boss_intro', text: variant.name, life: 2.5, big: true } as Record<string, unknown>);
  createParticles(g, state.x, state.y, (variant.color as number) || config.defaultColor, 30);
  SoundManager.play('boss_spawn');
  SoundManager.play('boss_intro');

  return (g as Record<string, unknown>)[config.stateKey] as BossState;
};

export const setupBoss = (g: GameState, level: number): void => {
  setupBossCore(g, level, BOSS_ROSTER as unknown as Record<string, unknown>[], {
    stateKey: 'boss',
    spawnDist: GAME_CONFIG.boss.spawnDistance,
    defaultColor: 0xdc2626,
    hpCalc: (variant, lvl) => {
      return {
        hp: (variant.baseHp as number) + lvl * (variant.hpPerLevel as number),
        radius: variant.radius as number,
        speed: (variant.speed as number) + lvl * (variant.speedPerLevel as number),
      };
    },
  });
};

export const resetBoss = (g: GameState): void => {
  g.boss = createDefaultBoss();
};

export type { BossSetupConfig };
