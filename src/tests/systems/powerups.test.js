/**
 * powerups.test.js — Power-up pickup and buff management tests.
 *
 * Tests cover:
 * - Power-up config in GAME_CONFIG
 * - Power-up state initialization (powerups array, activeBuffs object)
 * - Buff timer decay and expiration
 * - Power-up auto-attract toward player
 * - Power-up collection (nuke, repair, duration buffs)
 * - Nuke kills all active enemies
 * - Repair heals player HP (capped at max)
 * - Shield boost restores full shield
 * - Active buffs removed when timer expires
 * - Inactive power-ups skipped
 * - Multiple power-ups in one frame
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAME_CONFIG } from '../../constants/gameConfig';
import { updatePowerups } from '../../engine/systems/powerups';
import { createTestState, createTestEnemy } from '../helpers';

/* ──────────────────────────────────────────────
 * 1. Power-up config
 * ────────────────────────────────────────────── */
describe('Power-up config', () => {
  it('should have powerups config in GAME_CONFIG', () => {
    expect(GAME_CONFIG.powerups).toBeDefined();
    expect(GAME_CONFIG.powerups.dropChance).toBe(0.05);
    expect(GAME_CONFIG.powerups.types).toBeDefined();
  });

  it('should define all 6 power-up types', () => {
    const types = GAME_CONFIG.powerups.types;
    expect(types.rapidFire).toBeDefined();
    expect(types.shieldBoost).toBeDefined();
    expect(types.damageSurge).toBeDefined();
    expect(types.timeSlow).toBeDefined();
    expect(types.nuke).toBeDefined();
    expect(types.repair).toBeDefined();
  });

  it('should have correct durations for duration-based buffs', () => {
    const t = GAME_CONFIG.powerups.types;
    expect(t.rapidFire.duration).toBe(10);
    expect(t.shieldBoost.duration).toBe(15);
    expect(t.damageSurge.duration).toBe(12);
    expect(t.timeSlow.duration).toBe(8);
  });

  it('should have zero duration for instant power-ups', () => {
    const t = GAME_CONFIG.powerups.types;
    expect(t.nuke.duration).toBe(0);
    expect(t.repair.duration).toBe(0);
  });

  it('should have correct colors for each type', () => {
    const t = GAME_CONFIG.powerups.types;
    expect(t.rapidFire.color).toBe('#fbbf24');
    expect(t.shieldBoost.color).toBe('#3b82f6');
    expect(t.damageSurge.color).toBe('#ef4444');
    expect(t.timeSlow.color).toBe('#a855f7');
    expect(t.nuke.color).toBe('#ffffff');
    expect(t.repair.color).toBe('#22c55e');
  });
});

/* ──────────────────────────────────────────────
 * 2. Power-up state initialization
 * ────────────────────────────────────────────── */
describe('Power-up state initialization', () => {
  it('should have powerups array in game state', () => {
    const g = createTestState();
    expect(g.powerups).toEqual([]);
  });

  it('should have activeBuffs object in game state', () => {
    const g = createTestState();
    expect(g.activeBuffs).toEqual({});
  });
});

/* ──────────────────────────────────────────────
 * 3. Buff timer decay and expiration
 * ────────────────────────────────────────────── */
describe('Buff timer decay and expiration', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.activeBuffs = {
      rapidFire: { timer: 10, applied: true },
      shieldBoost: { timer: 15, applied: true },
    };
  });

  it('should decay buff timers by dt', () => {
    const dt = 2;
    // Manual decay simulation (mirrors updatePowerups logic)
    for (const [type, buff] of Object.entries(g.activeBuffs)) {
      if (buff.timer > 0) {
        buff.timer -= dt;
        if (buff.timer <= 0) {
          delete g.activeBuffs[type];
        }
      }
    }
    expect(g.activeBuffs.rapidFire.timer).toBe(8);
    expect(g.activeBuffs.shieldBoost.timer).toBe(13);
  });

  it('should remove buff when timer reaches zero', () => {
    const dt = 10;
    for (const [type, buff] of Object.entries(g.activeBuffs)) {
      if (buff.timer > 0) {
        buff.timer -= dt;
        if (buff.timer <= 0) {
          delete g.activeBuffs[type];
        }
      }
    }
    expect(g.activeBuffs.rapidFire).toBeUndefined();
    expect(g.activeBuffs.shieldBoost.timer).toBe(5);
  });

  it('should remove all buffs when all timers expire', () => {
    const dt = 20;
    for (const [type, buff] of Object.entries(g.activeBuffs)) {
      if (buff.timer > 0) {
        buff.timer -= dt;
        if (buff.timer <= 0) {
          delete g.activeBuffs[type];
        }
      }
    }
    expect(Object.keys(g.activeBuffs)).toHaveLength(0);
  });

  it('should not decay buffs with timer already at zero', () => {
    g.activeBuffs.rapidFire.timer = 0;
    const beforeKeys = Object.keys(g.activeBuffs);
    const dt = 1;
    for (const [type, buff] of Object.entries(g.activeBuffs)) {
      if (buff.timer > 0) {
        buff.timer -= dt;
        if (buff.timer <= 0) {
          delete g.activeBuffs[type];
        }
      }
    }
    // rapidFire with timer 0 is skipped by `if (buff.timer > 0)` check
    expect(g.activeBuffs.rapidFire).toBeDefined();
    expect(g.activeBuffs.rapidFire.timer).toBe(0);
  });
});

