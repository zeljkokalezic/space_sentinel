import { describe, it, expect } from 'vitest';
import { createGameState } from '../engine/state';
import { ObjectPool, resetEntityPools, spawnParticle, spawnProjectileEntity } from '../engine/pool';

describe('ObjectPool', () => {
  it('acquires and releases objects without growing beyond capacity', () => {
    const pool = new ObjectPool((index) => ({ _poolIndex: index }), 2);

    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();

    expect(a.active).toBe(true);
    expect(b.active).toBe(true);
    expect(c).toBeNull();
    expect(pool.active).toHaveLength(2);

    pool.release(a);

    expect(a.active).toBe(false);
    expect(pool.active).toHaveLength(1);
    expect(pool.acquire()).toBe(a);
  });

  it('clears stale fields when reusing an object', () => {
    const pool = new ObjectPool((index) => ({ _poolIndex: index }), 1);
    const first = pool.spawn({ active: true, x: 10, stale: 'old' });
    pool.release(first);

    const reused = pool.spawn({ active: true, y: 20 });

    expect(reused).toBe(first);
    expect(reused.x).toBeUndefined();
    expect(reused.stale).toBeUndefined();
    expect(reused.y).toBe(20);
  });
});

describe('game entity pools', () => {
  it('backs game state entity arrays with active pool views', () => {
    const g = createGameState();

    const projectile = spawnProjectileEntity(g, { x: 1, y: 2, active: true });
    const particle = spawnParticle(g, { x: 3, y: 4, active: true, life: 1 });

    expect(g.projectiles).toContain(projectile);
    expect(g.particles).toContain(particle);
    expect(g.projectiles).toBe(g.entityPools.projectiles.active);
    expect(g.particles).toBe(g.entityPools.particles.active);
  });

  it('resetEntityPools clears active entity arrays and preserves pool-backed views', () => {
    const g = createGameState();
    spawnProjectileEntity(g, { x: 1, y: 2, active: true });
    spawnParticle(g, { x: 3, y: 4, active: true, life: 1 });

    resetEntityPools(g);

    expect(g.projectiles).toHaveLength(0);
    expect(g.particles).toHaveLength(0);
    expect(g.projectiles).toBe(g.entityPools.projectiles.active);
    expect(g.particles).toBe(g.entityPools.particles.active);
  });
});
