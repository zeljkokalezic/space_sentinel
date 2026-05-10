/**
 * Unit tests for systems/playerMovement.js — Player ship movement.
 *
 * Covers: keyboard input (WASD + arrows), yaw rotation, thrust,
 * world bounds clamping, thruster level scaling, touch joystick,
 * multi-frame accumulation, and position/velocity update formulas.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { updatePlayer } from '../../engine/systems/playerMovement';
import { createTestState } from '../helpers';
import { GAME_CONFIG } from '../../constants/gameConfig';

/* ──────────────────────────────────────────────
 * Shared constants from GAME_CONFIG
 * ────────────────────────────────────────────── */
const turnSpeed = GAME_CONFIG.player.turnSpeed;
const worldBounds = GAME_CONFIG.player.worldBounds;
const speedPerLevel = GAME_CONFIG.thrusters.speedPerLevel;
const baseSpeed = 120; // createTestState default player.speed
const dt = 0.1; // 100 ms delta time used in most tests

/* ──────────────────────────────────────────────
 * 1. No input — velocity zero, position unchanged
 * ────────────────────────────────────────────── */
describe('no input (empty keys)', () => {
  it('velocity stays at zero when no keys pressed', () => {
    const g = createTestState();
    updatePlayer(dt, g);
    expect(g.player.vx).toBe(0);
    expect(g.player.vy).toBe(0);
  });

  it('position does not change when no keys pressed', () => {
    const g = createTestState();
    const startX = g.player.x;
    const startY = g.player.y;
    updatePlayer(dt, g);
    expect(g.player.x).toBe(startX);
    expect(g.player.y).toBe(startY);
  });

  it('yaw remains unchanged when no rotation keys pressed', () => {
    const g = createTestState();
    const startYaw = g.player.yaw;
    updatePlayer(dt, g);
    expect(g.player.yaw).toBe(startYaw);
  });

  it('initializes yaw to PI/2 when undefined', () => {
    const g = createTestState();
    g.player.yaw = undefined;
    updatePlayer(dt, g);
    expect(g.player.yaw).toBe(Math.PI / 2);
  });

  it('does not re-initialize yaw when already set', () => {
    const g = createTestState();
    g.player.yaw = 0;
    updatePlayer(dt, g);
    expect(g.player.yaw).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 2. W key — thrust forward
 * ────────────────────────────────────────────── */
describe('W key (thrust forward)', () => {
  it('velocity increases in direction of yaw', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    // yaw = PI/2 => cos=0, sin=1 => velocity along +y
    expect(g.player.vx).toBeCloseTo(0);
    expect(g.player.vy).toBeCloseTo(baseSpeed);
  });

  it('position changes by vx*dt and vy*dt', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(0);
    expect(g.player.y).toBeCloseTo(baseSpeed * dt);
  });

  it('works at yaw=0 (facing right, +x)', () => {
    const g = createTestState();
    g.player.yaw = 0;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(baseSpeed * dt);
    expect(g.player.y).toBeCloseTo(0);
  });

  it('works at yaw=PI (facing left, -x)', () => {
    const g = createTestState();
    g.player.yaw = Math.PI;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(-baseSpeed * dt);
    expect(g.player.y).toBeCloseTo(0);
  });

  it('works at yaw=3PI/2 (facing down, -y)', () => {
    const g = createTestState();
    g.player.yaw = (3 * Math.PI) / 2;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(0);
    expect(g.player.y).toBeCloseTo(-baseSpeed * dt);
  });

  it('works at diagonal yaw=PI/4', () => {
    const g = createTestState();
    g.player.yaw = Math.PI / 4;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const expected = baseSpeed * Math.cos(Math.PI / 4) * dt;
    expect(g.player.x).toBeCloseTo(expected);
    expect(g.player.y).toBeCloseTo(expected);
  });
});

/* ──────────────────────────────────────────────
 * 3. S key — thrust reverse
 * ────────────────────────────────────────────── */
describe('S key (thrust reverse)', () => {
  it('velocity decreases (negative thrust) in direction of yaw', () => {
    const g = createTestState();
    g.keys['s'] = true;
    updatePlayer(dt, g);

    // yaw=PI/2 => moving backward = -y
    expect(g.player.vx).toBeCloseTo(0);
    expect(g.player.vy).toBeCloseTo(-baseSpeed);
  });

  it('position moves opposite to yaw direction', () => {
    const g = createTestState();
    g.keys['s'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(0);
    expect(g.player.y).toBeCloseTo(-baseSpeed * dt);
  });

  it('works at yaw=0 (reverse = move left, -x)', () => {
    const g = createTestState();
    g.player.yaw = 0;
    g.keys['s'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(-baseSpeed * dt);
    expect(g.player.y).toBeCloseTo(0);
  });
});

/* ──────────────────────────────────────────────
 * 4. A key — rotate left (yaw increases)
 * ────────────────────────────────────────────── */
describe('A key (rotate left — yaw increases)', () => {
  it('yaw increases by turnSpeed * dt', () => {
    const g = createTestState();
    const startYaw = g.player.yaw;
    g.keys['a'] = true;
    updatePlayer(dt, g);

    expect(g.player.yaw).toBeCloseTo(startYaw + turnSpeed * dt);
  });

  it('position does not change when only rotating', () => {
    const g = createTestState();
    g.keys['a'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBe(0);
    expect(g.player.y).toBe(0);
  });

  it('velocity is zero when only rotating', () => {
    const g = createTestState();
    g.keys['a'] = true;
    updatePlayer(dt, g);

    expect(g.player.vx).toBeCloseTo(0);
    expect(g.player.vy).toBeCloseTo(0);
  });
});

/* ──────────────────────────────────────────────
 * 5. D key — rotate right (yaw decreases)
 * ────────────────────────────────────────────── */
describe('D key (rotate right — yaw decreases)', () => {
  it('yaw decreases by turnSpeed * dt', () => {
    const g = createTestState();
    const startYaw = g.player.yaw;
    g.keys['d'] = true;
    updatePlayer(dt, g);

    expect(g.player.yaw).toBeCloseTo(startYaw - turnSpeed * dt);
  });

  it('position does not change when only rotating', () => {
    const g = createTestState();
    g.keys['d'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBe(0);
    expect(g.player.y).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 6. Arrow keys work same as WASD
 * ────────────────────────────────────────────── */
describe('arrow keys equivalent to WASD', () => {
  it('arrowup same as w (thrust forward)', () => {
    const gW = createTestState();
    gW.keys['w'] = true;
    updatePlayer(dt, gW);

    const gArrow = createTestState();
    gArrow.keys['arrowup'] = true;
    updatePlayer(dt, gArrow);

    expect(gArrow.player.x).toBeCloseTo(gW.player.x);
    expect(gArrow.player.y).toBeCloseTo(gW.player.y);
    expect(gArrow.player.vx).toBeCloseTo(gW.player.vx);
    expect(gArrow.player.vy).toBeCloseTo(gW.player.vy);
  });

  it('arrowdown same as s (thrust reverse)', () => {
    const gS = createTestState();
    gS.keys['s'] = true;
    updatePlayer(dt, gS);

    const gArrow = createTestState();
    gArrow.keys['arrowdown'] = true;
    updatePlayer(dt, gArrow);

    expect(gArrow.player.x).toBeCloseTo(gS.player.x);
    expect(gArrow.player.y).toBeCloseTo(gS.player.y);
  });

  it('arrowleft same as a (yaw increases)', () => {
    const gA = createTestState();
    gA.keys['a'] = true;
    updatePlayer(dt, gA);

    const gArrow = createTestState();
    gArrow.keys['arrowleft'] = true;
    updatePlayer(dt, gArrow);

    expect(gArrow.player.yaw).toBeCloseTo(gA.player.yaw);
  });

  it('arrowright same as d (yaw decreases)', () => {
    const gD = createTestState();
    gD.keys['d'] = true;
    updatePlayer(dt, gD);

    const gArrow = createTestState();
    gArrow.keys['arrowright'] = true;
    updatePlayer(dt, gArrow);

    expect(gArrow.player.yaw).toBeCloseTo(gD.player.yaw);
  });
});

/* ──────────────────────────────────────────────
 * 7. World bounds clamping
 * ────────────────────────────────────────────── */
describe('world bounds clamping', () => {
  it('player stays within +worldBounds on x axis', () => {
    const g = createTestState();
    g.player.x = worldBounds - 10;
    g.player.yaw = 0; // facing +x
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeLessThanOrEqual(worldBounds);
    expect(g.player.x).toBeCloseTo(worldBounds);
  });

  it('player stays within -worldBounds on x axis', () => {
    const g = createTestState();
    g.player.x = -worldBounds + 10;
    g.player.yaw = Math.PI; // facing -x
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeGreaterThanOrEqual(-worldBounds);
    expect(g.player.x).toBeCloseTo(-worldBounds);
  });

  it('player stays within +worldBounds on y axis', () => {
    const g = createTestState();
    g.player.y = worldBounds - 10;
    g.player.yaw = Math.PI / 2; // facing +y
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.y).toBeLessThanOrEqual(worldBounds);
    expect(g.player.y).toBeCloseTo(worldBounds);
  });

  it('player stays within -worldBounds on y axis', () => {
    const g = createTestState();
    g.player.y = -worldBounds + 10;
    g.player.yaw = (3 * Math.PI) / 2; // facing -y
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.y).toBeGreaterThanOrEqual(-worldBounds);
    expect(g.player.y).toBeCloseTo(-worldBounds);
  });

  it('player already beyond bounds is clamped immediately', () => {
    const g = createTestState();
    g.player.x = worldBounds + 500;
    g.player.y = -worldBounds - 300;
    updatePlayer(dt, g);

    expect(g.player.x).toBe(worldBounds);
    expect(g.player.y).toBe(-worldBounds);
  });

  it('player at origin never exceeds bounds with small movement', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeGreaterThanOrEqual(-worldBounds);
    expect(g.player.x).toBeLessThanOrEqual(worldBounds);
    expect(g.player.y).toBeGreaterThanOrEqual(-worldBounds);
    expect(g.player.y).toBeLessThanOrEqual(worldBounds);
  });
});

/* ──────────────────────────────────────────────
 * 8. Thruster level affects speed
 * ────────────────────────────────────────────── */
describe('thruster level affects speed', () => {
  it('level 1 uses base speed (no bonus)', () => {
    const g = createTestState();
    g.levels.thrusters = 1;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.vy).toBeCloseTo(baseSpeed);
  });

  it('level 2 adds speedPerLevel to speed', () => {
    const g = createTestState();
    g.levels.thrusters = 2;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const expectedSpeed = baseSpeed + speedPerLevel;
    expect(g.player.vy).toBeCloseTo(expectedSpeed);
  });

  it('level 3 adds 2 * speedPerLevel to speed', () => {
    const g = createTestState();
    g.levels.thrusters = 3;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const expectedSpeed = baseSpeed + 2 * speedPerLevel;
    expect(g.player.vy).toBeCloseTo(expectedSpeed);
  });

  it('speed formula: player.speed + (thrusters - 1) * speedPerLevel', () => {
    const g = createTestState();
    g.player.speed = 200;
    g.levels.thrusters = 5;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    const expectedSpeed = 200 + (5 - 1) * speedPerLevel;
    expect(g.player.vy).toBeCloseTo(expectedSpeed);
  });

  it('higher thruster level produces larger position delta', () => {
    const g1 = createTestState();
    g1.levels.thrusters = 1;
    g1.keys['w'] = true;
    updatePlayer(dt, g1);

    const g3 = createTestState();
    g3.levels.thrusters = 3;
    g3.keys['w'] = true;
    updatePlayer(dt, g3);

    expect(g3.player.y).toBeGreaterThan(g1.player.y);
  });
});

/* ──────────────────────────────────────────────
 * 9. Position update formula: x += vx * dt
 * ────────────────────────────────────────────── */
describe('position update formula (x += vx * dt)', () => {
  it('position delta equals velocity * dt at yaw=0', () => {
    const g = createTestState();
    g.player.yaw = 0; // cos=1, sin=0
    g.player.x = 50;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(50 + baseSpeed * dt);
    expect(g.player.y).toBeCloseTo(0);
  });

  it('position delta equals velocity * dt at yaw=PI/2', () => {
    const g = createTestState();
    g.player.yaw = Math.PI / 2; // cos=0, sin=1
    g.player.y = 100;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(0);
    expect(g.player.y).toBeCloseTo(100 + baseSpeed * dt);
  });

  it('velocity is computed as cos(yaw)*thrust*speed and sin(yaw)*thrust*speed', () => {
    const g = createTestState();
    g.player.yaw = Math.PI / 6; // 30 degrees
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.vx).toBeCloseTo(Math.cos(Math.PI / 6) * baseSpeed);
    expect(g.player.vy).toBeCloseTo(Math.sin(Math.PI / 6) * baseSpeed);
  });

  it('different dt values produce proportionally different position deltas', () => {
    const g1 = createTestState();
    g1.keys['w'] = true;
    updatePlayer(0.05, g1);

    const g2 = createTestState();
    g2.keys['w'] = true;
    updatePlayer(0.2, g2);

    // dt=0.2 is 4x dt=0.05, so displacement should be 4x
    expect(g2.player.y).toBeCloseTo(g1.player.y * 4);
  });
});

/* ──────────────────────────────────────────────
 * 10. Velocity resets to zero when no thrust
 * ────────────────────────────────────────────── */
describe('velocity damping (no thrust => velocity = 0)', () => {
  it('velocity is zero when no thrust applied', () => {
    const g = createTestState();
    // No keys pressed
    updatePlayer(dt, g);

    expect(g.player.vx).toBe(0);
    expect(g.player.vy).toBe(0);
  });

  it('velocity resets each frame (not accumulated)', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);
    const vyAfterThrust = g.player.vy;

    // Release thrust
    g.keys['w'] = false;
    updatePlayer(dt, g);

    expect(g.player.vy).toBe(0);
    expect(vyAfterThrust).not.toBe(0);
  });

  it('switching from thrust to no thrust stops movement', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(dt, g);
    const yAfterThrust = g.player.y;

    g.keys['w'] = false;
    updatePlayer(dt, g);

    expect(g.player.y).toBeCloseTo(yAfterThrust);
  });
});

/* ──────────────────────────────────────────────
 * 11. Touch joystick input
 * ────────────────────────────────────────────── */
describe('touch joystick input', () => {
  it('touch input is ignored when distance < 10', () => {
    const g = createTestState();
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = { x: 105, y: 105 }; // dist ~7 < 10
    updatePlayer(dt, g);

    expect(g.player.vx).toBe(0);
    expect(g.player.vy).toBe(0);
  });

  it('touch input produces yaw change and thrust when distance >= 10', () => {
    const g = createTestState();
    const startYaw = g.player.yaw;
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = { x: 160, y: 100 }; // tx=60, ty=0, dist=60
    updatePlayer(dt, g);

    // nx = 60 / max(60, 60) = 1 => yaw -= 1 * turnSpeed * dt * 3
    // ny = 0 => thrust = 0
    expect(g.player.yaw).toBeCloseTo(startYaw - 1 * turnSpeed * dt * 3);
    expect(g.player.vx).toBeCloseTo(0);
    expect(g.player.vy).toBeCloseTo(0);
  });

  it('touch upward (negative ty) produces positive thrust', () => {
    const g = createTestState();
    g.touchBase = { x: 100, y: 160 };
    g.touchCurrent = { x: 100, y: 100 }; // tx=0, ty=-60, dist=60
    updatePlayer(dt, g);

    // ny = -60 / 60 = -1 => thrust = -(-1) = 1
    expect(g.player.vy).toBeCloseTo(baseSpeed);
  });

  it('touch downward (positive ty) produces negative thrust (reverse)', () => {
    const g = createTestState();
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = { x: 100, y: 160 }; // tx=0, ty=60, dist=60
    updatePlayer(dt, g);

    // ny = 60 / 60 = 1 => thrust = -1
    expect(g.player.vy).toBeCloseTo(-baseSpeed);
  });

  it('touch base resets when distance > 60', () => {
    const g = createTestState();
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = { x: 200, y: 100 }; // tx=100, ty=0, dist=100 > 60
    updatePlayer(dt, g);

    // touchBase should be clamped: new base = current - (dir * 60)
    expect(g.touchBase.x).toBeCloseTo(200 - (100 / 100) * 60);
    expect(g.touchBase.y).toBeCloseTo(100);
  });

  it('touch input takes priority over keyboard', () => {
    const g = createTestState();
    g.keys['w'] = true;
    g.keys['a'] = true;
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = { x: 100, y: 100 }; // dist=0 < 10, no touch effect
    updatePlayer(dt, g);

    // Since dist < 10, keyboard should still be used (the else branch)
    // Actually: the condition is `if (g.touchBase && g.touchCurrent)` — both exist,
    // so touch branch runs regardless of dist. With dist < 10, no changes happen.
    expect(g.player.vx).toBe(0);
    expect(g.player.vy).toBe(0);
  });

  it('keyboard is used when touchBase is null', () => {
    const g = createTestState();
    g.touchBase = null;
    g.touchCurrent = { x: 200, y: 200 };
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.vy).toBeCloseTo(baseSpeed);
  });

  it('keyboard is used when touchCurrent is null', () => {
    const g = createTestState();
    g.touchBase = { x: 100, y: 100 };
    g.touchCurrent = null;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.vy).toBeCloseTo(baseSpeed);
  });
});

