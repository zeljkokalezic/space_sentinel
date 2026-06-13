/**
 * systems/sabotage.ts — Sabotage mission: destroy enemy structures.
 * Structures fire at the player, take damage from player projectiles,
 * and bias nearby enemies toward targeting them.
 */

import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles } from '../combat';
import { spawnEffect, spawnPickup, spawnProjectileEntity } from '../pool';
import type { GameState, SabotageState } from '../state';

type Structure = SabotageState['structures'][number];

interface Projectile {
  active: boolean;
  isEnemy?: boolean;
  x: number; y: number;
  radius?: number;
  damage: number;
}

interface Enemy {
  active: boolean;
  x: number; y: number;
  targetX?: number; targetY?: number;
}

/**
 * @param dt — Delta time
 * @param g — Game state
 * @param currentDiffMult — Difficulty multiplier
 * @param completeMission — Mission completion callback
 * @returns true if game should stop (gameover triggered)
 */
export const updateSabotage = (
  dt: number,
  g: GameState,
  currentDiffMult: number,
  completeMission: () => void,
): boolean => {
  if (!g.sabotage.active || !g.mission || g.mission.completed) return false;

  const cfg = GAME_CONFIG.sabotage;
  const structures = g.sabotage.structures;

  // Filter active structures
  const alive = structures.filter((s: Structure) => s.active && s.hp > 0);

  // All structures destroyed — mission complete
  if (alive.length === 0) {
    g.mission.current = g.mission.target;
    completeMission();
    return false;
  }

  // ── Structure AI: fire at player ──
  for (const s of alive) {
    s.fireCooldown -= dt;
    if (s.fireCooldown <= 0) {
      s.fireCooldown = cfg.fireCooldown;
      const dx = g.player.x - s.x;
      const dy = g.player.y - s.y;
      const angle = Math.atan2(dy, dx);
      spawnProjectileEntity(g, {
        id: Math.random(),
        x: s.x + Math.cos(angle) * (s.radius + 5),
        y: s.y + Math.sin(angle) * (s.radius + 5),
        vx: Math.cos(angle) * cfg.projectileSpeed,
        vy: Math.sin(angle) * cfg.projectileSpeed,
        damage: cfg.projectileDamage * currentDiffMult,
        radius: 5,
        color: cfg.color,
        active: true,
        isEnemy: true,
        life: 0,
      });
    }
  }

  // ── Player projectile collision with structures ──
  for (const p of g.projectiles as Projectile[]) {
    if (!p.active || p.isEnemy) continue;
    for (const s of alive) {
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      if (Math.hypot(dx, dy) < s.radius + (p.radius || 5)) {
        s.hp -= p.damage;
        p.active = false;
        createParticles(g, p.x, p.y, cfg.color, 5);
        spawnEffect(g, {
          type: 'dmg',
          x: s.x,
          y: s.y - s.radius - 10,
          text: Math.ceil(p.damage).toString(),
          life: 0.8,
        });

        // Structure destroyed
        if (s.hp <= 0) {
          s.active = false;
          createParticles(g, s.x, s.y, cfg.color, 20);
          // Drop scrap
          spawnPickup(g, {
            id: Math.random(),
            x: s.x + (Math.random() - 0.5) * 30,
            y: s.y + (Math.random() - 0.5) * 30,
            value: cfg.scrapPerDestroy,
            active: true,
            radius: 6,
          });
        }
        break;
      }
    }
  }

  // ── Enemy targeting bias: enemies near structures aim at them ──
  for (const e of g.enemies as Enemy[]) {
    if (!e.active) continue;
    let nearestStruct: Structure | null = null;
    let nearestDist: number = cfg.protectRadius;

    for (const s of alive) {
      const dist = Math.hypot(s.x - e.x, s.y - e.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStruct = s;
      }
    }

    if (nearestStruct) {
      e.targetX = nearestStruct.x;
      e.targetY = nearestStruct.y;
    } else {
      e.targetX = g.player.x;
      e.targetY = g.player.y;
    }
  }

  return false;
};
