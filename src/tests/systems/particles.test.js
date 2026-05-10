/**
 * Unit tests for systems/particles.js — updateParticles(dt, g) and updateEffects(dt, g)
 *
 * Covers: particle movement, lifetime expiry, deactivation, z-axis movement,
 * inactive particle skipping, multi-particle frames, and effects lifecycle.
 *
 * Run:  npm run test:run -- src/tests/systems/particles.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateParticles, updateEffects } from '../../engine/systems/particles';
import { createTestState, createTestParticle } from '../helpers';

/* ──────────────────────────────────────────────
 * Helper: no-op for functions that take a third arg
 * ────────────────────────────────────────────── */
const noop = vi.fn();

/* ──────────────────────────────────────────────
 * 1. Active particles move by velocity * dt
 * ────────────────────────────────────────────── */
describe('active particle movement', () => {
  it('updates position by velocity * dt along X axis', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.vx = 100;
    p.vy = 0;
    g.particles = [p];

    updateParticles(0.1, g);

    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });

  it('updates position by velocity * dt along Y axis', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.vx = 0;
    p.vy = -200;
    g.particles = [p];

    updateParticles(0.05, g);

    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-10);
  });

  it('updates position diagonally', () => {
    const g = createTestState();
    const p = createTestParticle(10, 20);
    p.vx = 50;
    p.vy = 80;
    g.particles = [p];

    updateParticles(0.1, g);

    expect(p.x).toBeCloseTo(15);
    expect(p.y).toBeCloseTo(28);
  });

  it('particle life decreases by dt', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 2.0;
    g.particles = [p];

    updateParticles(0.3, g);

    expect(p.life).toBeCloseTo(1.7);
  });

  it('particle life accumulates across multiple calls', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 3.0;
    g.particles = [p];

    updateParticles(0.5, g);
    expect(p.life).toBeCloseTo(2.5);

    updateParticles(0.3, g);
    expect(p.life).toBeCloseTo(2.2);
  });
});

/* ──────────────────────────────────────────────
 * 2. Particle becomes inactive when life reaches 0
 * ────────────────────────────────────────────── */
describe('particle lifetime expiry', () => {
  it('particle becomes inactive when life drops to 0', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 0.5;
    g.particles = [p];

    updateParticles(0.5, g);

    expect(p.active).toBe(false);
    expect(p.life).toBeCloseTo(0);
  });

  it('particle becomes inactive when life drops below 0', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 0.3;
    g.particles = [p];

    updateParticles(0.5, g);

    expect(p.active).toBe(false);
    expect(p.life).toBeCloseTo(-0.2);
  });

  it('particle stays active when life is still positive', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 1.0;
    g.particles = [p];

    updateParticles(0.3, g);

    expect(p.active).toBe(true);
    expect(p.life).toBeCloseTo(0.7);
  });

  it('expired particle does not move (continue before position update)', () => {
    const g = createTestState();
    const p = createTestParticle(100, 200);
    p.vx = 500;
    p.vy = 500;
    p.life = 0.1;
    g.particles = [p];

    updateParticles(0.2, g);

    expect(p.active).toBe(false);
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
  });

  it('particle with 0 initial life is deactivated immediately', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 0;
    g.particles = [p];

    updateParticles(0.01, g);

    expect(p.active).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 3. Inactive particles are skipped
 * ────────────────────────────────────────────── */
describe('inactive particles are skipped', () => {
  it('does not update position of inactive particle', () => {
    const g = createTestState();
    const p = createTestParticle(100, 200);
    p.vx = 100;
    p.vy = 100;
    p.active = false;
    g.particles = [p];

    updateParticles(0.1, g);

    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
  });

  it('does not decrement life of inactive particle', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.active = false;
    p.life = 5;
    g.particles = [p];

    updateParticles(1, g);

    expect(p.life).toBe(5);
  });

  it('inactive particle remains inactive', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.active = false;
    g.particles = [p];

    updateParticles(0.1, g);

    expect(p.active).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 4. Z-axis movement with vz
 * ────────────────────────────────────────────── */
describe('z-axis movement', () => {
  it('updates z position when vz is set', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.vz = 30;
    p.z = 0;
    g.particles = [p];

    updateParticles(0.1, g);

    expect(p.z).toBeCloseTo(3);
  });

  it('initializes z from 0 when z is undefined but vz is set', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.vz = 10;
    // z is not set explicitly
    g.particles = [p];

    updateParticles(0.5, g);

    expect(p.z).toBeCloseTo(5);
  });

  it('does not update z when vz is 0 (falsy)', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.vz = 0;
    p.z = 99;
    g.particles = [p];

    updateParticles(0.1, g);

    expect(p.z).toBe(99);
  });

  it('does not update z when vz is undefined', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    // vz not set
    p.z = 50;
    g.particles = [p];

    updateParticles(0.1, g);

    expect(p.z).toBe(50);
  });

  it('z accumulates across multiple frames', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.vz = 20;
    p.z = 0;
    g.particles = [p];

    updateParticles(0.1, g);
    expect(p.z).toBeCloseTo(2);

    updateParticles(0.1, g);
    expect(p.z).toBeCloseTo(4);
  });
});