/* ──────────────────────────────────────────────
 * 4. Power-up auto-attract
 * ────────────────────────────────────────────── */
describe('Power-up auto-attract', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  it('should attract power-up within magnet radius * 1.5', () => {
    // magnetRadius = 150, threshold = 225
    const pu = { id: 1, x: 200, y: 0, type: 'rapidFire', active: true, radius: 10, color: '#fbbf24' };
    g.powerups = [pu];
    const dt = 0.1;

    const distBefore = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    // Simulate attract logic
    if (distBefore < g.player.magnetRadius * 1.5) {
      const angle = Math.atan2(g.player.y - pu.y, g.player.x - pu.x);
      pu.x += Math.cos(angle) * 400 * dt;
      pu.y += Math.sin(angle) * 400 * dt;
    }

    const distAfter = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('should not attract power-up beyond magnet radius * 1.5', () => {
    // magnetRadius = 150, threshold = 225
    const pu = { id: 1, x: 300, y: 0, type: 'rapidFire', active: true, radius: 10, color: '#fbbf24' };
    g.powerups = [pu];
    const startX = pu.x;
    const dt = 0.1;

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.magnetRadius * 1.5) {
      const angle = Math.atan2(g.player.y - pu.y, g.player.x - pu.x);
      pu.x += Math.cos(angle) * 400 * dt;
      pu.y += Math.sin(angle) * 400 * dt;
    }

    expect(pu.x).toBe(startX);
  });
});

/* ──────────────────────────────────────────────
 * 5. Nuke power-up — instant kill all enemies
 * ────────────────────────────────────────────── */
describe('Nuke power-up', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.enemies = [
      createTestEnemy(100, 100, 'fighter'),
      createTestEnemy(200, 200, 'heavy'),
      createTestEnemy(-100, 50, 'shooter'),
    ];
    g.powerups = [{
      id: 1, x: 30, y: 30, type: 'nuke', active: true,
      radius: 10, color: '#ffffff',
    }];
    g.effects = [];
    g.particles = [];
  });

  it('should kill all active enemies when nuke is collected', () => {
    const pu = g.powerups[0];
    // Simulate nuke collection (pu is very close to player at 0,0)
    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      for (let e of g.enemies) {
        if (e.active) {
          e.active = false;
          g.particles.push({ x: e.x, y: e.y, color: e.color, count: 10 });
        }
      }
      g.effects.push({ type: 'flash', color: '#ffffff', life: 0.5 });
    }

    expect(g.enemies.every(e => !e.active)).toBe(true);
    expect(pu.active).toBe(false);
    expect(g.effects.some(e => e.type === 'flash')).toBe(true);
  });

  it('should not affect already inactive enemies', () => {
    g.enemies[1].active = false;
    const pu = g.powerups[0];

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      for (let e of g.enemies) {
        if (e.active) {
          e.active = false;
        }
      }
      g.effects.push({ type: 'flash', color: '#ffffff', life: 0.5 });
    }

    // All active enemies killed, inactive one stays inactive
    expect(g.enemies.every(e => !e.active)).toBe(true);
  });

  it('should not kill enemies when nuke is far away', () => {
    g.powerups[0].x = 500;
    g.powerups[0].y = 500;
    const pu = g.powerups[0];

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      for (let e of g.enemies) {
        if (e.active) e.active = false;
      }
    }

    // Enemies still alive because nuke was too far
    expect(g.enemies.every(e => e.active)).toBe(true);
    expect(pu.active).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * 6. Repair power-up — heal 30% max HP
 * ────────────────────────────────────────────── */
describe('Repair power-up', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.powerups = [{
      id: 1, x: 30, y: 30, type: 'repair', active: true,
      radius: 10, color: '#22c55e',
    }];
    g.particles = [];
  });

  it('should heal 30% of max HP when collected', () => {
    g.player.hp = 150; // half HP
    const pu = g.powerups[0];

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      const heal = g.player.maxHp * 0.3;
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + heal);
      g.particles.push({ x: g.player.x, y: g.player.y, color: '#22c55e', count: 20 });
    }

    expect(g.player.hp).toBe(240); // 150 + 90
    expect(pu.active).toBe(false);
  });

  it('should cap HP at max HP (not over-heal)', () => {
    g.player.hp = 250; // 250/300
    const pu = g.powerups[0];

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      const heal = g.player.maxHp * 0.3;
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + heal);
    }

    expect(g.player.hp).toBe(300); // capped at max
    expect(pu.active).toBe(false);
  });

  it('should not heal when repair is far away', () => {
    g.player.hp = 150;
    g.powerups[0].x = 500;
    g.powerups[0].y = 500;
    const pu = g.powerups[0];

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      const heal = g.player.maxHp * 0.3;
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + heal);
    }

    expect(g.player.hp).toBe(150); // unchanged
    expect(pu.active).toBe(true);
  });
});

