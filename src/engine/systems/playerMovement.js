/**
 * systems/playerMovement.js — Player ship movement, input handling, yaw, thrust, strafe, world bounds.
 *
 * Handles keyboard (WASD/arrows + Q/E strafe) and touch joystick input.
 * Movement: W/S thrust forward/back, A/D rotate, Q/E strafe left/right.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

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

  g.player.x += g.player.vx * dt;
  g.player.y += g.player.vy * dt;
  g.player.x = Math.max(-C.player.worldBounds, Math.min(C.player.worldBounds, g.player.x));
  g.player.y = Math.max(-C.player.worldBounds, Math.min(C.player.worldBounds, g.player.y));
};
