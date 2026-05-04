/**
 * systems/particles.js — Particle lifecycle and visual effects update.
 */

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updateParticles = (dt, g) => {
  for (let p of g.particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vz) p.z = (p.z || 0) + p.vz * dt;
  }
};

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const updateEffects = (dt, g) => {
  for (let e of g.effects) {
    e.life -= dt;
    if (e.type === 'dmg') e.y += 40 * dt;
  }
};
