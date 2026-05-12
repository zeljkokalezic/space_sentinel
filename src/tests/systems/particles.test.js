/**
 * Unit tests for systems/particles.js — Particle lifecycle and visual effects.
 *
 * Tests particle types (spark, smoke, trail, explosion), gravity, drag, fade,
 * and the createParticlesWithType helper.
 *
 * Run:  npm test -- --run src/tests/systems/particles.test.js
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { updateParticles, updateEffects, createParticlesWithType } from '../../engine/systems/particles';
import { createTestState } from '../helpers';

/* ──────────────────────────────────────────────
 * 1. Particle types (spark, smoke, trail, explosion)
 * ────────────────────────────────────────────── */
describe('particle types', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('creates spark particles with correct defaults', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 3, 'spark');
    expect(state.particles.length).toBe(3);
    for (const p of state.particles) {
      expect(p.type).toBe('spark');
      expect(p.life).toBeGreaterThan(0);
      expect(p.maxLife).toBe(p.life);
      expect(p.color).toBe(0xff0000);
      expect(p.active).toBe(true);
    }
  });

  it('creates smoke particles with correct defaults', () => {
    createParticlesWithType(state, 0, 0, 0x888888, 2, 'smoke');
    expect(state.particles.length).toBe(2);
    for (const p of state.particles) {
      expect(p.type).toBe('smoke');
    }
  });

  it('creates trail particles with correct defaults', () => {
    createParticlesWithType(state, 0, 0, 0x00ff00, 4, 'trail');
    expect(state.particles.length).toBe(4);
    for (const p of state.particles) {
      expect(p.type).toBe('trail');
    }
  });

  it('creates explosion particles with correct defaults', () => {
    createParticlesWithType(state, 0, 0, 0xff8800, 5, 'explosion');
    expect(state.particles.length).toBe(5);
    for (const p of state.particles) {
      expect(p.type).toBe('explosion');
    }
  });

  it('defaults to spark type when type is unspecified', () => {
    createParticlesWithType(state, 0, 0, 0xffffff, 2, 'unknown');
    expect(state.particles.length).toBe(2);
    for (const p of state.particles) {
      expect(p.type).toBe('unknown'); // type is preserved but config falls back to spark
    }
  });
});

/* ──────────────────────────────────────────────
 * 2. Particle lifecycle (life, active, position)
 * ────────────────────────────────────────────── */
describe('particle lifecycle', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('decreases particle life each frame', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 1, 'spark');
    const p = state.particles[0];
    const initialLife = p.life;
    updateParticles(0.016, state);
    expect(p.life).toBeLessThan(initialLife);
  });

  it('deactivates particle when life reaches zero', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 1, 'spark');
    const p = state.particles[0];
    // Advance time beyond particle life
    updateParticles(p.life + 0.01, state);
    expect(p.active).toBe(false);
  });

  it('updates particle position based on velocity', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 1, 'spark');
    const p = state.particles[0];
    const initialX = p.x;
    const initialY = p.y;
    updateParticles(0.016, state);
    expect(p.x).not.toBe(initialX);
    expect(p.y).not.toBe(initialY);
  });

  it('handles particles with no vz gracefully', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 1, 'spark');
    const p = state.particles[0];
    delete p.vz;
    expect(() => updateParticles(0.016, state)).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * 3. Gravity application
 * ────────────────────────────────────────────── */
describe('gravity', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('applies gravity to spark particles', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 1, 'spark');
    const p = state.particles[0];
    const initialVy = p.vy;
    updateParticles(0.016, state);
    // Spark has positive gravity, so vy should increase
    expect(p.vy).toBeGreaterThan(initialVy);
  });

  it('applies negative gravity to smoke particles', () => {
    // Create smoke particle with zero initial vy to isolate gravity effect
    state.particles = [{
      x: 0, y: 0, vx: 0, vy: 0, vz: 0,
      life: 1.0, maxLife: 1.0, color: 0x888888, active: true, type: 'smoke', size: 4
    }];
    updateParticles(0.016, state);
    // Smoke has negative gravity (-20), so vy should become negative
    expect(state.particles[0].vy).toBeLessThan(0);
  });

  it('applies no gravity to trail particles', () => {
    createParticlesWithType(state, 0, 0, 0x00ff00, 1, 'trail');
    const p = state.particles[0];
    const initialVy = p.vy;
    updateParticles(0.016, state);
    // Trail has no gravity, so vy change is only from drag
    expect(p.vy).toBeCloseTo(initialVy * (1 - 5 * 0.016), 3);
  });
});

/* ──────────────────────────────────────────────
 * 4. Drag application
 * ────────────────────────────────────────────── */
