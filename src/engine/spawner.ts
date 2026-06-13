/**
 * spawner.ts — Enemy and mission generation.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { BOSS_ROSTER, MINIBOSS_ROSTER } from '../constants/bosses';
import { calculateDifficultyMultiplier } from './difficulty';
import { SoundManager } from './audio';
import { spawnEnemy as spawnEnemyEntity, spawnParticle } from './pool';
import type { GameState, MissionState, WaveAnnounceState } from './state';

let _enemyIdCounter = 0;
let _spawnFlashIdCounter = 0;

export const WAVE_PATTERNS: Record<string, { count: number; interval: number; formation?: string; enemyType?: string }> = {
  random: { count: 1, interval: 1.0 },
  burst: { count: 3, interval: 3.0 },
  circle: { count: 5, interval: 4.0, formation: 'circle' },
  vFormation: { count: 4, interval: 3.5, formation: 'v' },
  swarm: { count: 6, interval: 5.0, enemyType: 'interceptor' },
};

export const WAVE_TO_FORMATION: Record<string, string[]> = {
  random:     ['kamikaze', 'vanguard'],
  burst:      ['vanguard'],
  circle:     ['orbit'],
  vFormation: ['bomber'],
  swarm:      ['swarm'],
};

function getWavePattern(level: number, totalTime: number): string {
  if (totalTime < 30) return 'random';
  if (totalTime < 90) {
    const patterns = ['random', 'burst', 'circle'];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }
  const patterns = ['random', 'burst', 'circle', 'vFormation', 'swarm'];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

function getAvailableFormations(level: number): string[] {
  const C = GAME_CONFIG;
  return Object.entries(C.formationLevels)
    .filter(([, minLevel]) => level >= (minLevel as number))
    .map(([name]) => name);
}

function pickFormation(pattern: string, level: number): string {
  const candidates = WAVE_TO_FORMATION[pattern] || WAVE_TO_FORMATION.random;
  const available = getAvailableFormations(level);
  const valid = candidates.filter(c => available.includes(c));
  if (valid.length > 0) {
    return valid[Math.floor(Math.random() * valid.length)];
  }
  return 'kamikaze';
}

function spawnWavePattern(g: GameState, pattern: string, level: number): void {
  const waveConfig = WAVE_PATTERNS[pattern] || WAVE_PATTERNS.random;
  const C = GAME_CONFIG;
  const diffMult = calculateDifficultyMultiplier(g.level, g.totalTime);
  const formation = pickFormation(pattern, level);

  for (let i = 0; i < waveConfig.count; i++) {
    let x: number, y: number;

    if (waveConfig.formation === 'circle') {
      const angle = (i / waveConfig.count) * Math.PI * 2;
      const radius = C.enemies.spawnRadiusMin + (C.enemies.spawnRadiusMax - C.enemies.spawnRadiusMin) / 2;
      x = g.player.x + Math.cos(angle) * radius;
      y = g.player.y + Math.sin(angle) * radius;
    } else if (waveConfig.formation === 'v') {
      const baseAngle = Math.random() * Math.PI * 2;
      const spread = 0.3;
      const angle = baseAngle + (i - waveConfig.count / 2) * spread;
      const radius = C.enemies.spawnRadiusMin + i * 30;
      x = g.player.x + Math.cos(angle) * radius;
      y = g.player.y + Math.sin(angle) * radius;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = C.enemies.spawnRadiusMin + Math.random() * (C.enemies.spawnRadiusMax - C.enemies.spawnRadiusMin);
      x = g.player.x + Math.cos(angle) * spawnRadius;
      y = g.player.y + Math.sin(angle) * spawnRadius;
    }

    const eliteBonus = Math.min(C.enemies.eliteBonusMax, g.level * C.enemies.eliteBonusBase + g.totalTime * C.enemies.eliteBonusTimeFactor);
    const typeRoll = Math.random() + eliteBonus;

    let type: string, hp: number, speed: number, radius: number, color: number, shield: number, maxShield: number, fireCooldown: number;

    if (waveConfig.enemyType) {
      type = waveConfig.enemyType;
      hp = 15 * diffMult;
      speed = 180 + Math.random() * 50;
      radius = 12;
      color = 0xeab308;
      shield = 0;
      maxShield = 0;
      fireCooldown = 0;
    } else if (typeRoll > 0.95) {
      type = 'missile_boat'; hp = 60 * diffMult; speed = 30 + Math.random() * 20;  radius = 22; color = 0xd946ef; fireCooldown = 3.0; shield = 0; maxShield = 0;
    } else if (typeRoll > 0.85) {
      type = 'shielded';     hp = 40 * diffMult; speed = 50 + Math.random() * 30;  radius = 18; color = 0x3b82f6; maxShield = 80 * diffMult; shield = maxShield; fireCooldown = 0;
    } else if (typeRoll > 0.70) {
      type = 'shooter';      hp = 40 * diffMult; speed = 70 + Math.random() * 30;  radius = 16; color = 0xa855f7; fireCooldown = 1.5; shield = 0; maxShield = 0;
    } else if (typeRoll > 0.60) {
      type = 'heavy';        hp = 100 * diffMult; speed = 40 + Math.random() * 30; radius = 25; color = 0xf97316; fireCooldown = 4.0; shield = 0; maxShield = 0;
    } else if (typeRoll > 0.40) {
      type = 'interceptor';  hp = 15 * diffMult; speed = 180 + Math.random() * 50; radius = 12; color = 0xeab308; fireCooldown = 5.0; shield = 0; maxShield = 0;
    } else {
      type = 'fighter';      hp = 30 * diffMult; speed = 100 + Math.random() * 50; radius = 15; color = 0xef4444; fireCooldown = 6.0; shield = 0; maxShield = 0;
    }

    const eligibleTypes = ['shooter', 'heavy', 'interceptor', 'missile_boat'];
    const variantMap: Record<string, string> = {
      shooter: 'sniper',
      heavy: 'tank',
      interceptor: 'swarmLeader',
      missile_boat: 'arsenal',
    };
    let eliteVariant: string | null = null;
    if (eligibleTypes.includes(type)) {
      const variantChance = Math.min(0.2, 0.03 + g.level * 0.005 + g.totalTime * 0.0001);
      if (Math.random() < variantChance) {
        eliteVariant = variantMap[type];
        const ev = (C.eliteVariants as Record<string, Record<string, unknown>>)?.[eliteVariant];
        if (ev) {
          hp = hp * (ev.hpMult as number);
          color = ev.color as number;
        }
      }
    }

    const enemyObj: Record<string, unknown> = {
      id: ++_enemyIdCounter,
      x, y, hp, maxHp: hp, shield, maxShield, speed, radius, color, type,
      active: true,
      fireCooldown,
      formation,
      formationPhase: 'approach',
      formationTimer: (C.formations as Record<string, Record<string, unknown>>)[formation]?.convergeDelay ?? 0,
      orbitAngle: Math.random() * Math.PI * 2,
      formationIndex: i,
    };

    if (eliteVariant) {
      enemyObj.eliteVariant = eliteVariant;
      const ev = (C.eliteVariants as Record<string, Record<string, unknown>>)?.[eliteVariant];
      if (ev) {
        if (eliteVariant === 'tank') {
          enemyObj.directionalShields = Array(ev.directionalShieldSides as number).fill(ev.shieldHpPerSide);
          enemyObj.fireCooldown = ev.cooldownMin;
        }
        if (eliteVariant === 'sniper') {
          enemyObj.fireCooldown = ev.cooldownMin;
        }
        if (eliteVariant === 'arsenal') {
          enemyObj.fireCooldown = ev.cooldownMin;
        }
        if (eliteVariant === 'swarmLeader') {
          enemyObj.fireCooldown = (C.enemyWeapons as Record<string, Record<string, unknown>>).interceptor.cooldownMin;
        }
      }
    }

    spawnEnemyEntity(g, enemyObj);
    createSpawnFlash(g, x, y);
  }
}

export function spawnEnemy(g: GameState): void {
  if (g.waveAnnounce?.active) return;

  const pattern = getWavePattern(g.level, g.totalTime);
  const formation = pickFormation(pattern, g.level);
  spawnWavePattern(g, pattern, g.level);

  if (g.waveAnnounce) {
    const waveConfig = WAVE_PATTERNS[pattern] || WAVE_PATTERNS.random;
    g.enemiesSpawnedThisWave += waveConfig.count;

    const enemiesPerWave = GAME_CONFIG.waveAnnouncer.enemiesPerWave;
    if (g.enemiesSpawnedThisWave >= enemiesPerWave) {
      g.waveCount++;
      g.enemiesSpawnedThisWave = 0;

      if (g.waveCount > 1) {
        g.waveAnnounce.active = true;
        g.waveAnnounce.wave = g.waveCount;
        g.waveAnnounce.timer = GAME_CONFIG.waveAnnouncer.announcementDuration;
        (g.waveAnnounce as WaveAnnounceState).formationName = formation.toUpperCase().replace('_', ' ');
        SoundManager.play('wave_announce');
      }
    }
  }

  if (g.gauntlet?.active && !g.gauntlet.betweenWaves) {
    const waveConfig = WAVE_PATTERNS[pattern] || WAVE_PATTERNS.random;
    g.gauntlet.enemiesSpawnedInWave += waveConfig.count;
  }
}

export function spawnMiniInterceptors(g: GameState, x: number, y: number, count: number): void {
  const C = GAME_CONFIG;
  const ev = (C.eliteVariants as Record<string, Record<string, unknown>>)?.swarmLeader;
  if (!ev) return;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const spread = 30 + Math.random() * 20;
    spawnEnemyEntity(g, {
      id: ++_enemyIdCounter,
      x: x + Math.cos(angle) * spread,
      y: y + Math.sin(angle) * spread,
      hp: ev.miniInterceptorHp as number,
      maxHp: ev.miniInterceptorHp as number,
      shield: 0,
      maxShield: 0,
      speed: ev.miniInterceptorSpeed as number,
      radius: 8,
      color: ev.color as number,
      type: 'mini_interceptor',
      active: true,
      fireCooldown: 0,
      formation: 'kamikaze',
      formationPhase: 'engage',
      formationTimer: 0,
      orbitAngle: Math.random() * Math.PI * 2,
      formationIndex: i,
    });
    createSpawnFlash(g, x + Math.cos(angle) * spread, y + Math.sin(angle) * spread);
  }
}

export function createSpawnFlash(g: GameState, x: number, y: number): void {
  if (!g) return;
  const C = GAME_CONFIG.enemySpawnFlash;
  if (!C?.enabled) return;

  if (!g.spawnFlashes) g.spawnFlashes = [];
  if (g.spawnFlashes.length >= C.maxFlashes) {
    g.spawnFlashes.shift();
  }

  g.spawnFlashes.push({
    id: ++_spawnFlashIdCounter,
    x, y,
    radius: 0,
    maxRadius: C.maxRadius,
    life: C.duration,
    maxLife: C.duration,
    color: C.ringColor,
    active: true,
  });

  SoundManager.play('enemy_spawn');

  if (g.particles && C.particleCount > 0) {
    for (let i = 0; i < C.particleCount; i++) {
      const angle = (i / C.particleCount) * Math.PI * 2;
      const speed = 60 + Math.random() * 40;
      spawnParticle(g, {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 0,
        life: C.duration * 0.7,
        maxLife: C.duration * 0.7,
        color: C.particleColor,
        active: true,
        type: 'spark',
        size: 2,
      });
    }
  }
}

export function updateSpawnFlashes(dt: number, g: GameState): void {
  if (!g?.spawnFlashes) return;

  for (const flash of g.spawnFlashes) {
    if (!flash.active) continue;

    flash.life -= dt;
    if (flash.life <= 0) {
      flash.life = 0;
      flash.active = false;
      continue;
    }

    const maxLife = flash.maxLife || flash.life;
    const progress = 1 - (flash.life / maxLife);
    flash.radius = Math.min(flash.maxRadius, flash.maxRadius * progress);
  }
}

export const generateMission = (level: number, nodeType: string): MissionState => {
  let t = 'kill';
  let target: number, title: string, reward: number;

  if (nodeType === 'boss') {
    const variant = BOSS_ROSTER[level % BOSS_ROSTER.length];
    t = 'kill_boss';
    target = 1;
    title = variant.title;
    reward = variant.scrapReward;
    return { type: t, target, current: 0, title, reward, nodeType };
  }

  if (nodeType === 'miniboss') {
    const variant = MINIBOSS_ROSTER[level % MINIBOSS_ROSTER.length];
    t = 'kill_miniboss';
    target = 1;
    title = variant.title;
    reward = variant.scrapReward + level * 20;
    return { type: t, target, current: 0, title, reward, nodeType };
  }

  if (nodeType === 'elite') {
    t = 'kill_elite';
    target = 3 + Math.floor(level / 3);
    title = `Destroy ${target} Elite Enemies`;
    reward = 100 + level * 30;
    return { type: t, target, current: 0, title, reward, nodeType };
  }

  if (nodeType === 'gauntlet') {
    t = 'gauntlet';
    const waves = GAME_CONFIG.gauntlet?.totalWaves ?? 3;
    target = waves;
    title = `Survive ${waves} Waves`;
    reward = 150 + level * 40;
    return { type: t, target, current: 0, title, reward, nodeType };
  }

  if (nodeType === 'wave_surge') {
    t = 'wave_surge';
    target = GAME_CONFIG.waveSurge?.duration ?? 15;
    title = `Wave Surge — Survive ${target}s`;
    reward = 120 + level * 35;
    return { type: t, target, current: 0, title, reward, nodeType };
  }

  if (['kill', 'collect', 'survive', 'escort', 'defend', 'sabotage'].includes(nodeType)) {
    t = nodeType;
  } else {
    const types = ['kill', 'survive', 'collect', 'escort', 'defend', 'sabotage'];
    t = types[Math.floor(Math.random() * types.length)];
    if (level === 1) t = 'kill';
    if (level === 2) t = 'collect';
  }

  if (t === 'kill') {
    target = 10 + level * 5;
    title = `Destroy ${target} Enemies`;
    reward = 50 + level * 20;
  } else if (t === 'collect') {
    target = 15 + level * 3;
    title = `Collect ${target} Scrap`;
    reward = 80 + level * 25;
  } else if (t === 'survive') {
    target = 20 + level * 10;
    title = `Survive for ${target} Seconds`;
    reward = 80 + level * 15;
  } else if (t === 'defend') {
    target = 30 + level * 10;
    title = `Defend the Beacon for ${target} Seconds`;
    reward = 100 + level * 30;
    return { type: t, target, current: 0, title, reward, nodeType };
  } else if (t === 'sabotage') {
    const cfg = GAME_CONFIG.sabotage;
    target = Math.min(cfg.maxStructures, cfg.baseStructures + Math.floor(level / 2) * cfg.structuresPer2Levels);
    title = `Destroy ${target} Enemy Structures`;
    reward = 120 + level * 35;
    return { type: t, target, current: 0, title, reward, nodeType };
  } else {
    title = 'Escort the Drone to Safety';
    reward = 120 + level * 35;
    target = 0;
    return { type: t, target, current: 0, title, reward, nodeType };
  }

  return { type: t, target: target!, current: 0, title: title!, reward: reward!, nodeType };
};

export { getWavePattern, pickFormation, getAvailableFormations, spawnWavePattern };
