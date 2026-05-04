/**
 * systems/playerMovement.js — Player ship movement, input handling, yaw, thrust, world bounds.
 *
 * Handles keyboard (WASD/arrows) and touch joystick input.
 * Movement is yaw-based: W/S thrust forward/back, A/D rotate.
 */

/**
 * @param {number} dt — Delta time in seconds
 * @param {object} g  — Game state
 */
export const updatePlayer = (dt, g) => {
  const turnSpeed = 1.4;

  if (g.player.yaw === undefined) g.player.yaw = Math.PI / 2;

  let thrust = 0;

  if (g.touchBase && g.touchCurrent) {
    let tx = g.touchCurrent.x - g.touchBase.x;
    let ty = g.touchCurrent.y - g.touchBase.y;
    let dist = Math.hypot(tx, ty);
    if (dist > 10) {
      let nx = tx / Math.max(dist, 60);
      let ny = ty / Math.max(dist, 60);
      g.player.yaw -= nx * turnSpeed * dt * 3;
      thrust = -ny;
      if (dist > 60) {
        g.touchBase.x = g.touchCurrent.x - (tx / dist) * 60;
        g.touchBase.y = g.touchCurrent.y - (ty / dist) * 60;
      }
    }
  } else {
    if (g.keys['a'] || g.keys['arrowleft'])  g.player.yaw += turnSpeed * dt;
    if (g.keys['d'] || g.keys['arrowright']) g.player.yaw -= turnSpeed * dt;
    if (g.keys['w'] || g.keys['arrowup'])    thrust =  1;
    if (g.keys['s'] || g.keys['arrowdown'])  thrust = -1;
  }

  const currentSpeed = g.player.speed + (g.levels.thrusters - 1) * 30;
  const fwdX = Math.cos(g.player.yaw);
  const fwdY = Math.sin(g.player.yaw);
  g.player.vx = fwdX * thrust * currentSpeed;
  g.player.vy = fwdY * thrust * currentSpeed;
  g.player.x += g.player.vx * dt;
  g.player.y += g.player.vy * dt;
  g.player.x = Math.max(-4000, Math.min(4000, g.player.x));
  g.player.y = Math.max(-4000, Math.min(4000, g.player.y));
};
