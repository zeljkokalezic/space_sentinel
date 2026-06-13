/**
 * targeting.ts — Shared hostile target selection.
 */
import type { GameState } from './state';

export interface TargetResult {
  x: number;
  y: number;
}

export interface HostileTarget {
  x: number;
  y: number;
  active: boolean;
  hp: number;
  kind: string;
  ref: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Get the enemy target position (escort drone if active, otherwise player).
 */
export const getEnemyTarget = (g: GameState): TargetResult => {
  if (g.escort?.active) return { x: g.escort.x, y: g.escort.y };
  return { x: g.player.x, y: g.player.y };
};

export const getTargetPosition = (target: { x: number; y: number } | null | undefined): TargetResult | null => {
  if (!target) return null;
  return { x: target.x, y: target.y };
};

export const isTargetActive = (target: Record<string, unknown> | null | undefined): boolean => {
  if (!target) return false;
  if (target.kind === 'structure') return !!(target.active && (target.hp as number) > 0);
  if (target.active !== undefined) return !!(target.active && (target.hp as number) > 0);
  return (target.hp as number) > 0;
};

export const getHostileTargets = (g: GameState): HostileTarget[] => {
  const targets: HostileTarget[] = [];
  for (const e of (g.enemies || []) as Array<Record<string, unknown>>) {
    if (e.active && (e.hp as number) > 0) targets.push({ ...e, kind: 'enemy', ref: e } as unknown as HostileTarget);
  }
  if (g.boss?.active && g.boss.hp > 0) {
    targets.push({ ...g.boss, kind: 'boss', ref: g.boss } as unknown as HostileTarget);
  }
  if (g.miniboss?.active && g.miniboss.hp > 0) {
    targets.push({ ...g.miniboss, kind: 'miniboss', ref: g.miniboss } as unknown as HostileTarget);
  }
  if (g.sabotage?.active) {
    for (const s of (g.sabotage.structures || []) as Array<Record<string, unknown>>) {
      if (s.active && (s.hp as number) > 0) targets.push({ ...s, kind: 'structure', ref: s } as unknown as HostileTarget);
    }
  }
  return targets;
};

export const getNearestHostileTarget = (x: number, y: number, g: GameState): Record<string, unknown> | null => {
  let nearest: Record<string, unknown> | null = null;
  let minDist = Infinity;
  for (const target of getHostileTargets(g)) {
    const dist = Math.hypot(target.x - x, target.y - y);
    if (dist < minDist) {
      minDist = dist;
      nearest = target.ref;
    }
  }
  return nearest;
};
