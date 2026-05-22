/**
 * beacon.js — Beacon defense system.
 * Handles beacon collision with enemy projectiles/enemies,
 * enemy targeting, and mission timer progress.
 */

import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles, spawnDamageNumber } from '../combat';

export const updateBeacon = (dt, g, currentDiffMult, completeMission, setGameState) => {
  if (!g.beacon || !g.beacon.active || g.mission?.completed) return false;

  const beacon = g.beacon;
  const cfg = GAME_CONFIG.beacon;

  // Enemy projectile collision with beacon
  for (let p of g.projectiles) {
    if (!p.active || !p.isEnemy) continue;
    const dx = beacon.x - p.x;
    const dy = beacon.y - p.y;
    if (Math.hypot(dx, dy) < beacon.radius + (p.radius || 5)) {
      p.active = false;
      beacon.hp -= 10 * currentDiffMult;
      createParticles(g, p.x, p.y, 0x22d3ee, 5);
      spawnDamageNumber(g, beacon.x, beacon.y - 20, 10 * currentDiffMult, { hitType: 'hull', life: 1.0 });
    }
  }

  // Enemy collision with beacon (ramming)
  for (let e of g.enemies) {
    if (!e.active) continue;
    const dx = beacon.x - e.x;
    const dy = beacon.y - e.y;
    if (Math.hypot(dx, dy) < beacon.radius + e.radius) {
      e._beaconRamCooldown = (e._beaconRamCooldown || 0) - dt;
      if (e._beaconRamCooldown <= 0) {
        beacon.hp -= 15;
        e.hp -= 20;
        createParticles(g, e.x, e.y, 0x22d3ee, 5);
        e._beaconRamCooldown = 1.0;
      }
    }
  }

  // Beacon destroyed — game over
  if (beacon.hp <= 0) {
    beacon.active = false;
    // Spawn explosion particles
    for (let i = 0; i < 20; i++) {
      g.particles.push({
        x: beacon.x, y: beacon.y,
        vx: (Math.random()-0.5)*200,
        vy: (Math.random()-0.5)*200,
        life: 1.5,
        maxLife: 1.5,
        active: true,
        color: 0x22d3ee,
      });
    }
    setGameState('gameover');
    return true;
  }

  // Enemy targeting — enemies within defenseRadius aim at beacon instead of player
  for (let e of g.enemies) {
    if (!e.active) continue;
    const dx = beacon.x - e.x;
    const dy = beacon.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < cfg.defenseRadius) {
      e.targetX = beacon.x;
      e.targetY = beacon.y;
    } else {
      e.targetX = g.player.x;
      e.targetY = g.player.y;
    }
  }

  return false;
};
