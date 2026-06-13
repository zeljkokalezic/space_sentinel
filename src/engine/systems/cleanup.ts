/**
 * systems/cleanup.ts — Dead entity recycling and spatial culling.
 */
import type { GameState } from '../state';

type KeepFn = (e: Record<string, unknown>) => boolean;

export const cleanup = (_dt: number, g: GameState): void => {
  const cullDistSq = 3000 * 3000;
  const px = g.player.x;
  const py = g.player.y;

  cleanupEntities(g, 'enemies', (e: Record<string, unknown>) => !!(e.active && inBounds(e, px, py, cullDistSq)));
  cleanupEntities(g, 'projectiles', (p: Record<string, unknown>) => !!(p.active && inBounds(p, px, py, cullDistSq)));
  cleanupEntities(g, 'particles', (p: Record<string, unknown>) => !!(p.active && (p.life as number) > 0 && inBounds(p, px, py, cullDistSq)));
  cleanupEntities(g, 'pickups', (p: Record<string, unknown>) => !!(p.active && inBounds(p, px, py, cullDistSq)));
  cleanupEntities(g, 'powerups', (p: Record<string, unknown>) => !!(p.active && inBounds(p, px, py, cullDistSq)));
  cleanupEntities(g, 'effects', (e: Record<string, unknown>) => (e.life as number) > 0);

  compactArray(g.spawnFlashes as unknown as Record<string, unknown>[], (f: Record<string, unknown>) => !!f.active);
  compactArray(g.scrapFloats as unknown as Record<string, unknown>[], (f: Record<string, unknown>) => !!f.active);
};

function cleanupEntities(g: GameState, type: string, keep: KeepFn): void {
  const pool = ((g.entityPools as Record<string, { active: Record<string, unknown>[]; release: (e: Record<string, unknown>) => void }> | undefined)?.[type]);
  const arr = (g as Record<string, unknown>)[type] as Record<string, unknown>[] | undefined;
  if (pool && arr === pool.active) recyclePool(pool, keep);
  else compactArray(arr, keep);
}

function inBounds(e: Record<string, unknown>, px: number, py: number, cullDistSq: number): boolean {
  const dx = (e.x as number) - px;
  const dy = (e.y as number) - py;
  return dx * dx + dy * dy < cullDistSq;
}

function recyclePool(pool: { active: Record<string, unknown>[]; release: (e: Record<string, unknown>) => void }, keep: KeepFn): void {
  if (!pool) return;
  for (let i = pool.active.length - 1; i >= 0; i--) {
    const entity = pool.active[i];
    if (!keep(entity)) pool.release(entity);
  }
}

function compactArray(arr: Record<string, unknown>[] | undefined, keep: KeepFn): void {
  if (!arr) return;
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    const item = arr[read];
    if (keep(item)) {
      arr[write] = item;
      write++;
    }
  }
  arr.length = write;
}
