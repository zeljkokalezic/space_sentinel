/**
 * systems/bossCore.ts — Shared boss/mini-boss AI, attacks, phase transitions, and collision.
 * Used by both boss.js and miniboss.js to eliminate ~95% code duplication.
 *
 * Attack patterns are resolved from boss.attackPatterns (set by bossSetup/minibossSetup)
 * via the ATTACK_PATTERNS library in src/constants/attackPatterns.ts.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { ATTACK_PATTERNS } from '../../constants/attackPatterns';
import { createParticles, applyDamageWithShield, triggerScreenShake, triggerHitStop, triggerPlayerIFrames, spawnDamageNumber } from '../combat';
import { SoundManager } from '../audio';
import { triggerFovBossDeath } from './dynamicFov';
import { updateBossSignatureMechanics, checkVoidZoneCollision } from './bossSignatureMechanics';
import { tryAddRelic, getRandomRelic } from '../relicSystem';
import { spawnEffect, spawnParticle, spawnPickup, spawnPowerup } from '../pool';
import type { GameState, BossState } from '../state';
import type { RelicRarity } from '../../constants/relics';

type AttackPatternFn = (g: GameState, boss: BossState, angle: number, damage: number, speed: number) => void;

interface OnDeathConfig {
  deathColors: readonly [number, number];
  guaranteedDrops: readonly string[] | null;
  scrapValue: number;
  relicRarity?: RelicRarity;
}

/** Boss runtime state with the variant-supplied attackPatterns lookup. */
type Boss = BossState & {
  attackPatterns?: Record<string, string>;
};

/**
 * @param dt — Delta time
 * @param boss — Boss entity (g.boss or g.miniboss)
 * @param g — Game state
 * @param currentDiffMult — Difficulty multiplier
 * @param damageMult — Damage scaling multiplier (1 for boss, C.miniboss.damagePercent for miniboss)
 * @param onDeath — { deathColors: [color1, color2], guaranteedDrops: string[]|null, scrapValue: number }
 * @param completeMission — Mission completion callback
 * @param setGameState — React state setter
 * @returns True if game should stop (boss dead or player dead)
 */
