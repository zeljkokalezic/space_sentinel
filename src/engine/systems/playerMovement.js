/**
 * systems/playerMovement.js — Player ship movement, input handling, yaw, thrust, strafe, world bounds.
 *
 * Handles keyboard (WASD/arrows + Q/E strafe) and touch joystick input.
 * Movement: W/S thrust forward/back, A/D rotate, Q/E strafe left/right.
 * Spawns thrust trail particles behind the ship when thrusting forward.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { spawnParticle } from '../pool';

/**
 * Interpolate between color stops based on speed ratio (0-1).
 * @param {number} ratio — Normalized speed ratio (0 = stopped, 1 = max speed)
 * @param {Array} stops — Array of { ratio, color } stops
 * @returns {number} Interpolated color as hex integer
 */
function lerpColor(ratio, stops) {
  // Clamp ratio to [0, 1]
  ratio = Math.max(0, Math.min(1, ratio));

  // Edge cases: below first stop or above last stop
  if (ratio <= stops[0].ratio) return stops[0].color;
  if (ratio >= stops[stops.length - 1].ratio) return stops[stops.length - 1].color;

  // Find the two stops to interpolate between
  let lower = stops[0], upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].ratio && ratio <= stops[i + 1].ratio) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  // Lerp between the two colors
  const t = (ratio - lower.ratio) / (upper.ratio - lower.ratio);
  const lR = (lower.color >> 16) & 0xff, lG = (lower.color >> 8) & 0xff, lB = lower.color & 0xff;
  const uR = (upper.color >> 16) & 0xff, uG = (upper.color >> 8) & 0xff, uB = upper.color & 0xff;
  const r = Math.round(lR + (uR - lR) * t);
  const g = Math.round(lG + (uG - lG) * t);
  const b = Math.round(lB + (uB - lB) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * Spawn thrust trail particles behind the player ship.
 * Color and intensity scale with ship speed: blue (slow) → cyan (cruise) → orange (fast) → white (max).
 * @param {object} g  — Game state
 * @param {number} yaw — Ship yaw angle
 */
function spawnThrustTrail(g, yaw, dt) {
  const C = GAME_CONFIG.thrustTrail;
  if (!C.enabled) return;

  // Rate limit: only spawn every N seconds (default: every 3rd frame at 60fps)
  if (!g.player._thrustTrailTimer) g.player._thrustTrailTimer = 0;
  g.player._thrustTrailTimer -= dt;
  if (g.player._thrustTrailTimer > 0) return;
  g.player._thrustTrailTimer = C.spawnInterval || 0.05;

  // Calculate speed ratio: current velocity magnitude / max possible speed
  const currentSpeed = g.player.speed + (g.levels.thrusters - 1) * GAME_CONFIG.thrusters.speedPerLevel;
  const velocityMag = Math.hypot(g.player.vx, g.player.vy);
  const speedRatio = Math.min(1, velocityMag / currentSpeed);

  // Color from speed-based stops
  const thrustColor = C.colorStops
    ? lerpColor(speedRatio, C.colorStops)
    : C.color;

  // Size scales with speed: lerp between sizeMin and sizeMax
  const particleSize = C.sizeMin + (C.sizeMax - C.sizeMin) * speedRatio;

  // Lifetime scales with speed: lerp between lifeMin and lifeMax
  const particleLife = C.lifeMin + (C.lifeMax - C.lifeMin) * speedRatio;

  // Base particle count + thruster level bonus
  let count = C.particlesPerFrame + Math.max(0, (g.levels.thrusters - 1) * C.particlesPerThrusterLevel);

  // Extra particles at high speed for dramatic effect
  if (speedRatio > 0.7 && C.extraParticlesAtHighSpeed) {
    count += C.extraParticlesAtHighSpeed;
  }

  // Backward direction (opposite to ship facing)
  const backAngle = yaw + Math.PI;

  for (let i = 0; i < count; i++) {
    // Spread angle: random offset within ±spreadAngle
    const spread = (Math.random() - 0.5) * C.spreadAngle * 2;
    const particleAngle = backAngle + spread;

    // Speed: random within configured range, boosted at high speed ratio
    const speedBoost = 1 + speedRatio * 0.5;
    const speed = (Math.random() * (C.speedMax - C.speedMin) + C.speedMin) * speedBoost;

    // Spawn position: offset behind the ship
    const spawnX = g.player.x + Math.cos(backAngle) * C.offset;
    const spawnY = g.player.y + Math.sin(backAngle) * C.offset;

    spawnParticle(g, {
      x: spawnX,
      y: spawnY,
      vx: Math.cos(particleAngle) * speed,
      vy: Math.sin(particleAngle) * speed,
      vz: (Math.random() - 0.5) * 20,
      life: particleLife,
      maxLife: particleLife,
      color: thrustColor,
      active: true,
      type: C.type,
      size: particleSize,
    });
  }
}

/**
 * @param {number} dt — Delta time in seconds
 * @param {object} g  — Game state
 */
export const updatePlayer = (dt, g) => {
  const C = GAME_CONFIG;
  const turnSpeed = C.player.turnSpeed;

  if (g.player.yaw === undefined) g.player.yaw = Math.PI / 2;

  let thrust = 0;
  let strafe = 0;

  if (g.touchBase && g.touchCurrent) {
    // Touch joystick: decompose into forward + strafe relative to ship yaw
    let tx = g.touchCurrent.x - g.touchBase.x;
    let ty = g.touchCurrent.y - g.touchBase.y;
    let dist = Math.hypot(tx, ty);
    if (dist > 10) {
      let ndx = tx / Math.max(dist, 60);
      let ndy = ty / Math.max(dist, 60);

      // Ship forward and right vectors (screen coords: X=right, Y=down)
      const fwdX = Math.cos(g.player.yaw);
      const fwdY = Math.sin(g.player.yaw);
      const rightX = Math.sin(g.player.yaw);
      const rightY = -Math.cos(g.player.yaw);

      // Decompose joystick direction onto forward and strafe axes
      // Note: ty is negative = "up" on screen = forward thrust
      thrust = -(ndx * fwdX + ndy * fwdY);
      strafe = ndx * rightX + ndy * rightY;

      if (dist > 60) {
        g.touchBase.x = g.touchCurrent.x - (tx / dist) * 60;
        g.touchBase.y = g.touchCurrent.y - (ty / dist) * 60;
      }
    }
  } else {
    // Keyboard input
    if (g.keys['a'] || g.keys['arrowleft'])  g.player.yaw += turnSpeed * dt;
    if (g.keys['d'] || g.keys['arrowright']) g.player.yaw -= turnSpeed * dt;
    if (g.keys['w'] || g.keys['arrowup'])    thrust =  1;
    if (g.keys['s'] || g.keys['arrowdown'])  thrust = -1;
    if (g.keys['q']) strafe = -1;
    if (g.keys['e']) strafe =  1;
  }

  // Forward and right vectors
  const fwdX = Math.cos(g.player.yaw);
  const fwdY = Math.sin(g.player.yaw);
  const rightX = Math.sin(g.player.yaw);
  const rightY = -Math.cos(g.player.yaw);

  // Speeds: forward speed + thruster upgrade; strafe = ratio of forward + separate thruster scaling
  const currentSpeed = g.player.speed + (g.levels.thrusters - 1) * C.thrusters.speedPerLevel;
  const currentStrafeSpeed = currentSpeed * C.player.strafeSpeedRatio
    + (g.levels.thrusters - 1) * C.thrusters.strafeSpeedPerLevel;

  // Combine forward thrust + lateral strafe velocity
  g.player.vx = fwdX * thrust * currentSpeed + rightX * strafe * currentStrafeSpeed;
  g.player.vy = fwdY * thrust * currentSpeed + rightY * strafe * currentStrafeSpeed;

  // Spawn thrust trail particles when thrusting forward
  if (thrust > 0) {
    spawnThrustTrail(g, g.player.yaw, dt);
  }

  g.player.x += g.player.vx * dt;
  g.player.y += g.player.vy * dt;
  g.player.x = Math.max(-C.player.worldBounds, Math.min(C.player.worldBounds, g.player.x));
  g.player.y = Math.max(-C.player.worldBounds, Math.min(C.player.worldBounds, g.player.y));
};
