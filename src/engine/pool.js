/**
 * pool.js - Fixed-capacity object pools for high-churn game entities.
 *
 * Pools expose active arrays on the game state (`g.projectiles`, etc.) so the
 * existing systems can keep iterating active entities without scanning free
 * slots. Cleanup releases inactive objects back to the free stack for reuse.
 */
import { GAME_CONFIG } from '../constants/gameConfig';

const ENTITY_TYPES = ['enemies', 'projectiles', 'particles', 'pickups', 'powerups', 'effects'];

export class ObjectPool {
  constructor(createFn, maxSize) {
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

  get size() {
    return this.pool.length;
  }

  acquire() {
    if (this.freeStack.length === 0) return null;
    const index = this.freeStack.pop();
    const obj = this.pool[index];
    resetObject(obj);
    obj._poolIndex = index;
    obj._poolActive = true;
    obj.active = true;
    obj._poolActiveIndex = this.active.length;
    this.active[this.active.length] = obj;
    return obj;
  }

  spawn(values) {
    const obj = this.acquire();
    if (!obj) return null;
    Object.assign(obj, values);
    if (values.active === undefined) obj.active = true;
    return obj;
  }

  release(obj) {
    if (!obj || obj._poolActive !== true) return;
    const activeIndex = obj._poolActiveIndex;
    const last = this.active[this.active.length - 1];
    if (activeIndex !== this.active.length - 1) {
      this.active[activeIndex] = last;
      last._poolActiveIndex = activeIndex;
    }
    this.active.length -= 1;
    obj.active = false;
    obj._poolActive = false;
    obj._poolActiveIndex = -1;
    this.freeStack[this.freeStack.length] = obj._poolIndex;
  }

  reset() {
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

function resetObject(obj) {
  for (const key of Object.keys(obj)) {
    if (key === '_poolIndex') continue;
    delete obj[key];
  }
}

function makePool(size) {
  return new ObjectPool((index) => ({ _poolIndex: index, active: false }), size);
}

export function createPools(g) {
  const sizes = GAME_CONFIG.pools;
  g.entityPools = {
    enemies: makePool(sizes.enemies),
    projectiles: makePool(sizes.projectiles),
    particles: makePool(sizes.particles),
    pickups: makePool(sizes.pickups),
    powerups: makePool(sizes.powerups),
    effects: makePool(sizes.effects),
  };
  resetEntityPools(g);
  return g.entityPools;
}

export function resetEntityPools(g) {
  if (!g.entityPools) createPools(g);
  for (const type of ENTITY_TYPES) {
    const pool = g.entityPools[type];
    pool.reset();
    g[type] = pool.active;
  }
}

export function spawnPooled(g, type, values) {
  const pool = g?.entityPools?.[type];
  if (pool && g[type] === pool.active) return pool.spawn(values);

  if (!g[type]) g[type] = [];
  const obj = { ...values };
  if (obj.active === undefined) obj.active = true;
  g[type][g[type].length] = obj;
  return obj;
}

export const spawnEnemy = (g, values) => spawnPooled(g, 'enemies', values);
export const spawnProjectileEntity = (g, values) => spawnPooled(g, 'projectiles', values);
export const spawnParticle = (g, values) => spawnPooled(g, 'particles', values);
export const spawnPickup = (g, values) => spawnPooled(g, 'pickups', values);
export const spawnPowerup = (g, values) => spawnPooled(g, 'powerups', values);
export const spawnEffect = (g, values) => spawnPooled(g, 'effects', values);
