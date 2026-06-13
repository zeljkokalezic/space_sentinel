/**
 * pool.ts — Fixed-capacity object pools for high-churn game entities.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import type { GameState } from './state';

const ENTITY_TYPES = ['enemies', 'projectiles', 'particles', 'pickups', 'powerups', 'effects'] as const;

let _nextEntityId = 0;

function nextEntityId(): number {
  return ++_nextEntityId;
}

export class ObjectPool {
  pool: Record<string, unknown>[];
  freeStack: number[];
  active: Record<string, unknown>[];

  constructor(createFn: (index: number) => Record<string, unknown>, maxSize: number) {
    this.pool = new Array(maxSize);
    this.freeStack = new Array(maxSize);
    this.active = [];

    for (let i = 0; i < maxSize; i++) {
      const obj = createFn(i);
      obj._poolIndex = i;
      obj._poolActive = false;
      this.pool[i] = obj;
      this.freeStack[i] = maxSize - 1 - i;
    }
  }

  get size(): number {
    return this.pool.length;
  }

  acquire(): Record<string, unknown> | null {
    if (this.freeStack.length === 0) return null;
    const index = this.freeStack.pop()!;
    const obj = this.pool[index];
    resetObject(obj);
    obj._poolIndex = index;
    obj._poolActive = true;
    obj.active = true;
    obj._poolActiveIndex = this.active.length;
    this.active[this.active.length] = obj;
    return obj;
  }

  spawn(values: Record<string, unknown>): Record<string, unknown> | null {
    const obj = this.acquire();
    if (!obj) return null;
    Object.assign(obj, values);
    if (values.id === undefined) obj.id = nextEntityId();
    if (values.active === undefined) obj.active = true;
    return obj;
  }

  release(obj: Record<string, unknown> | null | undefined): void {
    if (!obj || obj._poolActive !== true) return;
    const activeIndex = obj._poolActiveIndex as number;
    const last = this.active[this.active.length - 1];
    if (activeIndex !== this.active.length - 1) {
      this.active[activeIndex] = last;
      last._poolActiveIndex = activeIndex;
    }
    this.active.length -= 1;
    obj.active = false;
    obj._poolActive = false;
    obj._poolActiveIndex = -1;
    this.freeStack[this.freeStack.length] = obj._poolIndex as number;
  }

  reset(): void {
    this.active.length = 0;
    this.freeStack.length = 0;
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const obj = this.pool[i];
      obj.active = false;
      obj._poolActive = false;
      obj._poolActiveIndex = -1;
      this.freeStack[this.freeStack.length] = i;
    }
  }
}

function resetObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (key === '_poolIndex') continue;
    delete obj[key];
  }
}

function makePool(size: number): ObjectPool {
  return new ObjectPool((index: number) => ({ _poolIndex: index, active: false }), size);
}

export function createPools(g: GameState): Record<string, ObjectPool> {
  const sizes = GAME_CONFIG.pools;
  const pools = {
    enemies: makePool(sizes.enemies),
    projectiles: makePool(sizes.projectiles),
    particles: makePool(sizes.particles),
    pickups: makePool(sizes.pickups),
    powerups: makePool(sizes.powerups),
    effects: makePool(sizes.effects),
  };
  (g as Record<string, unknown>).entityPools = pools;
  resetEntityPools(g);
  return pools;
}

export function resetEntityPools(g: GameState): void {
  if (!g.entityPools) createPools(g);
  for (const type of ENTITY_TYPES) {
    const pool = (g.entityPools as Record<string, ObjectPool>)[type];
    pool.reset();
    (g as Record<string, unknown>)[type] = pool.active;
  }
}

export function spawnPooled(g: GameState, type: string, values: Record<string, unknown>): Record<string, unknown> | null {
  const pools = g.entityPools as Record<string, ObjectPool> | undefined;
  const pool = pools?.[type];
  if (pool && (g as Record<string, unknown>)[type] === pool.active) return pool.spawn(values);

  const arr = (g as Record<string, unknown>)[type] as Record<string, unknown>[] | undefined;
  if (!arr) (g as Record<string, unknown>)[type] = [];
  const obj: Record<string, unknown> = { ...values };
  if (obj.id === undefined) obj.id = nextEntityId();
  if (obj.active === undefined) obj.active = true;
  ((g as Record<string, unknown>)[type] as Record<string, unknown>[]).push(obj);
  return obj;
}

export const spawnEnemy = (g: GameState, values: Record<string, unknown>): Record<string, unknown> | null => spawnPooled(g, 'enemies', values);
export const spawnProjectileEntity = (g: GameState, values: Record<string, unknown>): Record<string, unknown> | null => spawnPooled(g, 'projectiles', values);
export const spawnParticle = (g: GameState, values: Record<string, unknown>): Record<string, unknown> | null => spawnPooled(g, 'particles', values);
export const spawnPickup = (g: GameState, values: Record<string, unknown>): Record<string, unknown> | null => spawnPooled(g, 'pickups', values);
export const spawnPowerup = (g: GameState, values: Record<string, unknown>): Record<string, unknown> | null => spawnPooled(g, 'powerups', values);
export const spawnEffect = (g: GameState, values: Record<string, unknown>): Record<string, unknown> | null => spawnPooled(g, 'effects', values);
