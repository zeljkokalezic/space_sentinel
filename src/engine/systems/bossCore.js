/**
 * systems/bossCore.js — Shared boss/mini-boss AI, attacks, phase transitions, and collision.
 * Used by both boss.js and miniboss.js to eliminate ~95% code duplication.
 *
 * Attack patterns are resolved from boss.attackPatterns (set by bossSetup/minibossSetup)
 * via the ATTACK_PATTERNS library in src/constants/attackPatterns.js.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { ATTACK_PATTERNS } from '../../constants/attackPatterns';
import { createParticles, checkShieldBreak, triggerScreenShake, triggerHitStop } from '../combat';
import { SoundManager } from '../audio';
import { triggerFovBossDeath } from './dynamicFov';
import { updateBossSignatureMechanics } from './bossSignatureMechanics';

/**
 * @param {number} dt — Delta time
 * @param {object} boss — Boss entity (g.boss or g.miniboss)
 * @param {object} g — Game state
 * @param {number} currentDiffMult — Difficulty multiplier
 * @param {number} damageMult — Damage scaling multiplier (1 for boss, C.miniboss.damagePercent for miniboss)
 * @param {object} onDeath — { deathColors: [color1, color2], guaranteedDrops: string[]|null, scrapValue: number }
 * @param {function} completeMission — Mission completion callback
 * @param {function} setGameState — React state setter
 * @returns {boolean} — True if game should stop (boss dead or player dead)
 */