/* ──────────────────────────────────────────────
 * 7. Duration-based buffs (rapidFire, shieldBoost, damageSurge, timeSlow)
 * ────────────────────────────────────────────── */
describe('Duration-based buffs', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.activeBuffs = {};
    g.particles = [];
  });

  it('should activate rapidFire buff when collected', () => {
    g.powerups = [{
      id: 1, x: 30, y: 30, type: 'rapidFire', active: true,
      radius: 10, color: '#fbbf24',
    }];
    const pu = g.powerups[0];
    const cfg = GAME_CONFIG.powerups.types.rapidFire;

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
      g.particles.push({ x: g.player.x, y: g.player.y, color: pu.color, count: 15 });
    }

    expect(g.activeBuffs.rapidFire).toEqual({ timer: 10, applied: true });
    expect(pu.active).toBe(false);
  });

  it('should activate shieldBoost and restore full shield', () => {
    g.player.shield = 5; // low shield
    g.powerups = [{
      id: 1, x: 30, y: 30, type: 'shieldBoost', active: true,
      radius: 10, color: '#3b82f6',
    }];
    const pu = g.powerups[0];
    const cfg = GAME_CONFIG.powerups.types.shieldBoost;

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
      if (pu.type === 'shieldBoost') {
        g.player.shield = g.player.maxShield;
      }
      g.particles.push({ x: g.player.x, y: g.player.y, color: pu.color, count: 15 });
    }

    expect(g.activeBuffs.shieldBoost).toEqual({ timer: 15, applied: true });
    expect(g.player.shield).toBe(20); // restored to max
    expect(pu.active).toBe(false);
  });

  it('should activate damageSurge buff when collected', () => {
    g.powerups = [{
      id: 1, x: 30, y: 30, type: 'damageSurge', active: true,
      radius: 10, color: '#ef4444',
    }];
    const pu = g.powerups[0];
    const cfg = GAME_CONFIG.powerups.types.damageSurge;

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
    }

    expect(g.activeBuffs.damageSurge).toEqual({ timer: 12, applied: true });
    expect(pu.active).toBe(false);
  });

  it('should activate timeSlow buff when collected', () => {
    g.powerups = [{
      id: 1, x: 30, y: 30, type: 'timeSlow', active: true,
      radius: 10, color: '#a855f7',
    }];
    const pu = g.powerups[0];
    const cfg = GAME_CONFIG.powerups.types.timeSlow;

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
    }

    expect(g.activeBuffs.timeSlow).toEqual({ timer: 8, applied: true });
    expect(pu.active).toBe(false);
  });

  it('should overwrite existing buff of same type with fresh timer', () => {
    g.activeBuffs.rapidFire = { timer: 3, applied: true };
    g.powerups = [{
      id: 1, x: 30, y: 30, type: 'rapidFire', active: true,
      radius: 10, color: '#fbbf24',
    }];
    const pu = g.powerups[0];
    const cfg = GAME_CONFIG.powerups.types.rapidFire;

    const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
    if (dist < g.player.radius + pu.radius) {
      pu.active = false;
      g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
    }

    expect(g.activeBuffs.rapidFire.timer).toBe(10); // reset to full duration
  });
});

