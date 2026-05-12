/**
 * pool.js — Object pooling for projectiles and particles.
 *
 * Reduces GC pressure by reusing objects instead of creating/destroying them.
 * Each pool maintains a free list of objects that can be recycled.
 */

/**
 * Create an object pool with a factory function.
 * @param {Function} factory - Function that creates a new object
 * @param {number} initialCapacity - Initial pool size
 * @returns {object} Pool instance
 */
export function createPool(factory, initialCapacity = 100) {
  const free = [];
  const active = [];
  
  // Pre-allocate initial capacity
  for (let i = 0; i < initialCapacity; i++) {
    free.push(factory());
  }
  
  return {
    /**
     * Get an object from the pool (or create new if pool exhausted).
     * @returns {object} A reusable object
     */
    acquire() {
      if (free.length > 0) {
        const obj = free.pop();
        active.push(obj);
        return obj;
      }
      const obj = factory();
      active.push(obj);
      return obj;
    },
    
    /**
     * Return an object to the pool for reuse.
     * @param {object} obj - Object to recycle
     */
    release(obj) {
      const idx = active.indexOf(obj);
      if (idx !== -1) {
        active.splice(idx, 1);
        free.push(obj);
      }
    },
    
    /**
     * Remove all inactive objects from the active list and return them to the pool.
     * @param {Function} isActive - Function that checks if an object is still active
     */
    cleanup(isActive) {
      for (let i = active.length - 1; i >= 0; i--) {
        if (!isActive(active[i])) {
          free.push(active[i]);
          active.splice(i, 1);
        }
      }
    },
    
    /**
     * Get all active objects.
     * @returns {object[]} Array of active objects
     */
    getActive() {
      return active;
    },
    
    /**
     * Get pool statistics.
     * @returns {object} Pool stats
     */
    stats() {
      return {
        free: free.length,
        active: active.length,
        total: free.length + active.length,
      };
    },
  };
}

/**
 * Create a projectile pool.
 * @returns {object} Projectile pool
 */
export function createProjectilePool() {
  return createPool(() => ({
    id: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    damage: 0,
    type: 'auto',
    active: false,
    life: 0,
    maxLife: 0,
    radius: 3,
    color: 0xffff00,
    homing: false,
    pierceCount: 0,
    maxPierce: 0,
  }), 200);
}

/**
 * Create a particle pool.
 * @returns {object} Particle pool
 */
export function createParticlePool() {
  return createPool(() => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 0,
    color: 0xffffff,
    active: false,
    type: 'spark',
    size: 3,
    gravity: 0,
    drag: 0,
  }), 300);
}

/**
 * Create an enemy pool.
 * @returns {object} Enemy pool
 */
export function createEnemyPool() {
  return createPool(() => ({
    id: 0,
    x: 0,
    y: 0,
    hp: 0,
    maxHp: 0,
    shield: 0,
    maxShield: 0,
    speed: 0,
    radius: 15,
    color: 0xff0000,
    type: 'fighter',
    active: false,
    fireCooldown: 0,
  }), 50);
}

/**
 * Create a pickup pool.
 * @returns {object} Pickup pool
 */
export function createPickupPool() {
  return createPool(() => ({
    x: 0,
    y: 0,
    value: 0,
    radius: 8,
    color: 0xfacc15,
    active: false,
    magnetized: false,
    life: 0,
    maxLife: 0,
  }), 100);
}
