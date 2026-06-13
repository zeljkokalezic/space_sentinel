import { GAME_CONFIG } from '../constants/gameConfig';
import type { GameState, LevelState } from './state';

interface SynergyConfig {
  name: string;
  description: string;
  requirements: Record<string, number>;
  [key: string]: unknown;
}

interface ActiveSynergy {
  id: string;
  config: SynergyConfig;
}

/**
 * Determine which synergies are active for the given weapon levels.
 */
export function getActiveSynergies(levels: LevelState): ActiveSynergy[] {
  const synergies = GAME_CONFIG.weaponSynergies as unknown as Record<string, SynergyConfig>;
  const active: ActiveSynergy[] = [];

  for (const [id, config] of Object.entries(synergies)) {
    const req = config.requirements;
    let met = true;
    for (const [weapon, requiredLevel] of Object.entries(req)) {
      if ((levels[weapon as keyof LevelState] ?? 0) < requiredLevel) {
        met = false;
        break;
      }
    }
    if (met) {
      active.push({ id, config });
    }
  }

  return active;
}

/**
 * Apply plasma-specific synergy modifications to a projectile config.
 */
export function applyPlasmaSynergy(
  projectileConfig: Record<string, unknown>,
  activeSynergies: ActiveSynergy[],
): Record<string, unknown> {
  const pen = activeSynergies.find(s => s.id === 'penetration');
  if (pen) {
    projectileConfig.armorPierce = true;
    projectileConfig.color = pen.config.plasmaPierceColor;
    projectileConfig.shieldBypassHits = pen.config.shieldBypassHits;
  }
  return projectileConfig;
}

/**
 * Apply autocannon-specific synergy modifications to a projectile config.
 */
export function applyAutocannonSynergy(
  projectileConfig: Record<string, unknown>,
  activeSynergies: ActiveSynergy[],
): Record<string, unknown> {
  const guided = activeSynergies.find(s => s.id === 'guidedRounds');
  if (guided && Math.random() < (guided.config.chance as number)) {
    projectileConfig.guided = true;
    projectileConfig.steerAngle = guided.config.steerAngle;
  }
  return projectileConfig;
}

/**
 * Apply chain-reaction synergy on missile kill.
 */
export function applyMissileKillSynergy(
  killedEnemy: Record<string, unknown>,
  g: GameState,
  activeSynergies: ActiveSynergy[],
): object[] {
  const chain = activeSynergies.find(s => s.id === 'chainReaction');
  if (!chain) return [];

  const { x, y } = killedEnemy as { x: number; y: number };
  const radius = chain.config.chainRadius as number;

  const targets: object[] = [];
  for (const e of (g.enemies || []) as Array<Record<string, unknown>>) {
    if (!e.active || e === killedEnemy) continue;
    const dist = Math.hypot((e.x as number) - x, (e.y as number) - y);
    if (dist <= radius) {
      targets.push(e);
    }
  }

  return targets;
}

/**
 * Calculate effective point defense max hits with synergy bonuses.
 */
export function applyPointDefenseSynergy(
  baseMaxHits: number,
  activeSynergies: ActiveSynergy[],
): number {
  const pierce = activeSynergies.find(s => s.id === 'piercingDefense');
  if (pierce) {
    return baseMaxHits + (pierce.config.extraHits as number);
  }
  return baseMaxHits;
}