export const updateBossCore = (
  dt: number,
  boss: BossState,
  g: GameState,
  currentDiffMult: number,
  damageMult: number,
  onDeath: OnDeathConfig,
  completeMission: () => void,
  setGameState: (state: string) => void,
): boolean => {
  if (!boss || !boss.active) return false;

  const b = boss as Boss;
  const C = GAME_CONFIG;
  const player = g.player;

  // ── Movement toward player (orbit + approach pattern) ──
  const dx = player.x - b.x;
  const dy = player.y - b.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  const speedMult = C.boss.phaseSpeedMult[b.phase - 1] || 1;
  const moveSpeed = b.speed * speedMult;

  if (b.isCharging) {
    // Charge toward target
    const cdx = b.chargeTarget.x - b.x;
    const cdy = b.chargeTarget.y - b.y;
    const cDist = Math.hypot(cdx, cdy);
    if (cDist > C.boss.chargeArrivalThreshold) {
      b.x += (cdx / cDist) * C.boss.chargeSpeed * dt;
      b.y += (cdy / cDist) * C.boss.chargeSpeed * dt;
    } else {
      b.isCharging = false;
      b.chargeTimer = C.boss.chargeCooldown / speedMult;
    }
  } else if (dist > C.boss.orbitOuterRadius) {
    // Approach player
    b.x += Math.cos(angle) * moveSpeed * dt;
    b.y += Math.sin(angle) * moveSpeed * dt;
  } else if (dist < C.boss.orbitInnerRadius) {
    // Back away if too close
    b.x -= Math.cos(angle) * moveSpeed * 0.5 * dt;
    b.y -= Math.sin(angle) * moveSpeed * 0.5 * dt;
  } else {
    // Orbit at medium distance
    const orbitAngle = angle + Math.PI / 2;
    b.x += Math.cos(orbitAngle) * moveSpeed * 0.3 * dt;
    b.y += Math.sin(orbitAngle) * moveSpeed * 0.3 * dt;
  }

  // ── Phase transitions ──
  const hpRatio = b.hp / b.maxHp;
  let newPhase = 1;
  if (hpRatio <= 0.33) newPhase = 3;
  else if (hpRatio <= 0.66) newPhase = 2;

  if (newPhase !== b.phase) {
    b.phase = newPhase;
    SoundManager.play('boss_phase_change');
    createParticles(g, b.x, b.y, 0xfbbf24, 20);
    spawnEffect(g, {
      type: 'phase_change',
      text: `PHASE ${b.phase}!`,
      life: 1.5,
    });

    // ── Rage mode activation (phase 3) ──
    if (newPhase === 3 && !b.rage) {
      b.rage = true;
      b.rageAuraTimer = 0;
      b.rageEmberTimer = 0;

      const rageCfg = C.boss.rage;

      // Screen effects
      triggerScreenShake(g, rageCfg.screenShakePreset);
      triggerHitStop(g, rageCfg.hitStopPreset);

      // Particle explosions (rage color + normal)
      createParticles(g, b.x, b.y, rageCfg.rageColor, 30);
      createParticles(g, b.x, b.y, b.color || 0xdc2626, 20);

      // "⚠ ENRAGED" popup effect
      spawnEffect(g, {
        type: 'enraged',
        text: '⚠ ENRAGED',
        life: rageCfg.enragedPopupLife,
        color: '#ff3333',
      });

      // Audio cue
      SoundManager.play('boss_rage');
    }
  }

  // ── Rage ember emission (continuous while enraged) ──
  if (b.rage) {
    b.rageAuraTimer += dt;
    b.rageEmberTimer -= dt;
    if (b.rageEmberTimer <= 0) {
      b.rageEmberTimer = C.boss.rage.emberSpawnRate;
      const rageCfg = C.boss.rage;
      for (let i = 0; i < rageCfg.emberCount; i++) {
        const emberAngle = Math.random() * Math.PI * 2;
        const speed = rageCfg.emberSpeedMin + Math.random() * (rageCfg.emberSpeedMax - rageCfg.emberSpeedMin);
        spawnParticle(g, {
          x: b.x + Math.cos(emberAngle) * b.radius,
          y: b.y + Math.sin(emberAngle) * b.radius,
          vx: Math.cos(emberAngle) * speed,
          vy: Math.sin(emberAngle) * speed,
          life: rageCfg.emberLife,
          maxLife: rageCfg.emberLife,
          color: rageCfg.emberColor,
          size: 2 + Math.random() * 2,
          active: true,
          type: 'ember',
        });
      }
    }
  }

  // ── Attacks ──
  b.attackTimer -= dt;
  b.chargeTimer -= dt;

  const fireMult = C.boss.phaseFireMult[b.phase - 1] || 1;
  const effectiveCooldown = C.boss.fireCooldown / fireMult;
  const scaledDamage = C.boss.projectileDamage * damageMult;

  if (b.attackTimer <= 0) {
    b.attackTimer = effectiveCooldown;

    // Resolve attack pattern from boss variant config
    const patternKey = b.attackPatterns?.[`phase${b.phase}`] || 'single_aimed';
    const pattern = (ATTACK_PATTERNS as Record<string, AttackPatternFn>)[patternKey];
    if (pattern) {
      pattern(g, boss, angle, scaledDamage * currentDiffMult, C.boss.projectileSpeed);
    }
    SoundManager.play('enemy_shoot');
  }

  // ── Charge attacks (phase 2+) ──
  if (b.phase >= 2 && b.chargeTimer <= 0 && !b.isCharging) {
    b.isCharging = true;
    b.chargeTarget = { x: player.x, y: player.y };
    // Telegraph: flash effect
    createParticles(g, b.x, b.y, 0xfbbf24, 10);
  }

  // ── Boss rams player ──
  const scaledRamDamage = C.boss.ramDamage * damageMult;
  if (dist < b.radius + player.radius && !(g.playerIFrames && g.playerIFrames.isInvincible)) {
    const { actualDmg: playerDmg, shieldAbsorbed: playerShieldDmg } = applyDamageWithShield(g, player, scaledRamDamage * currentDiffMult, player.x, player.y);
    triggerScreenShake(g, 'playerHit');
    triggerHitStop(g, 'playerHit');
    triggerPlayerIFrames(g);
    spawnDamageNumber(g, player.x, player.y - 10, playerDmg, { hitType: 'playerHit', shieldDamage: playerShieldDmg });
    if (player.hp <= 0) {
      setGameState('gameover');
      return true;
    }
    // Push boss back
    b.x -= Math.cos(angle) * 100;
    b.y -= Math.sin(angle) * 100;
    createParticles(g, player.x, player.y, '#ef4444' as unknown as number, 15);
    SoundManager.play('player_hit');
  }

  // ── Boss dies ──
  if (b.hp <= 0) {
    b.active = false;
    createParticles(g, b.x, b.y, onDeath.deathColors[0], 40);
    createParticles(g, b.x, b.y, onDeath.deathColors[1], 30);
    SoundManager.play('explosion');
    triggerFovBossDeath(g);

    // Guaranteed power-up drops
    if (onDeath.guaranteedDrops) {
      for (const dropType of onDeath.guaranteedDrops) {
        const cfg = (C.powerups?.types as Record<string, { color: string | number }>)?.[dropType];
        if (cfg) {
          spawnPowerup(g, {
            id: Math.random(),
            x: b.x + (Math.random() - 0.5) * 40,
            y: b.y + (Math.random() - 0.5) * 40,
            type: dropType,
            active: true,
            radius: 10,
            color: cfg.color,
          });
        }
      }
    }

    // Scrap reward
    spawnPickup(g, {
      id: Math.random(),
      x: b.x,
      y: b.y,
      value: onDeath.scrapValue,
      active: true,
      radius: 8,
    });

    // Boss relic drop (default: uncommon; miniboss overrides to common)
    const relicRarity = onDeath.relicRarity || 'uncommon';
    const bossRelic = getRandomRelic(relicRarity);
    if (bossRelic) {
      tryAddRelic(g, bossRelic.id);
    }

    // Complete mission
    completeMission();
    return true;
  }

  // ── Signature mechanics (void zones, shield regen, phase shift) ──
  updateBossSignatureMechanics(dt, boss, g);
  checkVoidZoneCollision(g);

  return false;
};