/* ──────────────────────────────────────────────
 * 5. Multiple particles in one frame
 * ────────────────────────────────────────────── */
describe('multiple particles', () => {
  it('all active particles move in a single frame', () => {
    const g = createTestState();
    const p1 = createTestParticle(0, 0);
    p1.vx = 100;
    p1.vy = 0;
    p1.life = 2;

    const p2 = createTestParticle(50, 50);
    p2.vx = 0;
    p2.vy = -100;
    p2.life = 2;

    g.particles = [p1, p2];

    updateParticles(0.1, g);

    expect(p1.x).toBeCloseTo(10);
    expect(p1.y).toBeCloseTo(0);
    expect(p2.x).toBeCloseTo(50);
    expect(p2.y).toBeCloseTo(40);
  });

  it('mixed active and inactive particles process correctly', () => {
    const g = createTestState();
    const p1 = createTestParticle(0, 0);
    p1.vx = 100;
    p1.vy = 0;
    p1.life = 2;

    const p2 = createTestParticle(50, 50);
    p2.vx = 200;
    p2.vy = 200;
    p2.active = false;

    const p3 = createTestParticle(100, 100);
    p3.vx = 50;
    p3.vy = 50;
    p3.life = 2;

    g.particles = [p1, p2, p3];

    updateParticles(0.1, g);

    expect(p1.x).toBeCloseTo(10);
    expect(p2.x).toBe(50);
    expect(p2.y).toBe(50);
    expect(p3.x).toBeCloseTo(105);
    expect(p3.y).toBeCloseTo(105);
  });

  it('one particle expires while others remain active', () => {
    const g = createTestState();
    const p1 = createTestParticle(0, 0);
    p1.vx = 100;
    p1.vy = 0;
    p1.life = 0.3;

    const p2 = createTestParticle(10, 10);
    p2.vx = 100;
    p2.vy = 0;
    p2.life = 2;

    g.particles = [p1, p2];

    updateParticles(0.5, g);

    expect(p1.active).toBe(false);
    expect(p2.active).toBe(true);
    expect(p2.x).toBeCloseTo(60);
  });

  it('empty particles array causes no errors', () => {
    const g = createTestState();
    g.particles = [];

    expect(() => updateParticles(0.1, g)).not.toThrow();
  });
});

/* ──────────────────────────────────────────────
 * 6. Particle fade-out (life as proxy for alpha)
 * ────────────────────────────────────────────── */
