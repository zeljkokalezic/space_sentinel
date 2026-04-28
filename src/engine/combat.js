/**
 * combat.js — Low-level combat utilities.
 * Pure functions; no React imports.
 */

/**
 * Returns the nearest active enemy to (x, y), or null if none exist.
 */
export const getNearestEnemy = (x, y, enemies) => {
  let nearest = null;
  let minDist = Infinity;
  for (let e of enemies) {
    if (!e.active) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist < minDist) { minDist = dist; nearest = e; }
  }
  return nearest;
};

/**
 * Pushes a new projectile into g.projectiles.
 * @param {object} g        - Live game state object
 * @param {number} x        - World X origin
 * @param {number} y        - World Y origin
 * @param {number} angle    - Launch angle (radians)
 * @param {number} speed    - Launch speed (world units/s)
 * @param {number} damage   - Damage on hit
 * @param {string} type     - 'autocannon' | 'plasma' | 'missile' | 'enemy_bullet' | 'enemy_missile'
 * @param {number} pierceCount - How many enemies the projectile can pierce through
 */
export const fireProjectile = (g, x, y, angle, speed, damage, type, pierceCount = 0) => {
  let target = null;
  if (type === 'missile') {
    target = g.enemies.filter(e => e.active)[Math.floor(Math.random() * g.enemies.filter(e => e.active).length)];
  } else if (type === 'enemy_missile') {
    target = g.player;
  }

  g.projectiles.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: type === 'plasma' ? 12 : (type === 'missile' || type === 'enemy_missile' ? 8 : 5),
    damage, type, active: true,
    pierce: pierceCount,
    hitList: [],
    life: 0,
    target,
    isEnemy: type.startsWith('enemy'),
  });
};

/**
 * Spawns burst particles at (x, y) in the particle pool.
 * @param {object} g      - Live game state object
 * @param {number} x      - World X position
 * @param {number} y      - World Y position
 * @param {number} color  - Hex colour integer
 * @param {number} count  - Number of particles to emit
 */
export const createParticles = (g, x, y, color, count) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 100 + 50;
    g.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: (Math.random() - 0.5) * speed,
      life: 1.0, maxLife: 1.0, color, active: true,
    });
  }
};
