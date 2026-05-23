/**
 * bossSignatureMechanics.test.js — Boss signature mechanic config + state tests.
 *
 * Verifies:
 * - Each boss variant in BOSS_ROSTER has a signatureMechanic defined
 * - Each signatureMechanic has the correct type and expected fields
 * - Default boss state includes all mechanic-related fields
 * - Integration: bossCore wires signature mechanics, projectiles call onBossDamaged
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BOSS_ROSTER } from '../constants/bosses';
import { createGameState } from '../engine/state';
import { setupLocalStorageMock, clearLocalStorageMock, createTestState } from './helpers';
import {
  updateBossSignatureMechanics,
  onBossDamaged,
  checkVoidZoneCollision,
  updateDecoy,
} from '../engine/systems/bossSignatureMechanics';

describe('Boss signature mechanics — config', () => {
  beforeEach(setupLocalStorageMock);
  afterEach(clearLocalStorageMock);

  /* ──────────────────────────────────────────────
   * 1. All bosses have signatureMechanic
   * ────────────────────────────────────────────── */
  describe('signatureMechanic presence', () => {
    it('every boss in BOSS_ROSTER has a signatureMechanic', () => {
      for (const boss of BOSS_ROSTER) {
        expect(boss.signatureMechanic).toBeDefined();
      }
    });

    it('all signatureMechanic types are unique', () => {
      const types = BOSS_ROSTER.map(b => b.signatureMechanic.type);
      const unique = new Set(types);
      expect(unique.size).toBe(types.length);
    });

    it('there are exactly 3 boss variants', () => {
      expect(BOSS_ROSTER.length).toBe(3);
    });
  });

  /* ──────────────────────────────────────────────
   * 2. Void Reaper — void_zones
   * ────────────────────────────────────────────── */
  describe('Void Reaper (void_zones)', () => {
    let boss;

    beforeEach(() => {
      boss = BOSS_ROSTER.find(b => b.id === 'void_reaper');
    });

    it('has the correct id', () => {
      expect(boss.id).toBe('void_reaper');
    });

    it('has type void_zones', () => {
      expect(boss.signatureMechanic.type).toBe('void_zones');
    });

    it('has zoneDamagePerSecond of 10', () => {
      expect(boss.signatureMechanic.zoneDamagePerSecond).toBe(10);
    });

    it('has zoneSlowFactor of 0.7', () => {
      expect(boss.signatureMechanic.zoneSlowFactor).toBe(0.7);
    });

    it('has zoneLifetime of 8', () => {
      expect(boss.signatureMechanic.zoneLifetime).toBe(8);
    });

    it('has spawnInterval of 12', () => {
      expect(boss.signatureMechanic.spawnInterval).toBe(12);
    });

    it('has maxZones of 3', () => {
      expect(boss.signatureMechanic.maxZones).toBe(3);
    });

    it('has phase2SpawnInterval of 8', () => {
      expect(boss.signatureMechanic.phase2SpawnInterval).toBe(8);
    });
  });

  /* ──────────────────────────────────────────────
   * 3. Nexus Prime — shield_regen
   * ────────────────────────────────────────────── */
  describe('Nexus Prime (shield_regen)', () => {
    let boss;

    beforeEach(() => {
      boss = BOSS_ROSTER.find(b => b.id === 'nexus_prime');
    });

    it('has the correct id', () => {
      expect(boss.id).toBe('nexus_prime');
    });

    it('has type shield_regen', () => {
      expect(boss.signatureMechanic.type).toBe('shield_regen');
    });

    it('has regenPercentPerSecond of 0.05', () => {
      expect(boss.signatureMechanic.regenPercentPerSecond).toBe(0.05);
    });

    it('has noDamageThreshold of 3', () => {
      expect(boss.signatureMechanic.noDamageThreshold).toBe(3);
    });

    it('has visualBuildupTime of 3', () => {
      expect(boss.signatureMechanic.visualBuildupTime).toBe(3);
    });
  });

  /* ──────────────────────────────────────────────
   * 4. Phantom Warden — phase_shift
   * ────────────────────────────────────────────── */
  describe('Phantom Warden (phase_shift)', () => {
    let boss;

    beforeEach(() => {
      boss = BOSS_ROSTER.find(b => b.id === 'phantom_warden');
    });

    it('has the correct id', () => {
      expect(boss.id).toBe('phantom_warden');
    });

    it('has type phase_shift', () => {
      expect(boss.signatureMechanic.type).toBe('phase_shift');
    });

    it('has teleportInterval of 15', () => {
      expect(boss.signatureMechanic.teleportInterval).toBe(15);
    });

    it('has decoyLifetime of 3', () => {
      expect(boss.signatureMechanic.decoyLifetime).toBe(3);
    });

    it('has decoyFireRate of 1.0', () => {
      expect(boss.signatureMechanic.decoyFireRate).toBe(1.0);
    });

    it('has decoyProjectileDamage of 15', () => {
      expect(boss.signatureMechanic.decoyProjectileDamage).toBe(15);
    });
  });
});