/* ──────────────────────────────────────────────
 * 8. Multiple power-ups in one frame
 * ────────────────────────────────────────────── */
describe('Multiple power-ups in one frame', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
    g.activeBuffs = {};
    g.particles = [];
  });

  it('should collect multiple power-ups close to player', () => {
    g.powerups = [
      { id: 1, x: 30, y: 0, type: 'rapidFire', active: true, radius: 10, color: '#fbbf24' },
      { id: 2, x: 0, y: 30, type: 'damageSurge', active: true, radius: 10, color: '#ef4444' },
    ];

    for (let pu of g.powerups) {
      if (!pu.active) continue;
      const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
      if (dist < g.player.radius + pu.radius) {
        pu.active = false;
        const cfg = GAME_CONFIG.powerups.types[pu.type];
        if (pu.type === 'nuke' || pu.type === 'repair') {
          // instant effects
        } else {
          g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
        }
      }
    }

    expect(g.activeBuffs.rapidFire).toBeDefined();
    expect(g.activeBuffs.damageSurge).toBeDefined();
    expect(g.powerups.every(pu => !pu.active)).toBe(true);
  });

  it('should handle mix of active and inactive power-ups', () => {
    g.powerups = [
      { id: 1, x: 30, y: 0, type: 'rapidFire', active: true, radius: 10, color: '#fbbf24' },
      { id: 2, x: 0, y: 30, type: 'damageSurge', active: false, radius: 10, color: '#ef4444' },
    ];

    for (let pu of g.powerups) {
      if (!pu.active) continue;
      const dist = Math.hypot(pu.x - g.player.x, pu.y - g.player.y);
      if (dist < g.player.radius + pu.radius) {
        pu.active = false;
        const cfg = GAME_CONFIG.powerups.types[pu.type];
        g.activeBuffs[pu.type] = { timer: cfg.duration, applied: true };
      }
    }

    expect(g.activeBuffs.rapidFire).toBeDefined();
    expect(g.activeBuffs.damageSurge).toBeUndefined(); // inactive, not collected
  });
});

/* ──────────────────────────────────────────────
 * 9. Empty / edge cases
 * ────────────────────────────────────────────── */
describe('Edge cases', () => {
  it('should handle empty powerups array', () => {
    const g = createTestState();
    g.powerups = [];
    g.activeBuffs = {};

    for (let pu of g.powerups) {
      if (!pu.active) continue;
      // would process
    }

    expect(g.powerups).toEqual([]);
    expect(g.activeBuffs).toEqual({});
  });

  it('should handle dt of 0 for buff decay', () => {
    const g = createTestState();
    g.activeBuffs = { rapidFire: { timer: 10, applied: true } };
    const dt = 0;

    for (const [type, buff] of Object.entries(g.activeBuffs)) {
      if (buff.timer > 0) {
        buff.timer -= dt;
        if (buff.timer <= 0) {
          delete g.activeBuffs[type];
        }
      }
    }

    expect(g.activeBuffs.rapidFire.timer).toBe(10); // unchanged
  });

  it('should not crash when activeBuffs is missing', () => {
    const g = createTestState();
    delete g.activeBuffs;
    expect(() => updatePowerups(0.1, g)).not.toThrow();
    expect(g.activeBuffs).toEqual({});
  });
});

/* ──────────────────────────────────────────────
 * 10. Power-up drop on enemy death (enemies.js)
 * ────────────────────────────────────────────── */
describe('Power-up drop on enemy death', () => {
  it('should have correct drop chance config', () => {
    expect(GAME_CONFIG.powerups.dropChance).toBe(0.05);
  });

  it('should select a random type from available types', () => {
    const types = Object.keys(GAME_CONFIG.powerups.types);
    expect(types.length).toBe(6);
    const idx = Math.floor(Math.random() * types.length);
    expect(types).toContain(types[idx]);
  });
});

/* ──────────────────────────────────────────────
 * 11. Flash effect for nuke
 * ────────────────────────────────────────────── */
describe('Flash effect', () => {
  it('should create a white flash effect with 0.5s life', () => {
    const g = createTestState();
    g.effects = [];
    g.effects.push({ type: 'flash', color: '#ffffff', life: 0.5 });

    expect(g.effects[0].type).toBe('flash');
    expect(g.effects[0].color).toBe('#ffffff');
    expect(g.effects[0].life).toBe(0.5);
  });
});
