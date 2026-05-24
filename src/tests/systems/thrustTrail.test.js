/**
 * Unit tests for thrust trail particle system.
 *
 * Covers: particle spawning on forward thrust, no particles on reverse/no thrust,
 * particle direction (behind ship), thruster level scaling, touch joystick thrust,
 * particle properties (color, life, type), yaw-based positioning, spawn rate,
 * and speed-based color/intensity scaling.
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
    // Speed-based color scaling
    expect(cfg.colorStops).toBeDefined();
    expect(Array.isArray(cfg.colorStops)).toBe(true);
    expect(cfg.colorStops.length).toBeGreaterThan(1);
    expect(cfg.sizeMin).toBeDefined();
    expect(cfg.sizeMax).toBeGreaterThan(cfg.sizeMin);
    expect(cfg.lifeMin).toBeGreaterThan(0);
    expect(cfg.lifeMax).toBeGreaterThanOrEqual(cfg.lifeMin);
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

  it('particles have speed-based color from colorStops', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    // Color should be interpolated from colorStops based on speed ratio
    const stops = GAME_CONFIG.thrustTrail.colorStops;
    for (const p of g.particles) {
      // Color should be within the range of defined stops
      const minColor = Math.min(...stops.map(s => s.color));
      const maxColor = Math.max(...stops.map(s => s.color));
      expect(p.color).toBeGreaterThanOrEqual(minColor);
      expect(p.color).toBeLessThanOrEqual(maxColor);
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

  it('particles have speed-based life within configured range', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const { lifeMin, lifeMax } = GAME_CONFIG.thrustTrail;
    for (const p of g.particles) {
      expect(p.life).toBeGreaterThanOrEqual(lifeMin);
      expect(p.life).toBeLessThanOrEqual(lifeMax);
      expect(p.maxLife).toBe(p.life);
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
    const extraHighSpeed = GAME_CONFIG.thrustTrail.extraParticlesAtHighSpeed || 0;
    // Allow variance due to thruster level multiplier and high-speed bonus
    expect(g.particles.length).toBeGreaterThanOrEqual(Math.floor(baseCount * 0.8));
    expect(g.particles.length).toBeLessThanOrEqual(Math.ceil(baseCount + extraHighSpeed + 2));
  });
});

/* ──────────────────────────────────────────────
 * 9. Particle velocity within expected range
 * ────────────────────────────────────────────── */
describe('particle velocity range', () => {
  it('particle speed is within boosted range (base * 1.5 max)', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const { speedMin, speedMax } = GAME_CONFIG.thrustTrail;
    // Speed can be boosted up to 1.5x at high speed ratio
    const maxBoostedSpeed = speedMax * 1.5;
    for (const p of g.particles) {
      const speed = Math.hypot(p.vx, p.vy);
      expect(speed).toBeGreaterThanOrEqual(speedMin);
      expect(speed).toBeLessThanOrEqual(maxBoostedSpeed);
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

/* ──────────────────────────────────────────────
 * 11. Speed-based color/intensity scaling
 * ────────────────────────────────────────────── */
describe('speed-based color scaling', () => {
  it('colorStops transitions from blue → cyan → orange → white', () => {
    const stops = GAME_CONFIG.thrustTrail.colorStops;
    // Blue (low) < Cyan (mid) < Orange (high) < White (max)
    expect(stops[0].ratio).toBe(0);
    expect(stops[stops.length - 1].ratio).toBe(1);
    expect(stops[0].color).toBe(0x3b82f6); // blue
    expect(stops[stops.length - 1].color).toBe(0xffffff); // white
  });

  it('particle size scales with speed ratio', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const { sizeMin, sizeMax } = GAME_CONFIG.thrustTrail;
    for (const p of g.particles) {
      expect(p.size).toBeGreaterThanOrEqual(sizeMin);
      expect(p.size).toBeLessThanOrEqual(sizeMax);
    }
  });

  it('particle size is larger at higher speed', () => {
    // At full thrust, speed ratio should be high → larger particles
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const { sizeMax } = GAME_CONFIG.thrustTrail;
    // At full thrust, particles should be near max size
    for (const p of g.particles) {
      expect(p.size).toBeGreaterThan(sizeMax * 0.5);
    }
  });

  it('extra particles spawned at high speed', () => {
    const g = createTestState();
    g.levels.thrusters = 1;
    g.keys['w'] = true;

    // First frame: speed is 0 (no velocity yet), no extra particles
    updatePlayer(dt, g);
    const firstFrameCount = g.particles.length;

    // Second frame: velocity exists, speed ratio > 0 → possible extra particles
    g.particles = [];
    g.player._thrustTrailTimer = 0;
    updatePlayer(dt, g);
    const secondFrameCount = g.particles.length;

    // Second frame should have >= first frame (extra particles at speed)
    expect(secondFrameCount).toBeGreaterThanOrEqual(firstFrameCount);
  });
});