export const updateBossCore = (dt, boss, g, currentDiffMult, damageMult, onDeath, completeMission, setGameState) => {
  if (!boss || !boss.active) return false;

  const C = GAME_CONFIG;
  const player = g.player;

  // ── Movement toward player (orbit + approach pattern) ──
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  const speedMult = C.boss.phaseSpeedMult[boss.phase - 1] || 1;
  const moveSpeed = boss.speed * speedMult;

  if (boss.isCharging) {
    // Charge toward target
    const cdx = boss.chargeTarget.x - boss.x;
    const cdy = boss.chargeTarget.y - boss.y;
    const cDist = Math.hypot(cdx, cdy);
    if (cDist > 10) {
      boss.x += (cdx / cDist) * C.boss.chargeSpeed * dt;
      boss.y += (cdy / cDist) * C.boss.chargeSpeed * dt;
    } else {
      boss.isCharging = false;
      boss.chargeTimer = C.boss.chargeCooldown / speedMult;
    }
  } else if (dist > 400) {
    // Approach player
    boss.x += Math.cos(angle) * moveSpeed * dt;
    boss.y += Math.sin(angle) * moveSpeed * dt;
  } else if (dist < 300) {
    // Back away if too close
    boss.x -= Math.cos(angle) * moveSpeed * 0.5 * dt;
    boss.y -= Math.sin(angle) * moveSpeed * 0.5 * dt;
  } else {
    // Orbit at medium distance
    const orbitAngle = angle + Math.PI / 2;
    boss.x += Math.cos(orbitAngle) * moveSpeed * 0.3 * dt;
    boss.y += Math.sin(orbitAngle) * moveSpeed * 0.3 * dt;
  }

  // ── Phase transitions ──
  const hpRatio = boss.hp / boss.maxHp;
  let newPhase = 1;
  if (hpRatio <= 0.33) newPhase = 3;
  else if (hpRatio <= 0.66) newPhase = 2;

  if (newPhase !== boss.phase) {
    boss.phase = newPhase;
    SoundManager.play('boss_phase_change');
    createParticles(g, boss.x, boss.y, 0xfbbf24, 20);
    g.effects.push({
      type: 'phase_change',
      text: `PHASE ${boss.phase}!`,
      life: 1.5,
    });

    // ── Rage mode activation (phase 3) ──
    if (newPhase === 3 && !boss.rage) {
      boss.rage = true;
      boss.rageAuraTimer = 0;
      boss.rageEmberTimer = 0;

      const rageCfg = C.boss.rage;

      // Screen effects
      triggerScreenShake(g, rageCfg.screenShakePreset);
      triggerHitStop(g, rageCfg.hitStopPreset);

      // Particle explosions (rage color + normal)
      createParticles(g, boss.x, boss.y, rageCfg.rageColor, 30);
      createParticles(g, boss.x, boss.y, boss.color || 0xdc2626, 20);

      // "⚠ ENRAGED" popup effect
      g.effects.push({
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
  if (boss.rage) {
    boss.rageAuraTimer += dt;
    boss.rageEmberTimer -= dt;
    if (boss.rageEmberTimer <= 0) {
      boss.rageEmberTimer = C.boss.rage.emberSpawnRate;
      const rageCfg = C.boss.rage;
      for (let i = 0; i < rageCfg.emberCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = rageCfg.emberSpeedMin + Math.random() * (rageCfg.emberSpeedMax - rageCfg.emberSpeedMin);
        g.particles.push({
          x: boss.x + Math.cos(angle) * boss.radius,
          y: boss.y + Math.sin(angle) * boss.radius,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
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
  boss.attackTimer -= dt;
  boss.chargeTimer -= dt;

  const fireMult = C.boss.phaseFireMult[boss.phase - 1] || 1;
  const effectiveCooldown = C.boss.fireCooldown / fireMult;
  const scaledDamage = C.boss.projectileDamage * damageMult;

  if (boss.attackTimer <= 0) {
    boss.attackTimer = effectiveCooldown;

    // Resolve attack pattern from boss variant config
    const patternKey = boss.attackPatterns?.[`phase${boss.phase}`] || 'single_aimed';
    const pattern = ATTACK_PATTERNS[patternKey];
    if (pattern) {
      pattern(g, boss, angle, scaledDamage * currentDiffMult, C.boss.projectileSpeed);
    }
    SoundManager.play('enemy_shoot');
  }

  // ── Charge attacks (phase 2+) ──
  if (boss.phase >= 2 && boss.chargeTimer <= 0 && !boss.isCharging) {
    boss.isCharging = true;
    boss.chargeTarget = { x: player.x, y: player.y };
    // Telegraph: flash effect
    createParticles(g, boss.x, boss.y, 0xfbbf24, 10);
  }

  // ── Boss rams player ──
  const scaledRamDamage = C.boss.ramDamage * damageMult;
  if (dist < boss.radius + player.radius) {
    const dmg = scaledRamDamage * currentDiffMult;
    let hpDamage = dmg;
    const bossRamShieldWasFull = player.shield > 0 && player.maxShield > 0;
    if (player.shield > 0) {
      const absorb = Math.min(player.shield, dmg);
      player.shield -= absorb;
      hpDamage = dmg - absorb;
    }
    player.hp -= hpDamage;
    if (bossRamShieldWasFull && player.shield <= 0) {
      checkShieldBreak(g, player, player.x, player.y);
    }
    if (player.hp <= 0) {
      setGameState('gameover');
      return true;
    }
    // Push boss back
    boss.x -= Math.cos(angle) * 100;
    boss.y -= Math.sin(angle) * 100;
    createParticles(g, player.x, player.y, '#ef4444', 15);
    SoundManager.play('player_hit');
  }

  // ── Boss dies ──
  if (boss.hp <= 0) {
    boss.active = false;
    createParticles(g, boss.x, boss.y, onDeath.deathColors[0], 40);
    createParticles(g, boss.x, boss.y, onDeath.deathColors[1], 30);
    SoundManager.play('explosion');
    triggerFovBossDeath(g);

    // Guaranteed power-up drops
    if (onDeath.guaranteedDrops) {
      for (const dropType of onDeath.guaranteedDrops) {
        const cfg = C.powerups?.types?.[dropType];
        if (cfg) {
          g.powerups.push({
            id: Math.random(),
            x: boss.x + (Math.random() - 0.5) * 40,
            y: boss.y + (Math.random() - 0.5) * 40,
            type: dropType,
            active: true,
            radius: 10,
            color: cfg.color,
          });
        }
      }
    }

    // Scrap reward
    g.pickups.push({
      id: Math.random(),
      x: boss.x,
      y: boss.y,
      value: onDeath.scrapValue,
      active: true,
      radius: 8,
    });

    // Complete mission
    completeMission();
    return true;
  }

  // ── Signature mechanics (void zones, shield regen, phase shift) ──
  updateBossSignatureMechanics(dt, boss, g);

  return false;
};