describe('particle fade-out', () => {
  it('life value decreases proportionally to dt', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 1.0;
    g.particles = [p];

    updateParticles(0.25, g);
    expect(p.life).toBeCloseTo(0.75);

    updateParticles(0.25, g);
    expect(p.life).toBeCloseTo(0.5);

    updateParticles(0.25, g);
    expect(p.life).toBeCloseTo(0.25);
  });

  it('particle with maxLife tracks remaining fraction', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 2.0;
    p.maxLife = 2.0;
    g.particles = [p];

    updateParticles(0.5, g);

    // life/maxLife = 1.5/2.0 = 0.75 remaining
    expect(p.life / p.maxLife).toBeCloseTo(0.75);
  });

  it('particle deactivates at exact life boundary', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.life = 0.01;
    g.particles = [p];

    updateParticles(0.01, g);

    expect(p.active).toBe(false);
  });
});

/* ──────────────────────────────────────────────
 * 7. Effects updates — updateEffects(dt, g)
 * ────────────────────────────────────────────── */
describe('updateEffects', () => {
  it('decreases effect life by dt', () => {
    const g = createTestState();
    const e = { type: 'dmg', life: 2.0, y: 0, text: '10' };
    g.effects = [e];

    updateEffects(0.5, g);

    expect(e.life).toBeCloseTo(1.5);
  });

  it('dmg effects move upward (y += 40 * dt)', () => {
    const g = createTestState();
    const e = { type: 'dmg', life: 2.0, y: 100, text: '25' };
    g.effects = [e];

    updateEffects(0.5, g);

    expect(e.y).toBeCloseTo(120);
  });

  it('dmg effect y accumulates across frames', () => {
    const g = createTestState();
    const e = { type: 'dmg', life: 3.0, y: 0, text: '5' };
    g.effects = [e];

    updateEffects(0.1, g);
    expect(e.y).toBeCloseTo(4);

    updateEffects(0.1, g);
    expect(e.y).toBeCloseTo(8);
  });

  it('non-dmg effects do not change y position', () => {
    const g = createTestState();
    const e = { type: 'shield', life: 2.0, y: 50 };
    g.effects = [e];

    updateEffects(0.5, g);

    expect(e.y).toBe(50);
  });

  it('multiple effects update independently', () => {
    const g = createTestState();
    const dmg = { type: 'dmg', life: 2.0, y: 100, text: '10' };
    const other = { type: 'shield', life: 3.0, y: 200 };
    g.effects = [dmg, other];

    updateEffects(0.5, g);

    expect(dmg.y).toBeCloseTo(120);
    expect(dmg.life).toBeCloseTo(1.5);
    expect(other.y).toBe(200);
    expect(other.life).toBeCloseTo(2.5);
  });

  it('empty effects array causes no errors', () => {
    const g = createTestState();
    g.effects = [];

    expect(() => updateEffects(0.1, g)).not.toThrow();
  });

  it('effect life can go negative (no deactivation in effects)', () => {
    const g = createTestState();
    const e = { type: 'dmg', life: 0.1, y: 0, text: '1' };
    g.effects = [e];

    updateEffects(0.5, g);

    expect(e.life).toBeCloseTo(-0.4);
    // updateEffects does not deactivate — it only decrements life and moves dmg
    expect(e.y).toBeCloseTo(20);
  });
});

/* ──────────────────────────────────────────────
 * 8. Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  it('dt of 0 produces no changes', () => {
    const g = createTestState();
    const p = createTestParticle(10, 20);
    p.vx = 100;
    p.vy = 100;
    p.life = 1.0;
    g.particles = [p];

    updateParticles(0, g);

    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
    expect(p.life).toBeCloseTo(1.0);
    expect(p.active).toBe(true);
  });

  it('particle with negative velocity moves in opposite direction', () => {
    const g = createTestState();
    const p = createTestParticle(100, 100);
    p.vx = -50;
    p.vy = -80;
    p.life = 2;
    g.particles = [p];

    updateParticles(0.1, g);

    expect(p.x).toBeCloseTo(95);
    expect(p.y).toBeCloseTo(92);
  });

  it('large dt deactivates particle and skips movement', () => {
    const g = createTestState();
    const p = createTestParticle(0, 0);
    p.vx = 9999;
    p.vy = 9999;
    p.life = 0.5;
    g.particles = [p];

    updateParticles(10, g);

    expect(p.active).toBe(false);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });
});