describe('drag', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('applies drag to smoke particles', () => {
    createParticlesWithType(state, 0, 0, 0x888888, 1, 'smoke');
    const p = state.particles[0];
    const initialVx = p.vx;
    updateParticles(0.016, state);
    expect(Math.abs(p.vx)).toBeLessThan(Math.abs(initialVx));
  });

  it('applies stronger drag to trail particles', () => {
    createParticlesWithType(state, 0, 0, 0x00ff00, 1, 'trail');
    const p = state.particles[0];
    const initialVx = p.vx;
    updateParticles(0.016, state);
    expect(Math.abs(p.vx)).toBeLessThan(Math.abs(initialVx));
  });

  it('does not apply drag to spark particles', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 1, 'spark');
    const p = state.particles[0];
    const initialVx = p.vx;
    updateParticles(0.016, state);
    // Spark has no drag, only gravity affects vy
    expect(p.vx).toBeCloseTo(initialVx, 3);
  });
});

/* ──────────────────────────────────────────────
 * 5. Size fade based on life ratio
 * ────────────────────────────────────────────── */
describe('size fade', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('spark particles shrink linearly', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 1, 'spark');
    const p = state.particles[0];
    const initialSize = p.size;
    updateParticles(0.016, state);
    expect(p.size).toBeLessThan(initialSize);
  });

  it('smoke particles expand over time', () => {
    createParticlesWithType(state, 0, 0, 0x888888, 1, 'smoke');
    const p = state.particles[0];
    const initialSize = p.size;
    updateParticles(0.016, state);
    expect(p.size).toBeGreaterThan(initialSize);
  });

  it('trail particles shrink quickly (quadratic fade)', () => {
    createParticlesWithType(state, 0, 0, 0x00ff00, 1, 'trail');
    const p = state.particles[0];
    const initialSize = p.size;
    updateParticles(0.016, state);
    expect(p.size).toBeLessThan(initialSize);
  });
});

/* ──────────────────────────────────────────────
 * 6. createParticlesWithType helper
 * ────────────────────────────────────────────── */
describe('createParticlesWithType', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('creates the specified number of particles', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 10, 'spark');
    expect(state.particles.length).toBe(10);
  });

  it('creates particles at the specified position', () => {
    createParticlesWithType(state, 100, 200, 0xff0000, 3, 'spark');
    for (const p of state.particles) {
      expect(p.x).toBe(100);
      expect(p.y).toBe(200);
    }
  });

  it('creates particles with the specified color', () => {
    createParticlesWithType(state, 0, 0, 0x123456, 2, 'spark');
    for (const p of state.particles) {
      expect(p.color).toBe(0x123456);
    }
  });

  it('creates particles with random velocities', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 5, 'spark');
    const velocities = state.particles.map(p => `${p.vx},${p.vy}`);
    // At least some velocities should be different
    const unique = new Set(velocities);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('creates particles with random vz', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 3, 'spark');
    for (const p of state.particles) {
      expect(p.vz).toBeDefined();
      expect(typeof p.vz).toBe('number');
    }
  });
});

/* ──────────────────────────────────────────────
 * 7. Effects update
 * ────────────────────────────────────────────── */
describe('updateEffects', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('decreases effect life each frame', () => {
    state.effects = [{ type: 'dmg', life: 1.0, y: 0 }];
    updateEffects(0.016, state);
    expect(state.effects[0].life).toBeLessThan(1.0);
  });

  it('moves damage effects upward', () => {
    state.effects = [{ type: 'dmg', life: 1.0, y: 0 }];
    updateEffects(0.016, state);
    expect(state.effects[0].y).toBeGreaterThan(0);
  });

  it('does not move non-damage effects', () => {
    state.effects = [{ type: 'other', life: 1.0, y: 0 }];
    updateEffects(0.016, state);
    expect(state.effects[0].y).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 8. Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('handles empty particles array', () => {
    state.particles = [];
    expect(() => updateParticles(0.016, state)).not.toThrow();
  });

  it('handles particles without type (defaults to spark)', () => {
    state.particles = [
      { x: 0, y: 0, vx: 10, vy: 10, life: 0.5, maxLife: 0.5, color: 0xff0000, active: true }
    ];
    expect(() => updateParticles(0.016, state)).not.toThrow();
  });

  it('handles particles without maxLife', () => {
    state.particles = [
      { x: 0, y: 0, vx: 10, vy: 10, life: 0.5, color: 0xff0000, active: true, type: 'spark' }
    ];
    expect(() => updateParticles(0.016, state)).not.toThrow();
  });

  it('handles zero count (no particles created)', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 0, 'spark');
    expect(state.particles.length).toBe(0);
  });

  it('handles large particle counts', () => {
    createParticlesWithType(state, 0, 0, 0xff0000, 100, 'spark');
    expect(state.particles.length).toBe(100);
  });
});