/* ──────────────────────────────────────────────
 * 12. Multiple frames of input accumulate
 * ────────────────────────────────────────────── */
describe('multiple frames accumulate correctly', () => {
  it('position accumulates over multiple frames with constant thrust', () => {
    const g = createTestState();
    g.keys['w'] = true;

    updatePlayer(dt, g);
    const y1 = g.player.y;

    updatePlayer(dt, g);
    const y2 = g.player.y;

    updatePlayer(dt, g);
    const y3 = g.player.y;

    expect(y1).toBeCloseTo(baseSpeed * dt);
    expect(y2).toBeCloseTo(baseSpeed * dt * 2);
    expect(y3).toBeCloseTo(baseSpeed * dt * 3);
  });

  it('rotation accumulates over multiple frames', () => {
    const g = createTestState();
    const startYaw = g.player.yaw;
    g.keys['a'] = true;

    updatePlayer(dt, g);
    expect(g.player.yaw).toBeCloseTo(startYaw + turnSpeed * dt);

    updatePlayer(dt, g);
    expect(g.player.yaw).toBeCloseTo(startYaw + turnSpeed * dt * 2);

    updatePlayer(dt, g);
    expect(g.player.yaw).toBeCloseTo(startYaw + turnSpeed * dt * 3);
  });

  it('combined thrust + rotation: direction changes each frame', () => {
    const g = createTestState();
    g.player.yaw = 0; // facing +x
    g.keys['w'] = true;
    g.keys['d'] = true; // rotate right while thrusting

    updatePlayer(dt, g);
    const x1 = g.player.x;
    const y1 = g.player.y;
    const yaw1 = g.player.yaw;

    updatePlayer(dt, g);
    const x2 = g.player.x;
    const y2 = g.player.y;
    const yaw2 = g.player.yaw;

    // Yaw should have decreased (rotated right)
    expect(yaw2).toBeCloseTo(yaw1 - turnSpeed * dt);
    expect(yaw1).toBeCloseTo(0 - turnSpeed * dt);

    // Both frames moved in +x, but rotation applies before position update
    // so frame 1 uses yaw=-turnSpeed*dt (not yaw=0)
    // sin(-turnSpeed*dt) < 0, meaning y moves slightly negative
    expect(x1).toBeGreaterThan(0);
    expect(y1).toBeLessThan(0);
    expect(y2).toBeLessThan(y1); // more negative each frame
    expect(g.player.x).toBeGreaterThan(x1);
  });

  it('different dt values affect rotation proportionally', () => {
    const g = createTestState();
    g.keys['a'] = true;

    updatePlayer(0.05, g);
    const yaw1 = g.player.yaw;

    const g2 = createTestState();
    g2.keys['a'] = true;
    updatePlayer(0.1, g2);

    expect(g2.player.yaw).toBeCloseTo(yaw1 + turnSpeed * 0.05);
  });

  it('releasing and re-pressing thrust works correctly', () => {
    const g = createTestState();

    // Frame 1: thrust
    g.keys['w'] = true;
    updatePlayer(dt, g);
    const y1 = g.player.y;

    // Frame 2: no thrust
    g.keys['w'] = false;
    updatePlayer(dt, g);
    const y2 = g.player.y;

    // Frame 3: thrust again
    g.keys['w'] = true;
    updatePlayer(dt, g);
    const y3 = g.player.y;

    expect(y1).toBeCloseTo(baseSpeed * dt);
    expect(y2).toBeCloseTo(baseSpeed * dt); // no movement
    expect(y3).toBeCloseTo(baseSpeed * dt * 2);
  });
});

