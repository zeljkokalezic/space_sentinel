/**
 * systems/playerMovement.ts — Player ship movement, input handling, yaw, thrust, strafe, world bounds.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { spawnParticle } from '../pool';
import type { GameState } from '../state';

function lerpColor(ratio: number, stops: readonly { readonly ratio: number; readonly color: number }[]): number {
  ratio = Math.max(0, Math.min(1, ratio));

  if (ratio <= stops[0].ratio) return stops[0].color;
  if (ratio >= stops[stops.length - 1].ratio) return stops[stops.length - 1].color;

  let lower = stops[0], upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (ratio >= stops[i].ratio && ratio <= stops[i + 1].ratio) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const t = (ratio - lower.ratio) / (upper.ratio - lower.ratio);
  const lR = (lower.color >> 16) & 0xff, lG = (lower.color >> 8) & 0xff, lB = lower.color & 0xff;
  const uR = (upper.color >> 16) & 0xff, uG = (upper.color >> 8) & 0xff, uB = upper.color & 0xff;
  const r = Math.round(lR + (uR - lR) * t);
  const g = Math.round(lG + (uG - lG) * t);
  const b = Math.round(lB + (uB - lB) * t);
  return (r << 16) | (g << 8) | b;
}

function spawnThrustTrail(g: GameState, yaw: number, dt: number): void {
  const C = GAME_CONFIG.thrustTrail;
  if (!C.enabled) return;

  const pState = g.player as unknown as Record<string, unknown>;
  if (pState._thrustTrailTimer === undefined) pState._thrustTrailTimer = 0;
  pState._thrustTrailTimer = (pState._thrustTrailTimer as number) - dt;
  if ((pState._thrustTrailTimer as number) > 0) return;
  pState._thrustTrailTimer = 0.05;

  const currentSpeed = g.player.speed + (g.levels.thrusters - 1) * GAME_CONFIG.thrusters.speedPerLevel;
  const velocityMag = Math.hypot(g.player.vx, g.player.vy);
  const speedRatio = Math.min(1, velocityMag / currentSpeed);

  const thrustColor = C.colorStops
    ? lerpColor(speedRatio, C.colorStops)
    : C.color;

  const particleSize = C.sizeMin + (C.sizeMax - C.sizeMin) * speedRatio;
  const particleLife = C.lifeMin + (C.lifeMax - C.lifeMin) * speedRatio;

  let count = C.particlesPerFrame + Math.max(0, (g.levels.thrusters - 1) * C.particlesPerThrusterLevel);

  if (speedRatio > 0.7 && C.extraParticlesAtHighSpeed) {
    count += C.extraParticlesAtHighSpeed;
  }

  const backAngle = yaw + Math.PI;

  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * C.spreadAngle * 2;
    const particleAngle = backAngle + spread;
    const speedBoost = 1 + speedRatio * 0.5;
    const speed = (Math.random() * (C.speedMax - C.speedMin) + C.speedMin) * speedBoost;
    const spawnX = g.player.x + Math.cos(backAngle) * C.offset;
    const spawnY = g.player.y + Math.sin(backAngle) * C.offset;

    spawnParticle(g, {
      x: spawnX, y: spawnY,
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

export const updatePlayer = (dt: number, g: GameState): void => {
  const C = GAME_CONFIG;
  const turnSpeed = C.player.turnSpeed;

  if (g.player.yaw === undefined) g.player.yaw = Math.PI / 2;

  let thrust = 0;
  let strafe = 0;

  if (g.touchBase && g.touchCurrent) {
    let tx = g.touchCurrent.x - g.touchBase.x;
    let ty = g.touchCurrent.y - g.touchBase.y;
    const dist = Math.hypot(tx, ty);
    if (dist > 10) {
      const ndx = tx / Math.max(dist, 60);
      const ndy = ty / Math.max(dist, 60);

      const fwdX = Math.cos(g.player.yaw);
      const fwdY = Math.sin(g.player.yaw);
      const rightX = Math.sin(g.player.yaw);
      const rightY = -Math.cos(g.player.yaw);

      thrust = -(ndx * fwdX + ndy * fwdY);
      strafe = ndx * rightX + ndy * rightY;

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
    if (g.keys['q']) strafe = -1;
    if (g.keys['e']) strafe =  1;
  }

  const fwdX = Math.cos(g.player.yaw);
  const fwdY = Math.sin(g.player.yaw);
  const rightX = Math.sin(g.player.yaw);
  const rightY = -Math.cos(g.player.yaw);

  const currentSpeed = g.player.speed + (g.levels.thrusters - 1) * C.thrusters.speedPerLevel;
  const currentStrafeSpeed = currentSpeed * C.player.strafeSpeedRatio
    + (g.levels.thrusters - 1) * C.thrusters.strafeSpeedPerLevel;

  g.player.vx = fwdX * thrust * currentSpeed + rightX * strafe * currentStrafeSpeed;
  g.player.vy = fwdY * thrust * currentSpeed + rightY * strafe * currentStrafeSpeed;

  if (thrust > 0) {
    spawnThrustTrail(g, g.player.yaw, dt);
  }

  g.player.x += g.player.vx * dt;
  g.player.y += g.player.vy * dt;
  g.player.x = Math.max(-C.player.worldBounds, Math.min(C.player.worldBounds, g.player.x));
  g.player.y = Math.max(-C.player.worldBounds, Math.min(C.player.worldBounds, g.player.y));
};
