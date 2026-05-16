/**
 * combat.js — Low-level combat utilities.
 * Pure functions; no React imports.
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { SoundManager } from './audio';

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
  const C = GAME_CONFIG;
  let target = null;
  if (type === 'missile') {
    const active = g.enemies.filter(e => e.active);
    if (active.length > 0) {
      target = active[Math.floor(Math.random() * active.length)];
    }
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
  const C = GAME_CONFIG;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * (C.particles.speedMax - C.particles.speedMin) + C.particles.speedMin;
    g.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: (Math.random() - 0.5) * speed,
      life: C.particles.life, maxLife: C.particles.life, color, active: true,
    });
  }
};

/**
 * Shared enemy-kill handler used by both enemies.js and environmentalHazards.js.
 * Handles: deactivation, stats, mission tracking, particles, combo, power-up drops, scrap pickups.
 *
 * @param {object} g              - Live game state
 * @param {object} e              - Enemy being killed
 * @param {function} [completeMission] - Optional callback to complete the current mission
 */
export const killEnemy = (g, e, completeMission) => {
  const C = GAME_CONFIG;

  e.active = false;

  // Stats
  if (g.stats) g.stats.enemiesDestroyed++;

  // Mission progress
  if (g.mission) {
    if (g.mission.type === 'kill') {
      g.mission.current++;
      if (completeMission && g.mission.current >= g.mission.target) completeMission();
    } else if (g.mission.type === 'kill_elite' && (e.type === 'missile_boat' || e.type === 'shielded' || e.type === 'heavy')) {
      g.mission.current++;
      if (completeMission && g.mission.current >= g.mission.target) completeMission();
    } else if (g.mission.type === 'kill_miniboss') {
      g.mission.current++;
      if (completeMission && g.mission.current >= g.mission.target) completeMission();
    }
  }

  // Death particles
  createParticles(g, e.x, e.y, e.color, 15);

  // Combo increment
  if (g.combo) {
    const comboConfig = C.combo;
    g.combo.count++;
    g.combo.timer = comboConfig.timerDuration;
    let mult = comboConfig.milestones[0].mult;
    for (const m of comboConfig.milestones) {
      if (g.combo.count >= m.count) mult = m.mult;
    }
    g.combo.multiplier = mult;
    if (g.combo.count === 5 || g.combo.count === 10 || g.combo.count === 15) {
      SoundManager.play('combo_milestone');
    }
  }

  // Power-up drop
  if (Math.random() < C.powerups.dropChance) {
    const types = Object.keys(C.powerups.types);
    const type = types[Math.floor(Math.random() * types.length)];
    if (g.powerups) {
      g.powerups.push({
        id: Math.random(),
        x: e.x + (Math.random() - 0.5) * 20,
        y: e.y + (Math.random() - 0.5) * 20,
        type,
        active: true,
        radius: 10,
        color: C.powerups.types[type].color,
      });
    }
  }

  // Scrap pickup
  const val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
  g.pickups.push({ id: Math.random(), x: e.x, y: e.y, value: val, active: true, radius: 6 });
};