/* ──────────────────────────────────────────────
 * Edge cases
 * ────────────────────────────────────────────── */
describe('edge cases', () => {
  it('works with dt=0 (no time elapsed)', () => {
    const g = createTestState();
    g.keys['w'] = true;
    g.keys['a'] = true;
    updatePlayer(0, g);

    expect(g.player.x).toBe(0);
    expect(g.player.y).toBe(0);
    expect(g.player.yaw).toBe(Math.PI / 2); // no rotation with dt=0
  });

  it('works with large dt', () => {
    const g = createTestState();
    g.keys['w'] = true;
    updatePlayer(1.0, g);

    expect(g.player.y).toBeCloseTo(baseSpeed * 1.0);
  });

  it('w and s pressed together: s wins (last assignment)', () => {
    const g = createTestState();
    g.keys['w'] = true;
    g.keys['s'] = true;
    updatePlayer(dt, g);

    // Code: thrust=1 from w, then thrust=-1 from s
    expect(g.player.vy).toBeCloseTo(-baseSpeed);
  });

  it('a and d pressed together: both apply (net zero rotation)', () => {
    const g = createTestState();
    const startYaw = g.player.yaw;
    g.keys['a'] = true;
    g.keys['d'] = true;
    updatePlayer(dt, g);

    // yaw += turnSpeed*dt, then yaw -= turnSpeed*dt => net zero
    expect(g.player.yaw).toBeCloseTo(startYaw);
  });

  it('velocity is overwritten each frame, not accumulated', () => {
    const g = createTestState();
    g.player.vx = 999;
    g.player.vy = 999;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    // Velocity should be based on current yaw + thrust, not previous vx/vy
    expect(g.player.vx).toBeCloseTo(0);
    expect(g.player.vy).toBeCloseTo(baseSpeed);
  });

  it('works with non-zero starting position', () => {
    const g = createTestState();
    g.player.x = 500;
    g.player.y = -200;
    g.keys['w'] = true;
    updatePlayer(dt, g);

    expect(g.player.x).toBeCloseTo(500);
    expect(g.player.y).toBeCloseTo(-200 + baseSpeed * dt);
  });
});
