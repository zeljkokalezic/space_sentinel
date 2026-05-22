/**
 * Unit tests for thrust trail particle system.
 *
 * Covers: particle spawning on forward thrust, no particles on reverse/no thrust,
 * particle direction (behind ship), thruster level scaling, touch joystick thrust,
 * particle properties (color, life, type), yaw-based positioning, and spawn rate.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updatePlayer } from '../../engine/systems/playerMovement';
import { createTestState } from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

const dt = 0.1; // 100ms delta time

/* ──────────────────────────────────────────────
 * 1. Config exists and has expected defaults
 * ────────────────────────────────────────────── */
describe('thrust trail config', () => {
  it('GAME_CONFIG.thrustTrail exists', () => {
    expect(GAME_CONFIG.thrustTrail).toBeDefined();
  });

  it('has expected properties', () => {
    const cfg = GAME_CONFIG.thrustTrail;
    expect(cfg.enabled).toBe(true);
    expect(cfg.particlesPerFrame).toBeGreaterThan(0);
    expect(cfg.offset).toBeGreaterThan(0);
    expect(cfg.spreadAngle).toBeGreaterThan(0);
    expect(cfg.speedMin).toBeGreaterThan(0);
    expect(cfg.speedMax).toBeGreaterThan(cfg.speedMin);
    expect(cfg.life).toBeGreaterThan(0);
    expect(cfg.color).toBeDefined();
    expect(cfg.type).toBe('trail');
  });
});

/* ──────────────────────────────────────────────
 * 2. Forward thrust spawns trail particles
 * ────────────────────────────────────────────── */
describe('forward thrust spawns particles', () => {
  it('W key spawns trail particles', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('particles have correct type', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    for (const p of g.particles) {
      expect(p.type).toBe('trail');
    }
  });

  it('particles have correct color', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const expectedColor = GAME_CONFIG.thrustTrail.color;
    for (const p of g.particles) {
      expect(p.color).toBe(expectedColor);
    }
  });

  it('particles are active', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    for (const p of g.particles) {
      expect(p.active).toBe(true);
    }
  });

  it('particles have life set to config value', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const expectedLife = GAME_CONFIG.thrustTrail.life;
    for (const p of g.particles) {
      expect(p.life).toBeCloseTo(expectedLife);
      expect(p.maxLife).toBeCloseTo(expectedLife);
    }
  });
});

/* ──────────────────────────────────────────────
 * 3. No thrust / reverse thrust → no particles
 * ────────────────────────────────────────────── */
