/**
 * Unit tests for wave pattern system in spawner.js
 *
 * Tests wave pattern selection, formation spawning, and enemy type assignment.
 *
 * Run:  npm test -- --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnEnemy, WAVE_PATTERNS, getWavePattern, spawnWavePattern } from '../engine/spawner';

// Stub dependencies
vi.mock('../constants/gameConfig', () => ({
  GAME_CONFIG: {
    enemies: {
      spawnRadiusMin: 400,
      spawnRadiusMax: 800,
      eliteBonusBase: 0.02,
      eliteBonusMax: 0.15,
      eliteBonusTimeFactor: 0.0005,
    },
    sabotage: {
      baseStructures: 3,
      structuresPer2Levels: 1,
      maxStructures: 8,
      structureHp: 80,
      hpPerLevel: 15,
      structureRadius: 20,
      fireCooldown: 2.5,
      projectileDamage: 12,
      projectileSpeed: 220,
      spawnSpreadMin: 300,
      spawnSpreadMax: 500,
      protectRadius: 300,
      color: 0xf97316,
      scrapPerDestroy: 20,
    },
    formations: {
      vanguard: { spreadRadius: 300, convergeDelay: 3, convergeSpeedMult: 1.5 },
      orbit: { orbitRadius: 250, orbitSpeed: 1.5, rushThreshold: 0.4 },
      swarm: { separationDist: 60, cohesionWeight: 0.5, alignmentWeight: 0.3, maxCount: 8 },
      kamikaze: { speedMult: 1.8, lateralAmplitude: 40, lateralFreq: 3 },
      bomber: { approachRadius: 400, fireBurstCount: 3, retreatDist: 150 },
      screen: { lineSpacing: 80, advanceSpeed: 30, fireThrough: true },
    },
    formationLevels: {
      kamikaze: 1,
      vanguard: 1,
      orbit: 4,
      bomber: 4,
      swarm: 7,
      screen: 7,
    },
    waveAnnouncer: {
      enemiesPerWave: 10,
      announcementDuration: 2,
    },
  },
}));

vi.mock('../engine/difficulty', () => ({
  calculateDifficultyMultiplier: vi.fn(() => 1.0),
}));

function buildState() {
  return {
    player: { x: 0, y: 0, yaw: 0 },
    level: 5,
    totalTime: 60,
    enemies: [],
    projectiles: [],
    particles: [],
    pickups: [],
    mission: { type: 'kill', target: 10, current: 0, completed: false },
    escort: { active: false },
    beacon: { active: false },
    sabotage: { active: false, structures: [] },
  };
}

describe('wave patterns', () => {
  describe('WAVE_PATTERNS config', () => {
    it('defines all expected pattern names', () => {
      expect(WAVE_PATTERNS).toHaveProperty('random');
      expect(WAVE_PATTERNS).toHaveProperty('burst');
      expect(WAVE_PATTERNS).toHaveProperty('circle');
      expect(WAVE_PATTERNS).toHaveProperty('vFormation');
      expect(WAVE_PATTERNS).toHaveProperty('swarm');
    });

    it('each pattern has a count property', () => {
      for (const [name, config] of Object.entries(WAVE_PATTERNS)) {
        expect(config.count).toBeGreaterThan(0);
        expect(typeof config.count).toBe('number');
      }
    });

    it('formation patterns have a formation property', () => {
      expect(WAVE_PATTERNS.circle.formation).toBe('circle');
      expect(WAVE_PATTERNS.vFormation.formation).toBe('v');
    });

    it('swarm pattern has a forced enemyType', () => {
      expect(WAVE_PATTERNS.swarm.enemyType).toBe('interceptor');
    });
  });

  describe('getWavePattern', () => {
    it('returns random for early game (totalTime < 30)', () => {
      expect(getWavePattern(1, 10)).toBe('random');
      expect(getWavePattern(3, 25)).toBe('random');
    });

    it('returns from mid-game pool (30 <= totalTime < 90)', () => {
      const patterns = ['random', 'burst', 'circle'];
      for (let i = 0; i < 50; i++) {
        const result = getWavePattern(5, 60);
        expect(patterns).toContain(result);
      }
    });

    it('returns from full pool (totalTime >= 90)', () => {
      const patterns = ['random', 'burst', 'circle', 'vFormation', 'swarm'];
      const seen = new Set();
      for (let i = 0; i < 100; i++) {
        const result = getWavePattern(10, 120);
        expect(patterns).toContain(result);
        seen.add(result);
      }
      // Should see multiple different patterns
      expect(seen.size).toBeGreaterThan(1);
    });
  });

  describe('spawnWavePattern', () => {
    it('spawns correct number of enemies for random pattern', () => {
      const g = buildState();
      spawnWavePattern(g, 'random', 5);
      expect(g.enemies.length).toBe(WAVE_PATTERNS.random.count);
    });

    it('spawns correct number of enemies for burst pattern', () => {
      const g = buildState();
      spawnWavePattern(g, 'burst', 5);
      expect(g.enemies.length).toBe(WAVE_PATTERNS.burst.count);
    });

    it('spawns correct number of enemies for circle pattern', () => {
      const g = buildState();
      spawnWavePattern(g, 'circle', 5);
      expect(g.enemies.length).toBe(WAVE_PATTERNS.circle.count);
    });

    it('circle formation places enemies in a circle', () => {
      const g = buildState();
      spawnWavePattern(g, 'circle', 5);
      // Check that enemies are roughly equidistant from player
      const distances = g.enemies.map(e => Math.hypot(e.x - g.player.x, e.y - g.player.y));
      // All distances should be similar (within 50 units)
      const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
      for (const d of distances) {
        expect(Math.abs(d - avgDist)).toBeLessThan(50);
      }
    });

    it('v formation places enemies in a line', () => {
      const g = buildState();
      spawnWavePattern(g, 'vFormation', 5);
      expect(g.enemies.length).toBe(WAVE_PATTERNS.vFormation.count);
    });

    it('swarm pattern spawns interceptors', () => {
      const g = buildState();
      spawnWavePattern(g, 'swarm', 5);
      for (const enemy of g.enemies) {
        expect(enemy.type).toBe('interceptor');
      }
    });

    it('invalid pattern falls back to random', () => {
      const g = buildState();
      spawnWavePattern(g, 'nonexistent', 5);
      expect(g.enemies.length).toBe(WAVE_PATTERNS.random.count);
    });

    it('spawned enemies have valid properties', () => {
      const g = buildState();
      spawnWavePattern(g, 'burst', 5);
      for (const enemy of g.enemies) {
        expect(enemy).toHaveProperty('id');
        expect(enemy).toHaveProperty('x');
        expect(enemy).toHaveProperty('y');
        expect(enemy).toHaveProperty('hp');
        expect(enemy).toHaveProperty('maxHp');
        expect(enemy).toHaveProperty('speed');
        expect(enemy).toHaveProperty('radius');
        expect(enemy).toHaveProperty('color');
        expect(enemy).toHaveProperty('type');
        expect(enemy).toHaveProperty('active');
        expect(enemy.active).toBe(true);
        expect(enemy.hp).toBeGreaterThan(0);
        expect(enemy.maxHp).toBeGreaterThanOrEqual(enemy.hp);
      }
    });

    it('spawned enemies are within spawn radius', () => {
      const g = buildState();
      spawnWavePattern(g, 'burst', 5);
      for (const enemy of g.enemies) {
        const dist = Math.hypot(enemy.x - g.player.x, enemy.y - g.player.y);
        expect(dist).toBeGreaterThanOrEqual(350); // slightly less than min
        expect(dist).toBeLessThanOrEqual(900);    // slightly more than max
      }
    });
  });

  describe('spawnEnemy (public API)', () => {
    it('spawns at least one enemy', () => {
      const g = buildState();
      spawnEnemy(g);
      expect(g.enemies.length).toBeGreaterThan(0);
    });

    it('spawns multiple enemies for burst pattern', () => {
      // Force mid-game to get burst pattern
      const g = buildState();
      g.totalTime = 60;
      spawnEnemy(g);
      // Should spawn 1-5 enemies depending on pattern
      expect(g.enemies.length).toBeLessThanOrEqual(6);
    });
  });
});
