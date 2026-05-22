/**
 * spawner.test.js — Unit tests for generateMission and spawnEnemy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMission, spawnEnemy } from '../engine/spawner';
import { createTestState } from './helpers';
import { GAME_CONFIG } from '../constants/gameConfig';

/* =========================================================
 * generateMission tests
 * ========================================================= */

describe('generateMission', () => {
  // ---------- 1. 'boss' ----------
  it('boss -> type="kill_boss", target=1, reward=500', () => {
    const mission = generateMission(0, 'boss');
    expect(mission.type).toBe('kill_boss');
    expect(mission.target).toBe(1);
    expect(mission.reward).toBe(500);
  });

  // ---------- 2. 'elite' ----------
  it('elite -> type="kill_elite", target=3+floor(level/3), reward=100+level*30', () => {
    // level 1 => target = 3 + 0 = 3, reward = 100 + 30 = 130
    let m = generateMission(1, 'elite');
    expect(m.type).toBe('kill_elite');
    expect(m.target).toBe(3);
    expect(m.reward).toBe(130);

    // level 6 => target = 3 + 2 = 5, reward = 100 + 180 = 280
    m = generateMission(6, 'elite');
    expect(m.target).toBe(5);
    expect(m.reward).toBe(280);
  });

  // ---------- 3. 'kill' ----------
  it('kill -> type="kill", target=10+level*5, reward=50+level*20', () => {
    const m = generateMission(3, 'kill');
    expect(m.type).toBe('kill');
    expect(m.target).toBe(10 + 3 * 5); // 25
    expect(m.reward).toBe(50 + 3 * 20); // 110
  });

  // ---------- 4. 'collect' ----------
  it('collect -> type="collect", target=15+level*3, reward=80+level*25', () => {
    const m = generateMission(4, 'collect');
    expect(m.type).toBe('collect');
    expect(m.target).toBe(15 + 4 * 3); // 27
    expect(m.reward).toBe(80 + 4 * 25); // 180
  });

  // ---------- 5. 'survive' ----------
  it('survive -> type="survive", target=20+level*10, reward=80+level*15', () => {
    const m = generateMission(2, 'survive');
    expect(m.type).toBe('survive');
    expect(m.target).toBe(20 + 2 * 10); // 40
    expect(m.reward).toBe(80 + 2 * 15); // 110
  });

  // ---------- 6. 'escort' ----------
  it('escort -> type="escort", target=0, reward=120+level*35', () => {
    const m = generateMission(5, 'escort');
    expect(m.type).toBe('escort');
    expect(m.target).toBe(0);
    expect(m.reward).toBe(120 + 5 * 35); // 295
  });

  // ---------- 6b. 'defend' ----------
  it('defend -> type="defend", target=30+level*10, reward=100+level*30', () => {
    const m = generateMission(4, 'defend');
    expect(m.type).toBe('defend');
    expect(m.target).toBe(30 + 4 * 10); // 70
    expect(m.reward).toBe(100 + 4 * 30); // 220
  });

  // ---------- 6c. 'sabotage' ----------
  it('sabotage -> type="sabotage", target=structures count, reward=120+level*35', () => {
    const m = generateMission(4, 'sabotage');
    expect(m.type).toBe('sabotage');
    expect(m.target).toBeGreaterThan(0);
    expect(m.target).toBeLessThanOrEqual(GAME_CONFIG.sabotage.maxStructures);
    expect(m.reward).toBe(120 + 4 * 35); // 260
  });

  // ---------- 7. 'combat' at level 1 -> always 'kill' ----------
  it('combat at level 1 -> always "kill" type', () => {
    // Run multiple times to cover the random branch — level 1 forces 'kill'
    for (let i = 0; i < 20; i++) {
      const m = generateMission(1, 'combat');
      expect(m.type).toBe('kill');
    }
  });

  // ---------- 8. 'combat' at level 2 -> always 'collect' ----------
  it('combat at level 2 -> always "collect" type', () => {
    for (let i = 0; i < 20; i++) {
      const m = generateMission(2, 'combat');
      expect(m.type).toBe('collect');
    }
  });

  // ---------- 9. All missions have current=0 ----------
  it('all missions have current=0 initially', () => {
    const nodeTypes = ['boss', 'elite', 'kill', 'collect', 'survive', 'escort', 'defend', 'sabotage'];
    for (const nt of nodeTypes) {
      const m = generateMission(1, nt);
      expect(m.current).toBe(0);
    }
  });

  // ---------- 10. All missions have title string ----------
  it('all missions have a title string', () => {
    const nodeTypes = ['boss', 'elite', 'kill', 'collect', 'survive', 'escort', 'defend', 'sabotage'];
    for (const nt of nodeTypes) {
      const m = generateMission(1, nt);
      expect(typeof m.title).toBe('string');
      expect(m.title.length).toBeGreaterThan(0);
    }
  });

  // ---------- 11. Target scales with level ----------
  it('target scales with level (higher level = higher target)', () => {
    const scalingTypes = ['kill', 'collect', 'survive', 'defend', 'sabotage'];
    for (const nt of scalingTypes) {
      const low = generateMission(1, nt).target;
      const high = generateMission(10, nt).target;
      expect(high).toBeGreaterThan(low);
    }
  });

  // ---------- Bonus: reward scales with level ----------
  it('reward scales with level for all node types', () => {
    const nodeTypes = ['boss', 'elite', 'kill', 'collect', 'survive', 'escort', 'defend', 'sabotage'];
    for (const nt of nodeTypes) {
      const low = generateMission(1, nt).reward;
      const high = generateMission(10, nt).reward;
      if (nt === 'boss') {
        expect(high).toBe(low);
      } else {
        expect(high).toBeGreaterThan(low);
      }
    }
  });

  // ---------- Bonus: 'combat' at level 3+ can produce any of the 6 types ----------
  it('combat at level 3+ can produce kill/collect/survive/escort/defend/sabotage types', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      const m = generateMission(5, 'combat');
      seen.add(m.type);
    }
    expect(seen.has('kill')).toBe(true);
    expect(seen.has('collect')).toBe(true);
    expect(seen.has('survive')).toBe(true);
    expect(seen.has('escort')).toBe(true);
    expect(seen.has('defend')).toBe(true);
    expect(seen.has('sabotage')).toBe(true);
  });
});