describe('no thrust or reverse thrust produces no particles', () => {
  it('no keys pressed → no particles', () => {
    const g = createTestState();
    updatePlayer(dt, g);
    expect(g.particles.length).toBe(0);
  });

  it('S key (reverse thrust) → no particles', () => {
    const g = createTestState();
    g.keys['s'] = true;
    updatePlayer(dt, g);
    expect(g.particles.length).toBe(0);
  });

  it('only rotation keys → no particles', () => {
    const g = createTestState();
    g.keys['a'] = true;
    updatePlayer(dt, g);
    expect(g.particles.length).toBe(0);
  });

  it('only strafe keys → no particles', () => {
    const g = createTestState();
    g.keys['q'] = true;
    updatePlayer(dt, g);
    expect(g.particles.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 4. Particle direction — behind the ship
 * ────────────────────────────────────────────── */
describe('particle direction (behind ship)', () => {
  it('particles spawn behind the ship (opposite to yaw)', () => {
    const g = createTestState();
    g.player.yaw = 0; // facing +x (right)
    g.keys['w'] = true;
    updatePlayer(dt, g);

    // Particles should be offset in -x direction (behind ship)
    for (const p of g.particles) {
      expect(p.x).toBeLessThan(g.player.x);
    }
  });

  it('particles move backward relative to ship direction', () => {
    const g = createTestState();
    g.player.yaw = 0; // facing +x
    g.keys['w'] = true;
    updatePlayer(dt, g);

    // Velocity should have negative x component (moving away from ship front)
    for (const p of g.particles) {
      expect(p.vx).toBeLessThan(0);
    }
  });

  it('at yaw=PI/2 (facing +y), particles spawn above ship', () => {
    const g = createTestState();
    g.player.yaw = Math.PI / 2; // facing +y (down on screen)
    g.keys['w'] = true;
    updatePlayer(dt, g);

    // Particles should be offset in -y direction (behind ship)
    for (const p of g.particles) {
      expect(p.y).toBeLessThan(g.player.y);
    }
  });

  it('at yaw=PI (facing -x), particles spawn to the right of ship', () => {
    const g = createTestState();
    g.player.yaw = Math.PI; // facing -x (left)
    g.keys['w'] = true;
    updatePlayer(dt, g);

    // Particles should be offset in +x direction (behind ship)
    for (const p of g.particles) {
      expect(p.x).toBeGreaterThan(g.player.x);
    }
  });
});

/* ──────────────────────────────────────────────
 * 5. Thruster level scaling
 * ────────────────────────────────────────────── */
describe('thruster level scaling', () => {
  it('higher thruster level produces more particles', () => {
    const g1 = createTestState();
    g1.levels.thrusters = 1;
    g1.keys['w'] = true;
    updatePlayer(dt, g1);

    const g5 = createTestState();
    g5.levels.thrusters = 5;
    g5.keys['w'] = true;
    updatePlayer(dt, g5);

    expect(g5.particles.length).toBeGreaterThan(g1.particles.length);
  });

  it('thruster level 1 still produces at least 1 particle', () => {
    const g = createTestState();
    g.levels.thrusters = 1;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.particles.length).toBeGreaterThanOrEqual(1);
  });
});

/* ──────────────────────────────────────────────
 * 6. Arrow key thrust also spawns particles
 * ────────────────────────────────────────────── */
describe('arrow key thrust', () => {
  it('arrowup spawns trail particles', () => {
    const g = createTestState();
    g.keys['arrowup'] = true;
    updatePlayer(dt, g);
    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('arrowdown does not spawn particles', () => {
    const g = createTestState();
    g.keys['arrowdown'] = true;
    updatePlayer(dt, g);
    expect(g.particles.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 7. Touch joystick thrust spawns particles
 * ────────────────────────────────────────────── */
describe('touch joystick thrust', () => {
  it('forward joystick thrust spawns particles', () => {
    const g = createTestState();
    g.player.yaw = Math.PI / 2; // facing +y
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = { x: 100, y: 30 }; // pushing "up" on screen = forward thrust
    updatePlayer(dt, g);

    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('backward joystick thrust does not spawn particles', () => {
    const g = createTestState();
    g.player.yaw = Math.PI / 2; // facing +y
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = { x: 100, y: 200 }; // pushing "down" = reverse thrust
    updatePlayer(dt, g);

    expect(g.particles.length).toBe(0);
  });

  it('joystick too small to register → no particles', () => {
    const g = createTestState();
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = { x: 102, y: 101 }; // distance < 10, ignored
    updatePlayer(dt, g);

    expect(g.particles.length).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 8. Particle count matches config (within tolerance)
 * ────────────────────────────────────────────── */
describe('particle count', () => {
  it('spawns approximately config.particlesPerFrame particles', () => {
    const g = createTestState();
    g.levels.thrusters = 1;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const baseCount = GAME_CONFIG.thrustTrail.particlesPerFrame;
    // Allow some variance due to thruster level multiplier
    expect(g.particles.length).toBeGreaterThanOrEqual(Math.floor(baseCount * 0.8));
    expect(g.particles.length).toBeLessThanOrEqual(Math.ceil(baseCount * 1.5));
  });
});

/* ──────────────────────────────────────────────
 * 9. Particle velocity within expected range
 * ────────────────────────────────────────────── */
describe('particle velocity range', () => {
  it('particle speed is within configured range', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const { speedMin, speedMax } = GAME_CONFIG.thrustTrail;
    for (const p of g.particles) {
      const speed = Math.hypot(p.vx, p.vy);
      expect(speed).toBeGreaterThanOrEqual(speedMin);
      expect(speed).toBeLessThanOrEqual(speedMax);
    }
  });
});

/* ──────────────────────────────────────────────
 * 10. Combined thrust + strafe still spawns particles
 * ────────────────────────────────────────────── */
describe('combined input', () => {
  it('thrust + strafe still spawns trail particles', () => {
    const g = createTestState();
    g.keys['w'] = true;
    g.keys['q'] = true; // strafe left
    updatePlayer(dt, g);
    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('thrust + rotation still spawns trail particles', () => {
    const g = createTestState();
    g.keys['w'] = true;
    g.keys['a'] = true; // rotate left
    updatePlayer(dt, g);
    expect(g.particles.length).toBeGreaterThan(0);
  });
});
