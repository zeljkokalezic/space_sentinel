/**
 * Unit tests for state.js — the game state factory createGameState().
 *
 * Verifies all default values and that each call returns an independent state.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGameState } from '../engine/state';

describe('createGameState', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  /* ──────────────────────────────────────────────
   * 1. Player defaults
   * ────────────────────────────────────────────── */
  describe('player defaults', () => {
    it('position starts at origin', () => {
      expect(state.player.x).toBe(0);
      expect(state.player.y).toBe(0);
    });

    it('velocity starts at zero', () => {
      expect(state.player.vx).toBe(0);
      expect(state.player.vy).toBe(0);
    });

    it('radius is 38', () => {
      expect(state.player.radius).toBe(38);
    });

    it('hp and maxHp are 300', () => {
      expect(state.player.hp).toBe(300);
      expect(state.player.maxHp).toBe(300);
    });

    it('shield and maxShield are 20', () => {
      expect(state.player.shield).toBe(20);
      expect(state.player.maxShield).toBe(20);
    });

    it('speed is 120', () => {
      expect(state.player.speed).toBe(120);
    });

    it('magnetRadius is 150', () => {
      expect(state.player.magnetRadius).toBe(150);
    });

    it('yaw is Math.PI / 2', () => {
      expect(state.player.yaw).toBe(Math.PI / 2);
    });
  });

  /* ──────────────────────────────────────────────
   * 2. Scrap values
   * ────────────────────────────────────────────── */
  describe('scrap values', () => {
    it('scrap starts at 200', () => {
      expect(state.scrap).toBe(200);
    });

    it('totalScrapEarned starts at 0', () => {
      expect(state.totalScrapEarned).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 3. Wave, time, level, mission
   * ────────────────────────────────────────────── */
  describe('wave, time, level, mission', () => {
    it('wave starts at 1', () => {
      expect(state.wave).toBe(1);
    });

    it('totalTime starts at 0', () => {
      expect(state.totalTime).toBe(0);
    });

    it('level starts at 1', () => {
      expect(state.level).toBe(1);
    });

    it('mission is null', () => {
      expect(state.mission).toBeNull();
    });
  });

  /* ──────────────────────────────────────────────
   * 4. Entity arrays are empty
   * ────────────────────────────────────────────── */
  describe('entity arrays', () => {
    it('enemies is an empty array', () => {
      expect(Array.isArray(state.enemies)).toBe(true);
      expect(state.enemies.length).toBe(0);
    });

    it('projectiles is an empty array', () => {
      expect(Array.isArray(state.projectiles)).toBe(true);
      expect(state.projectiles.length).toBe(0);
    });

    it('particles is an empty array', () => {
      expect(Array.isArray(state.particles)).toBe(true);
      expect(state.particles.length).toBe(0);
    });

    it('pickups is an empty array', () => {
      expect(Array.isArray(state.pickups)).toBe(true);
      expect(state.pickups.length).toBe(0);
    });

    it('effects is an empty array', () => {
      expect(Array.isArray(state.effects)).toBe(true);
      expect(state.effects.length).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 5. Stars array
   * ────────────────────────────────────────────── */
  describe('stars', () => {
    it('has exactly 800 entries', () => {
      expect(Array.isArray(state.stars)).toBe(true);
      expect(state.stars.length).toBe(800);
    });

    it('each star has the expected shape', () => {
      const star = state.stars[0];
      expect(typeof star.x).toBe('number');
      expect(typeof star.y).toBe('number');
      expect(typeof star.z).toBe('number');
      expect(typeof star.size).toBe('number');
      expect(typeof star.speed).toBe('number');
    });

    it('star positions are within expected ranges', () => {
      for (const star of state.stars) {
        expect(star.x).toBeGreaterThanOrEqual(-4000);
        expect(star.x).toBeLessThanOrEqual(4000);
        expect(star.y).toBeGreaterThanOrEqual(-4000);
        expect(star.y).toBeLessThanOrEqual(4000);
        expect(star.z).toBeGreaterThanOrEqual(-500);
        expect(star.z).toBeLessThanOrEqual(0);
        expect(star.size).toBeGreaterThanOrEqual(1);
        expect(star.size).toBeLessThanOrEqual(3);
        expect(star.speed).toBeGreaterThanOrEqual(20);
        expect(star.speed).toBeLessThanOrEqual(100);
      }
    });
  });

  /* ──────────────────────────────────────────────
   * 6. Levels object
   * ────────────────────────────────────────────── */
  describe('levels', () => {
    it('has correct default values', () => {
      expect(state.levels).toEqual({
        autocannon: 1,
        plasma: 0,
        missiles: 0,
        hull: 1,
        shield: 1,
        thrusters: 1,
        magnet: 1,
        pointDefense: 0,
        autoAim: 0,
      });
    });

    it('has all 9 expected keys', () => {
      const expectedKeys = [
        'autocannon', 'plasma', 'missiles',
        'hull', 'shield', 'thrusters',
        'magnet', 'pointDefense', 'autoAim',
      ];
      expect(Object.keys(state.levels).sort()).toEqual(expectedKeys.sort());
    });
  });

  /* ──────────────────────────────────────────────
   * 7. Cooldowns object
   * ────────────────────────────────────────────── */
  describe('cooldowns', () => {
    it('has correct default values', () => {
      expect(state.cooldowns).toEqual({
        autocannon: 0,
        plasma: 0,
        missiles: 0,
        pointDefense: 0,
        shieldRegen: 0,
      });
    });

    it('has all 5 expected keys', () => {
      const expectedKeys = [
        'autocannon', 'plasma', 'missiles',
        'pointDefense', 'shieldRegen',
      ];
      expect(Object.keys(state.cooldowns).sort()).toEqual(expectedKeys.sort());
    });
  });

  /* ──────────────────────────────────────────────
   * 8. Escort defaults
   * ────────────────────────────────────────────── */
  describe('escort', () => {
    it('active is false', () => {
      expect(state.escort.active).toBe(false);
    });

    it('hp and maxHp are 0', () => {
      expect(state.escort.hp).toBe(0);
      expect(state.escort.maxHp).toBe(0);
    });

    it('position defaults to origin', () => {
      expect(state.escort.x).toBe(0);
      expect(state.escort.y).toBe(0);
    });

    it('target position defaults to origin', () => {
      expect(state.escort.targetX).toBe(0);
      expect(state.escort.targetY).toBe(0);
    });

    it('speed is 80', () => {
      expect(state.escort.speed).toBe(80);
    });

    it('radius is 20', () => {
      expect(state.escort.radius).toBe(20);
    });

    it('lives is 1', () => {
      expect(state.escort.lives).toBe(1);
    });

    it('evasionAngle, evasionTimer, respawnTimer are 0', () => {
      expect(state.escort.evasionAngle).toBe(0);
      expect(state.escort.evasionTimer).toBe(0);
      expect(state.escort.respawnTimer).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 9. Map is generated
   * ────────────────────────────────────────────── */
  describe('map', () => {
    it('is non-null', () => {
      expect(state.map).not.toBeNull();
      expect(state.map).not.toBeUndefined();
    });

    it('has a nodes array', () => {
      expect(Array.isArray(state.map.nodes)).toBe(true);
    });

    it('has an edges array', () => {
      expect(Array.isArray(state.map.edges)).toBe(true);
    });

    it('has at least one node', () => {
      expect(state.map.nodes.length).toBeGreaterThan(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 10. Independence between calls
   * ────────────────────────────────────────────── */
  describe('independence', () => {
    it('two calls return different state objects', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1).not.toBe(s2);
    });

    it('player objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.player).not.toBe(s2.player);
      s1.player.hp = 999;
      expect(s2.player.hp).toBe(300);
    });

    it('enemy arrays are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.enemies).not.toBe(s2.enemies);
      s1.enemies.push({ id: 1 });
      expect(s2.enemies.length).toBe(0);
    });

    it('projectile arrays are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      s1.projectiles.push({ id: 1 });
      expect(s2.projectiles.length).toBe(0);
    });

    it('levels objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.levels).not.toBe(s2.levels);
      s1.levels.autocannon = 5;
      expect(s2.levels.autocannon).toBe(1);
    });

    it('cooldowns objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.cooldowns).not.toBe(s2.cooldowns);
      s1.cooldowns.autocannon = 99;
      expect(s2.cooldowns.autocannon).toBe(0);
    });

    it('escort objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.escort).not.toBe(s2.escort);
      s1.escort.active = true;
      expect(s2.escort.active).toBe(false);
    });

    it('beacon objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.beacon).not.toBe(s2.beacon);
      s1.beacon.active = true;
      expect(s2.beacon.active).toBe(false);
    });

    it('sabotage objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.sabotage).not.toBe(s2.sabotage);
      s1.sabotage.active = true;
      expect(s2.sabotage.active).toBe(false);
    });

    it('stars arrays are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.stars).not.toBe(s2.stars);
      s1.stars.push({ x: 0, y: 0, z: 0, size: 1, speed: 1 });
      expect(s2.stars.length).toBe(800);
    });

    it('keys objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.keys).not.toBe(s2.keys);
      s1.keys.W = true;
      expect(s2.keys.W).toBeUndefined();
    });

    it('mouse objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.mouse).not.toBe(s2.mouse);
      s1.mouse.x = 500;
      expect(s2.mouse.x).toBe(0);
    });

    it('map objects are independent', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.map).not.toBe(s2.map);
      const s2NodesLen = s2.map.nodes.length;
      s1.map.nodes.push({ id: 999 });
      expect(s2.map.nodes.length).toBe(s2NodesLen);
    });
  });

  /* ──────────────────────────────────────────────
   * 11. Keys and mouse defaults
   * ────────────────────────────────────────────── */
  describe('input state', () => {
    it('keys is an empty object', () => {
      expect(state.keys).toEqual({});
    });

    it('mouse has x=0, y=0, active=false', () => {
      expect(state.mouse.x).toBe(0);
      expect(state.mouse.y).toBe(0);
      expect(state.mouse.active).toBe(false);
    });

    it('worldMouse has x=0, y=0', () => {
      expect(state.worldMouse.x).toBe(0);
      expect(state.worldMouse.y).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 12. Other top-level fields
   * ────────────────────────────────────────────── */
  describe('beacon defaults', () => {
    it('active is false', () => {
      expect(state.beacon.active).toBe(false);
    });

    it('position defaults to origin', () => {
      expect(state.beacon.x).toBe(0);
      expect(state.beacon.y).toBe(0);
    });

    it('hp and maxHp are 0', () => {
      expect(state.beacon.hp).toBe(0);
      expect(state.beacon.maxHp).toBe(0);
    });
  });

  describe('sabotage defaults', () => {
    it('active is false', () => {
      expect(state.sabotage.active).toBe(false);
    });

    it('structures is an empty array', () => {
      expect(Array.isArray(state.sabotage.structures)).toBe(true);
      expect(state.sabotage.structures.length).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
   * 13. Audio state
   * ────────────────────────────────────────────── */
  describe('audio', () => {
    it('has an audio object', () => {
      expect(typeof state.audio).toBe('object');
      expect(state.audio).not.toBeNull();
    });

    it('muted defaults to false', () => {
      expect(state.audio.muted).toBe(false);
    });

    it('volume defaults to 0.5', () => {
      expect(state.audio.volume).toBe(0.5);
    });

    it('audio object is independent across calls', () => {
      const s1 = createGameState();
      const s2 = createGameState();
      expect(s1.audio).not.toBe(s2.audio);
      s1.audio.muted = true;
      expect(s2.audio.muted).toBe(false);
      s1.audio.volume = 1;
      expect(s2.audio.volume).toBe(0.5);
    });
  });

  /* ──────────────────────────────────────────────
   * 14. Other top-level fields
   * ────────────────────────────────────────────── */
  describe('other top-level fields', () => {
    it('spawnCooldown is 2', () => {
      expect(state.spawnCooldown).toBe(2);
    });

    it('touchId is null', () => {
      expect(state.touchId).toBeNull();
    });

    it('touchBase is null', () => {
      expect(state.touchBase).toBeNull();
    });

    it('touchCurrent is null', () => {
      expect(state.touchCurrent).toBeNull();
    });

    it('lastTime is a positive number from performance.now()', () => {
      expect(typeof state.lastTime).toBe('number');
      expect(state.lastTime).toBeGreaterThan(0);
    });
  });
});