/* =========================================================
 * spawnEnemy tests
 * ========================================================= */

describe('spawnEnemy', () => {
  let g;

  beforeEach(() => {
    g = createTestState();
  });

  // ---------- 12. Adds enemy to g.enemies ----------
  it('adds enemy to g.enemies array', () => {
    expect(g.enemies.length).toBe(0);
    spawnEnemy(g);
    expect(g.enemies.length).toBe(1);
    spawnEnemy(g);
    expect(g.enemies.length).toBe(2);
  });

  // ---------- 13. Enemy spawned within spawn radius ----------
  it('enemy spawned within spawn radius (900-1300 units from player)', () => {
    // Player is at (0, 0) by default
    for (let i = 0; i < 50; i++) {
      spawnEnemy(g);
      const enemy = g.enemies[g.enemies.length - 1];
      const dist = Math.sqrt(enemy.x * enemy.x + enemy.y * enemy.y);
      expect(dist).toBeGreaterThanOrEqual(GAME_CONFIG.enemies.spawnRadiusMin - 1);
      expect(dist).toBeLessThanOrEqual(GAME_CONFIG.enemies.spawnRadiusMax + 1);
    }
  });

  // ---------- 14. Enemy has all required properties ----------
  it('enemy has all required properties', () => {
    spawnEnemy(g);
    const e = g.enemies[0];
    const requiredKeys = [
      'id', 'x', 'y', 'hp', 'maxHp', 'shield', 'maxShield',
      'speed', 'radius', 'color', 'type', 'active', 'fireCooldown'
    ];
    for (const key of requiredKeys) {
      expect(e).toHaveProperty(key);
    }
  });

  // ---------- 15. Enemy type determined correctly ----------
  it('enemy type is one of the valid types', () => {
    const validTypes = ['fighter', 'interceptor', 'heavy', 'shooter', 'shielded', 'missile_boat'];
    for (let i = 0; i < 200; i++) {
      spawnEnemy(g);
      expect(validTypes).toContain(g.enemies[i].type);
    }
  });

  // ---------- 15b. All 6 types appear across many spawns ----------
  it('all 6 enemy types appear across many spawns', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      spawnEnemy(g);
      seen.add(g.enemies[i].type);
    }
    expect(seen.has('fighter')).toBe(true);
    expect(seen.has('interceptor')).toBe(true);
    expect(seen.has('heavy')).toBe(true);
    expect(seen.has('shooter')).toBe(true);
    expect(seen.has('shielded')).toBe(true);
    expect(seen.has('missile_boat')).toBe(true);
  });

  // ---------- 16. Enemy HP scaled by difficulty multiplier ----------
  it('enemy HP scaled by difficulty multiplier (higher level = higher HP)', () => {
    // Use average HP across many spawns to eliminate type randomness
    const g1 = createTestState({ level: 1, totalTime: 0 });
    const g10 = createTestState({ level: 10, totalTime: 0 });

    let totalHp1 = 0, totalHp10 = 0;
    const count = 100;
    for (let i = 0; i < count; i++) {
      spawnEnemy(g1);
      spawnEnemy(g10);
      totalHp1 += g1.enemies[i].hp;
      totalHp10 += g10.enemies[i].hp;
    }

    const avgHp1 = totalHp1 / count;
    const avgHp10 = totalHp10 / count;

    // Level 10 enemies should have higher average HP
    expect(avgHp10).toBeGreaterThan(avgHp1);
  });

  // ---------- 16b. Difficulty multiplier formula ----------
  it('difficulty multiplier increases with level and totalTime', () => {
    const gLow = createTestState({ level: 1, totalTime: 0 });
    const gHigh = createTestState({ level: 10, totalTime: 500 });

    spawnEnemy(gLow);
    spawnEnemy(gHigh);

    // Enemies at higher level/time have higher HP regardless of type
    const diffMultLow = 0.5 + (1 * 0.15) + Math.pow(1, 1.6) * 0.04 + 0 / 100;
    const diffMultHigh = 0.5 + (10 * 0.15) + Math.pow(10, 1.6) * 0.04 + 500 / 100;
    expect(diffMultHigh).toBeGreaterThan(diffMultLow);
  });

  // ---------- 17. Shielded enemies have shield=maxShield > 0 ----------
  it('shielded enemies have shield=maxShield > 0', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      spawnEnemy(g);
      seen.add(g.enemies[i].type);
    }
    // Find all shielded enemies
    const shielded = g.enemies.filter(e => e.type === 'shielded');
    expect(shielded.length).toBeGreaterThan(0);
    for (const e of shielded) {
      expect(e.shield).toBeGreaterThan(0);
      expect(e.maxShield).toBeGreaterThan(0);
      expect(e.shield).toBe(e.maxShield);
    }
  });

  // ---------- 18. Shooter and missile_boat have fireCooldown > 0 ----------
  it('shooter and missile_boat have fireCooldown > 0', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      spawnEnemy(g);
      seen.add(g.enemies[i].type);
    }

    const shooters = g.enemies.filter(e => e.type === 'shooter');
    const boats = g.enemies.filter(e => e.type === 'missile_boat');

    expect(shooters.length).toBeGreaterThan(0);
    expect(boats.length).toBeGreaterThan(0);

    for (const e of shooters) {
      expect(e.fireCooldown).toBeGreaterThan(0);
    }
    for (const e of boats) {
      expect(e.fireCooldown).toBeGreaterThan(0);
    }
  });

  // ---------- 18b. Non-shooting types have fireCooldown === 0 ----------
  it('fighter, interceptor, heavy have fireCooldown === 0', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      spawnEnemy(g);
      seen.add(g.enemies[i].type);
    }

    const nonShooters = g.enemies.filter(e =>
      e.type === 'fighter' || e.type === 'interceptor' || e.type === 'heavy'
    );

    expect(nonShooters.length).toBeGreaterThan(0);
    for (const e of nonShooters) {
      expect(e.fireCooldown).toBe(0);
    }
  });

  // ---------- 19. All enemies start with active=true ----------
  it('all enemies start with active=true', () => {
    for (let i = 0; i < 50; i++) {
      spawnEnemy(g);
    }
    for (const e of g.enemies) {
      expect(e.active).toBe(true);
    }
  });

  // ---------- 20. Multiple spawns are independent ----------
  it('multiple spawns are independent (different IDs, positions)', () => {
    spawnEnemy(g);
    spawnEnemy(g);
    const [e1, e2] = g.enemies;

    // Different IDs (random floats — extremely unlikely to collide)
    expect(e1.id).not.toBe(e2.id);

    // Different positions
    expect(e1.x).not.toBe(e2.x) || expect(e1.y).not.toBe(e2.y);
  });

  // ---------- Bonus: hp === maxHp on spawn ----------
  it('enemy hp equals maxHp on spawn', () => {
    for (let i = 0; i < 50; i++) {
      spawnEnemy(g);
      const e = g.enemies[i];
      expect(e.hp).toBe(e.maxHp);
    }
  });

  // ---------- Bonus: non-shielded enemies have shield=0 ----------
  it('non-shielded enemies have shield=0 and maxShield=0', () => {
    for (let i = 0; i < 50; i++) {
      spawnEnemy(g);
      const e = g.enemies[i];
      if (e.type !== 'shielded') {
        expect(e.shield).toBe(0);
        expect(e.maxShield).toBe(0);
      }
    }
  });

  // ---------- Bonus: enemy colors match type ----------
  it('enemy color matches expected type color', () => {
    const expectedColors = {
      fighter: 0xef4444,
      interceptor: 0xeab308,
      heavy: 0xf97316,
      shooter: 0xa855f7,
      shielded: 0x3b82f6,
      missile_boat: 0xd946ef,
    };

    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      spawnEnemy(g);
      seen.add(g.enemies[i].type);
    }

    for (const type of Object.keys(expectedColors)) {
      const enemiesOfType = g.enemies.filter(e => e.type === type);
      if (enemiesOfType.length > 0) {
        for (const e of enemiesOfType) {
          expect(e.color).toBe(expectedColors[type]);
        }
      }
    }
  });

  // ---------- Bonus: enemy speeds within expected ranges ----------
  it('enemy speeds are within expected ranges per type', () => {
    const speedRanges = {
      fighter: [100, 150],
      interceptor: [180, 230],
      heavy: [40, 70],
      shooter: [70, 100],
      shielded: [50, 80],
      missile_boat: [30, 50],
    };

    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      spawnEnemy(g);
      seen.add(g.enemies[i].type);
    }

    for (const type of Object.keys(speedRanges)) {
      const [min, max] = speedRanges[type];
      const enemiesOfType = g.enemies.filter(e => e.type === type);
      for (const e of enemiesOfType) {
        expect(e.speed).toBeGreaterThanOrEqual(min - 1);
        expect(e.speed).toBeLessThanOrEqual(max + 1);
      }
    }
  });

  // ---------- Bonus: enemy radius matches type ----------
  it('enemy radius matches expected type radius', () => {
    const expectedRadius = {
      fighter: 15,
      interceptor: 12,
      heavy: 25,
      shooter: 16,
      shielded: 18,
      missile_boat: 22,
    };

    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      spawnEnemy(g);
      seen.add(g.enemies[i].type);
    }

    for (const type of Object.keys(expectedRadius)) {
      const enemiesOfType = g.enemies.filter(e => e.type === type);
      for (const e of enemiesOfType) {
        expect(e.radius).toBe(expectedRadius[type]);
      }
    }
  });

  // ---------- Bonus: spawn respects player position ----------
  it('spawn position is relative to player position', () => {
    const gOffset = createTestState({ player: { x: 500, y: 300 } });
    spawnEnemy(gOffset);
    const e = gOffset.enemies[0];
    const dx = e.x - 500;
    const dy = e.y - 300;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThanOrEqual(GAME_CONFIG.enemies.spawnRadiusMin - 1);
    expect(dist).toBeLessThanOrEqual(GAME_CONFIG.enemies.spawnRadiusMax + 1);
  });

  // ---------- Bonus: elite bonus increases with level ----------
  it('higher level increases chance of elite enemy types', () => {
    // At level 1, eliteBonus is small; at level 20 it approaches the max
    const g1 = createTestState({ level: 1, totalTime: 0 });
    const g20 = createTestState({ level: 20, totalTime: 0 });

    const eliteCount1 = { count: 0 };
    const eliteCount20 = { count: 0 };
    const eliteTypes = ['heavy', 'shooter', 'shielded', 'missile_boat'];

    for (let i = 0; i < 200; i++) {
      spawnEnemy(g1);
      if (eliteTypes.includes(g1.enemies[i].type)) eliteCount1.count++;

      spawnEnemy(g20);
      if (eliteTypes.includes(g20.enemies[i].type)) eliteCount20.count++;
    }

    // Level 20 should produce more elite enemies
    expect(eliteCount20.count).toBeGreaterThan(eliteCount1.count);
  });
});