describe('Boss signature mechanics — state', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  /* ──────────────────────────────────────────────
   * 5. voidZones default
   * ────────────────────────────────────────────── */
  describe('voidZones', () => {
    it('is an empty array by default', () => {
      expect(Array.isArray(state.boss.voidZones)).toBe(true);
      expect(state.boss.voidZones.length).toBe(0);
    });

    it('is independent across state instances', () => {
      const s2 = createGameState();
      expect(state.boss.voidZones).not.toBe(s2.boss.voidZones);
      state.boss.voidZones.push({ x: 0, y: 0, radius: 50, life: 8, maxLife: 8, active: true });
      expect(s2.boss.voidZones.length).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 6. regenTimer default
   * ────────────────────────────────────────────── */
  describe('regenTimer', () => {
    it('defaults to 0', () => {
      expect(state.boss.regenTimer).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 7. regenActive default
   * ────────────────────────────────────────────── */
  describe('regenActive', () => {
    it('defaults to false', () => {
      expect(state.boss.regenActive).toBe(false);
    });
  });

  /* ──────────────────────────────────────────────
   * 8. phaseShiftTimer default
   * ────────────────────────────────────────────── */
  describe('phaseShiftTimer', () => {
    it('defaults to 0', () => {
      expect(state.boss.phaseShiftTimer).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 9. decoy default
   * ────────────────────────────────────────────── */
  describe('decoy', () => {
    it('defaults to null', () => {
      expect(state.boss.decoy).toBeNull();
    });
  });

  /* ──────────────────────────────────────────────
   * 10. All mechanic fields exist on boss state
   * ────────────────────────────────────────────── */
  describe('all mechanic fields present', () => {
    it('boss state has all 5 signature mechanic fields', () => {
      const expectedFields = ['voidZones', 'regenTimer', 'regenActive', 'phaseShiftTimer', 'decoy'];
      for (const field of expectedFields) {
        expect(state.boss).toHaveProperty(field);
      }
    });
  });
});

/* ──────────────────────────────────────────────
 * SYSTEM MODULE TESTS
 * ────────────────────────────────────────────── */

describe('Boss signature mechanics — system module', () => {
  beforeEach(setupLocalStorageMock);
  afterEach(clearLocalStorageMock);

  /* ──────────────────────────────────────────────
   * Void Zones — spawn and damage
   * ────────────────────────────────────────────── */
  describe('void_zones — spawn and damage', () => {
    let g, boss;

    beforeEach(() => {
      g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
        boss: {
          active: true,
          x: 500, y: 500,
          hp: 1500, maxHp: 1500,
          phase: 1,
          attackTimer: 0,
          chargeTimer: 0,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          radius: 60,
          speed: 60,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 0,
          regenActive: false,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: {
            type: 'void_zones',
            zoneDamagePerSecond: 10,
            zoneSlowFactor: 0.7,
            zoneLifetime: 8,
            spawnInterval: 1,
            maxZones: 3,
            phase2SpawnInterval: 8,
          },
          voidZoneSpawnTimer: 0,
        },
      });
      boss = g.boss;
    });

    it('spawns a void zone when spawn timer expires', () => {
      expect(boss.voidZones.length).toBe(0);
      updateBossSignatureMechanics(0.016, boss, g);
      expect(boss.voidZones.length).toBe(1);
    });

    it('respects maxZones limit', () => {
      // Spawn 3 zones (maxZones = 3)
      for (let i = 0; i < 3; i++) {
        boss.voidZoneSpawnTimer = 0;
        updateBossSignatureMechanics(0.016, boss, g);
      }
      expect(boss.voidZones.length).toBe(3);

      // Next tick should not spawn a 4th
      boss.voidZoneSpawnTimer = 0;
      updateBossSignatureMechanics(0.016, boss, g);
      expect(boss.voidZones.length).toBe(3);
    });

    it('void zones are spawned 300-800 units from player', () => {
      boss.voidZoneSpawnTimer = 0;
      updateBossSignatureMechanics(0.016, boss, g);
      const zone = boss.voidZones[0];
      const dist = Math.hypot(zone.x - g.player.x, zone.y - g.player.y);
      expect(dist).toBeGreaterThanOrEqual(300);
      expect(dist).toBeLessThanOrEqual(800);
    });

    it('removes expired void zones', () => {
      // Add a zone that's about to expire
      boss.voidZones.push({
        x: 100, y: 100, radius: 60,
        life: 0.1, maxLife: 8, active: true,
      });
      // Prevent new spawns during this test
      boss.voidZoneSpawnTimer = 999;
      expect(boss.voidZones.length).toBe(1);

      // Advance time past lifetime
      updateBossSignatureMechanics(1, boss, g);
      expect(boss.voidZones.length).toBe(0);
    });

    it('player takes damage when inside a void zone', () => {
      // Place player inside a void zone
      boss.voidZones.push({
        x: 0, y: 0, radius: 60,
        life: 8, maxLife: 8, active: true,
      });

      const initialHp = g.player.hp;
      g.player._inVoidZone = true;

      // Simulate 2 seconds of being in the zone
      updateBossSignatureMechanics(2, boss, g);

      // Should have taken ~20 damage (10 dps * 2s)
      expect(g.player.hp).toBeCloseTo(initialHp - 20, 0);
    });

    it('player speed is reduced in void zone', () => {
      const initialSpeed = g.player.speed;
      boss.voidZones.push({
        x: 0, y: 0, radius: 60,
        life: 8, maxLife: 8, active: true,
      });

      checkVoidZoneCollision(g);

      // Speed should be reduced by slowFactor (0.7)
      expect(g.player.speed).toBeCloseTo(initialSpeed * 0.7, 0);
    });

    it('player speed restored when leaving void zone', () => {
      const initialSpeed = g.player.speed;
      boss._originalSpeed = initialSpeed;
      g.player._inVoidZone = true;
      g.player.speed = initialSpeed * 0.7;

      // No active zones near player
      boss.voidZones = [];

      checkVoidZoneCollision(g);

      expect(g.player.speed).toBe(initialSpeed);
    });
  });

  /* ──────────────────────────────────────────────
   * Shield Regen — activates after 3s without damage
   * ────────────────────────────────────────────── */
  describe('shield_regen — activates after threshold', () => {
    let g, boss;

    beforeEach(() => {
      g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
        boss: {
          active: true,
          x: 500, y: 500,
          hp: 1000, maxHp: 1500,
          phase: 1,
          attackTimer: 0,
          chargeTimer: 0,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          radius: 60,
          speed: 60,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 0,
          regenActive: false,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: {
            type: 'shield_regen',
            regenPercentPerSecond: 0.05,
            noDamageThreshold: 3,
            visualBuildupTime: 3,
          },
        },
      });
      boss = g.boss;
    });

    it('does not regenerate before threshold', () => {
      const initialHp = boss.hp;

      // 2 seconds without damage — below 3s threshold
      updateBossSignatureMechanics(2, boss, g);

      expect(boss.regenTimer).toBe(2);
      expect(boss.regenActive).toBe(false);
      expect(boss.hp).toBe(initialHp);
    });

    it('activates regeneration after 3s without damage', () => {
      const initialHp = boss.hp;

      // Advance past threshold
      updateBossSignatureMechanics(3.1, boss, g);

      expect(boss.regenTimer).toBe(3.1);
      expect(boss.regenActive).toBe(true);
      // Should have regenerated some HP
      expect(boss.hp).toBeGreaterThan(initialHp);
    });

    it('regenerates at correct rate (5% of maxHp per second)', () => {
      boss.regenTimer = 4; // already past threshold

      const initialHp = boss.hp;
      const expectedRegen = boss.maxHp * 0.05 * 2; // 2 seconds at 5% per sec

      updateBossSignatureMechanics(2, boss, g);

      expect(boss.hp).toBeCloseTo(initialHp + expectedRegen, 0);
    });

    it('caps regeneration at maxHp', () => {
      boss.hp = boss.maxHp - 10;
      boss.regenTimer = 4;

      // Advance enough time to exceed maxHp
      updateBossSignatureMechanics(10, boss, g);

      expect(boss.hp).toBe(boss.maxHp);
    });

    it('onBossDamaged resets regenTimer to 0', () => {
      boss.regenTimer = 5;
      boss.regenActive = true;

      onBossDamaged(boss);

      expect(boss.regenTimer).toBe(0);
      expect(boss.regenActive).toBe(false);
    });

    it('onBossDamaged only affects shield_regen type', () => {
      boss.signatureMechanic.type = 'void_zones';
      boss.regenTimer = 5;
      boss.regenActive = true;

      onBossDamaged(boss);

      // Should not have changed
      expect(boss.regenTimer).toBe(5);
      expect(boss.regenActive).toBe(true);
    });
  });

  /* ──────────────────────────────────────────────
   * Phase Shift — teleports boss and creates decoy
   * ────────────────────────────────────────────── */
  describe('phase_shift — teleport and decoy', () => {
    let g, boss;

    beforeEach(() => {
      g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
        boss: {
          active: true,
          x: 500, y: 500,
          hp: 1200, maxHp: 1200,
          phase: 1,
          attackTimer: 0,
          chargeTimer: 0,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          radius: 60,
          speed: 80,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 0,
          regenActive: false,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: {
            type: 'phase_shift',
            teleportInterval: 15,
            decoyLifetime: 3,
            decoyFireRate: 1.0,
            decoyProjectileDamage: 15,
          },
        },
      });
      boss = g.boss;
    });

    it('initializes phaseShiftTimer from config', () => {
      expect(boss.phaseShiftTimer).toBe(0);

      updateBossSignatureMechanics(0.016, boss, g);

      // Set to 15 then decremented by dt, so close to 15
      expect(boss.phaseShiftTimer).toBeCloseTo(15, 1);
    });

    it('teleports boss to an edge when timer expires', () => {
      const oldX = boss.x;
      const oldY = boss.y;

      // Advance past the teleport interval
      updateBossSignatureMechanics(15.1, boss, g);

      // Boss should have moved
      expect(boss.x).not.toBe(oldX);
      expect(boss.y).not.toBe(oldY);
    });

    it('creates a decoy at the old position', () => {
      const oldX = boss.x;
      const oldY = boss.y;

      updateBossSignatureMechanics(15.1, boss, g);

      expect(boss.decoy).not.toBeNull();
      expect(boss.decoy.x).toBe(oldX);
      expect(boss.decoy.y).toBe(oldY);
    });

    it('decoy has 50 HP', () => {
      updateBossSignatureMechanics(15.1, boss, g);

      expect(boss.decoy.hp).toBe(50);
      expect(boss.decoy.maxHp).toBe(50);
    });

    it('decoy fires projectiles at the player', () => {
      updateBossSignatureMechanics(15.1, boss, g);

      expect(g.projectiles.length).toBe(0);

      // Decoy should fire shortly after spawning (fireTimer starts at 0.5)
      updateBossSignatureMechanics(0.6, boss, g);

      expect(g.projectiles.length).toBeGreaterThanOrEqual(1);
      expect(g.projectiles[0].damage).toBe(15);
    });

    it('decoy expires after its lifetime', () => {
      updateBossSignatureMechanics(15.1, boss, g);
      expect(boss.decoy.active).toBe(true);

      // Advance past decoy lifetime (3s)
      updateBossSignatureMechanics(3.1, boss, g);

      expect(boss.decoy).toBeNull();
    });

    it('phaseShiftTimer resets after teleport', () => {
      updateBossSignatureMechanics(15.1, boss, g);

      // Timer should have been reset for next teleport
      expect(boss.phaseShiftTimer).toBeGreaterThan(0);
    });
  });

  /* ──────────────────────────────────────────────
   * updateDecoy — standalone
   * ────────────────────────────────────────────── */
  describe('updateDecoy', () => {
    let g;

    beforeEach(() => {
      g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
      });
    });

    it('decrements decoy lifetime', () => {
      const decoy = {
        active: true,
        x: 100, y: 100,
        hp: 50, maxHp: 50,
        radius: 30,
        life: 3, maxLife: 3,
        fireTimer: 0,
        fireRate: 1.0,
        damage: 15,
        projectileSpeed: 350,
        color: 0x22d3ee,
      };

      updateDecoy(1, decoy, g);
      expect(decoy.life).toBe(2);
    });

    it('returns false when decoy expires', () => {
      const decoy = {
        active: true,
        x: 100, y: 100,
        hp: 50, maxHp: 50,
        radius: 30,
        life: 0.5, maxLife: 3,
        fireTimer: 0,
        fireRate: 1.0,
        damage: 15,
        projectileSpeed: 350,
        color: 0x22d3ee,
      };

      const result = updateDecoy(1, decoy, g);
      expect(result).toBe(false);
      expect(decoy.active).toBe(false);
    });

    it('fires at player when fireTimer expires', () => {
      const decoy = {
        active: true,
        x: 100, y: 100,
        hp: 50, maxHp: 50,
        radius: 30,
        life: 3, maxLife: 3,
        fireTimer: 0,
        fireRate: 1.0,
        damage: 15,
        projectileSpeed: 350,
        color: 0x22d3ee,
      };

      expect(g.projectiles.length).toBe(0);
      updateDecoy(0.016, decoy, g);
      expect(g.projectiles.length).toBe(1);
      expect(g.projectiles[0].damage).toBe(15);
    });
  });

  /* ──────────────────────────────────────────────
   * updateBossSignatureMechanics — dispatch
   * ────────────────────────────────────────────── */
  describe('updateBossSignatureMechanics — dispatch', () => {
    it('does nothing for unknown mechanic type', () => {
      const g = createTestState({
        boss: {
          active: true,
          x: 0, y: 0,
          hp: 1000, maxHp: 1000,
          phase: 1,
          attackTimer: 0,
          chargeTimer: 0,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          radius: 60,
          speed: 60,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 0,
          regenActive: false,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: { type: 'unknown_mechanic' },
        },
      });

      expect(() => {
        updateBossSignatureMechanics(0.016, g.boss, g);
      }).not.toThrow();
    });

    it('does nothing when boss is inactive', () => {
      const g = createTestState({
        boss: {
          active: false,
          x: 0, y: 0,
          hp: 1000, maxHp: 1000,
          phase: 1,
          attackTimer: 0,
          chargeTimer: 0,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          radius: 60,
          speed: 60,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 0,
          regenActive: false,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: { type: 'void_zones' },
        },
      });

      updateBossSignatureMechanics(0.016, g.boss, g);
      expect(g.boss.voidZones.length).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * Integration — bossCore wires signature mechanics
   * ────────────────────────────────────────────── */
  describe('integration — bossCore wires signature mechanics', () => {
    it('updateBossSignatureMechanics is called by bossCore updateBossCore', async () => {
      const { updateBossCore } = await import('../engine/systems/bossCore');

      const g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
        boss: {
          active: true,
          x: 500, y: 500,
          hp: 1500, maxHp: 1500,
          phase: 1,
          attackTimer: 2,
          chargeTimer: 5,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          radius: 60,
          speed: 60,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 0,
          regenActive: false,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: {
            type: 'void_zones',
            zoneDamagePerSecond: 10,
            zoneSlowFactor: 0.7,
            zoneLifetime: 8,
            spawnInterval: 0, // spawn immediately
            maxZones: 3,
          },
          voidZoneSpawnTimer: 0, // expired — should spawn
        },
      });

      const initialZoneCount = g.boss.voidZones.length;

      const result = updateBossCore(0.016, g.boss, g, 1, 1,
        { deathColors: [0xff0000, 0x00ff00], guaranteedDrops: null, scrapValue: 100 },
        vi.fn(), vi.fn()
      );

      // Should not have killed the boss
      expect(result).toBe(false);
      // updateBossSignatureMechanics should have spawned a void zone
      // (spawnInterval=0, voidZoneSpawnTimer=0, maxZones=3)
      expect(g.boss.voidZones.length).toBeGreaterThan(initialZoneCount);
    });

    it('bossCore calls updateBossSignatureMechanics for shield_regen', async () => {
      const { updateBossCore } = await import('../engine/systems/bossCore');

      const g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
        boss: {
          active: true,
          x: 500, y: 500,
          hp: 1000, maxHp: 1500,
          phase: 1,
          attackTimer: 2,
          chargeTimer: 5,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          radius: 60,
          speed: 60,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 4, // past threshold
          regenActive: false,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: {
            type: 'shield_regen',
            regenPercentPerSecond: 0.05,
            noDamageThreshold: 3,
          },
        },
      });

      const initialHp = g.boss.hp;

      updateBossCore(1, g.boss, g, 1, 1,
        { deathColors: [0xff0000, 0x00ff00], guaranteedDrops: null, scrapValue: 100 },
        vi.fn(), vi.fn()
      );

      // Shield regen should have activated and regenerated HP
      expect(g.boss.regenActive).toBe(true);
      expect(g.boss.hp).toBeGreaterThan(initialHp);
    });

    it('bossCore calls updateBossSignatureMechanics for phase_shift', async () => {
      const { updateBossCore } = await import('../engine/systems/bossCore');

      const g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
        boss: {
          active: true,
          x: 500, y: 500,
          hp: 1200, maxHp: 1200,
          phase: 1,
          attackTimer: 2,
          chargeTimer: 5,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          radius: 60,
          speed: 80,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 0,
          regenActive: false,
          phaseShiftTimer: 0, // will init to 15 then teleport after 16s
          decoy: null,
          signatureMechanic: {
            type: 'phase_shift',
            teleportInterval: 1,
            decoyLifetime: 3,
            decoyFireRate: 1.0,
            decoyProjectileDamage: 15,
          },
        },
        projectiles: [],
        particles: [],
        effects: [],
        screenFlash: null,
        screenShake: null,
        dynamicFov: null,
        combo: null,
        lowHpWarning: null,
      });

      const oldX = g.boss.x;
      const oldY = g.boss.y;

      updateBossCore(1.1, g.boss, g, 1, 1,
        { deathColors: [0xff0000, 0x00ff00], guaranteedDrops: null, scrapValue: 100 },
        vi.fn(), vi.fn()
      );

      // Boss should have teleported
      expect(g.boss.x).not.toBe(oldX);
      expect(g.boss.y).not.toBe(oldY);
      // Decoy should have been created
      expect(g.boss.decoy).not.toBeNull();
    });
  });

  /* ──────────────────────────────────────────────
   * Integration — projectiles call onBossDamaged
   * ────────────────────────────────────────────── */
  describe('integration — projectiles call onBossDamaged', () => {
    it('onBossDamaged is called when boss takes projectile damage', async () => {
      const { updateProjectiles } = await import('../engine/systems/projectiles');

      const g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
        boss: {
          active: true,
          x: 100, y: 100,
          hp: 1500, maxHp: 1500,
          phase: 1,
          shield: 0, maxShield: 0,
          radius: 60,
          attackTimer: 0,
          chargeTimer: 0,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          speed: 60,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 5, // past threshold — regen active
          regenActive: true,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: {
            type: 'shield_regen',
            regenPercentPerSecond: 0.05,
            noDamageThreshold: 3,
          },
        },
        projectiles: [
          {
            id: 'p1',
            active: true,
            x: 100, y: 100,
            vx: 0, vy: 0,
            radius: 5,
            damage: 25,
            type: 'cannon',
            isEnemy: false,
            hitList: [],
            pierce: 0,
          },
        ],
        particles: [],
        effects: [],
        screenFlash: null,
        screenShake: null,
        dynamicFov: null,
        combo: null,
        lowHpWarning: null,
      });

      updateProjectiles(0.016, g);

      // onBossDamaged should have reset regen timer
      expect(g.boss.regenTimer).toBe(0);
      expect(g.boss.regenActive).toBe(false);
      // Boss should have taken damage
      expect(g.boss.hp).toBe(1500 - 25);
    });

    it('onBossDamaged does not affect non-shield_regen bosses', async () => {
      const { updateProjectiles } = await import('../engine/systems/projectiles');

      const g = createTestState({
        player: {
          x: 0, y: 0, vx: 0, vy: 0, radius: 38,
          hp: 300, maxHp: 300,
          shield: 20, maxShield: 20,
          speed: 120, magnetRadius: 150,
          yaw: Math.PI / 2,
        },
        boss: {
          active: true,
          x: 100, y: 100,
          hp: 1500, maxHp: 1500,
          phase: 1,
          shield: 0, maxShield: 0,
          radius: 60,
          attackTimer: 0,
          chargeTimer: 0,
          chargeTarget: { x: 0, y: 0 },
          isCharging: false,
          speed: 60,
          fireCooldown: 1.5,
          spiralAngle: 0,
          voidZones: [],
          regenTimer: 5,
          regenActive: true,
          phaseShiftTimer: 0,
          decoy: null,
          signatureMechanic: {
            type: 'void_zones', // not shield_regen
            zoneDamagePerSecond: 10,
            zoneSlowFactor: 0.7,
            zoneLifetime: 8,
            spawnInterval: 999,
            maxZones: 3,
          },
          voidZoneSpawnTimer: 999,
        },
        projectiles: [
          {
            id: 'p1',
            active: true,
            x: 100, y: 100,
            vx: 0, vy: 0,
            radius: 5,
            damage: 25,
            type: 'cannon',
            isEnemy: false,
            hitList: [],
            pierce: 0,
          },
        ],
        particles: [],
        effects: [],
        screenFlash: null,
        screenShake: null,
        dynamicFov: null,
        combo: null,
        lowHpWarning: null,
      });

      updateProjectiles(0.016, g);

      // regenTimer should NOT have been reset (only shield_regen type)
      expect(g.boss.regenTimer).toBe(5);
      expect(g.boss.regenActive).toBe(true);
      // Boss should have taken damage regardless
      expect(g.boss.hp).toBe(1500 - 25);
    });
  });
});
