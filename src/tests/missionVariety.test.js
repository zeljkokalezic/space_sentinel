import { describe, it, expect, beforeEach } from 'vitest';
import { generateMap } from '../engine/mapGenerator';
import { generateMission } from '../engine/spawner';
import { createGameState } from '../engine/state';
import { GAME_CONFIG } from '../constants/gameConfig';
import { setupGauntlet, setupWaveSurge, resetGauntlet, resetWaveSurge } from '../engine/gauntletSetup';
import { setupCombatMission, enterNodeMission } from '../engine/missionSetup';
import { updatePhysics } from '../engine/physics';

// ---- Map generation: gauntlet and wave_surge nodes ----
describe('mapGenerator — gauntlet and wave_surge nodes', () => {
  it('generates maps that include gauntlet nodes', () => {
    const maps = Array.from({ length: 20 }, () => generateMap());
    const hasGauntlet = maps.some(m => m.nodes.some(n => n.type === 'gauntlet'));
    expect(hasGauntlet).toBe(true);
  });

  it('generates maps that include wave_surge nodes', () => {
    const maps = Array.from({ length: 20 }, () => generateMap());
    const hasWaveSurge = maps.some(m => m.nodes.some(n => n.type === 'wave_surge'));
    expect(hasWaveSurge).toBe(true);
  });

  it('gauntlet nodes appear at approximately 5% of eligible nodes', () => {
    const maps = Array.from({ length: 50 }, () => generateMap());
    let totalEligible = 0;
    let gauntletCount = 0;
    for (const m of maps) {
      const eligible = m.nodes.filter(n => n.row > 0 && n.row < 13 && n.row !== 7);
      totalEligible += eligible.length;
      gauntletCount += eligible.filter(n => n.type === 'gauntlet').length;
    }
    const rate = gauntletCount / totalEligible;
    // Expect between 1% and 12% (generous bounds for randomness)
    expect(rate).toBeGreaterThan(0.01);
    expect(rate).toBeLessThan(0.12);
  });

  it('wave_surge nodes appear at approximately 3% of eligible nodes', () => {
    const maps = Array.from({ length: 50 }, () => generateMap());
    let totalEligible = 0;
    let waveSurgeCount = 0;
    for (const m of maps) {
      const eligible = m.nodes.filter(n => n.row > 0 && n.row < 13 && n.row !== 7);
      totalEligible += eligible.length;
      waveSurgeCount += eligible.filter(n => n.type === 'wave_surge').length;
    }
    const rate = waveSurgeCount / totalEligible;
    // Expect between 0.5% and 10% (generous bounds for randomness)
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.10);
  });

  it('gauntlet and wave_surge are valid node types', () => {
    const map = generateMap();
    const validTypes = [
      'combat', 'event', 'shop', 'repair', 'elite', 'boss',
      'defend', 'escort', 'sabotage', 'miniboss', 'gauntlet', 'wave_surge',
    ];
    for (const node of map.nodes) {
      expect(validTypes).toContain(node.type);
    }
  });
});

// ---- Mission descriptors for gauntlet and wave_surge ----
describe('generateMission — gauntlet and wave_surge descriptors', () => {
  it('gauntlet mission has correct type and structure', () => {
    const mission = generateMission(5, 'gauntlet');
    expect(mission.type).toBe('gauntlet');
    expect(mission.current).toBe(0);
    expect(mission.target).toBe(3); // totalWaves from config
    expect(mission.title).toContain('Survive');
    expect(mission.title).toContain('Waves');
    expect(mission.reward).toBeGreaterThan(0);
  });

  it('gauntlet mission reward scales with level', () => {
    const m1 = generateMission(1, 'gauntlet');
    const m10 = generateMission(10, 'gauntlet');
    expect(m10.reward).toBeGreaterThan(m1.reward);
  });

  it('wave_surge mission has correct type and structure', () => {
    const mission = generateMission(5, 'wave_surge');
    expect(mission.type).toBe('wave_surge');
    expect(mission.current).toBe(0);
    expect(mission.target).toBe(15); // duration from config
    expect(mission.title).toContain('Wave Surge');
    expect(mission.reward).toBeGreaterThan(0);
  });

  it('wave_surge mission reward scales with level', () => {
    const m1 = generateMission(1, 'wave_surge');
    const m10 = generateMission(10, 'wave_surge');
    expect(m10.reward).toBeGreaterThan(m1.reward);
  });

  it('gauntlet mission target matches config totalWaves', () => {
    const mission = generateMission(3, 'gauntlet');
    expect(mission.target).toBe(GAME_CONFIG.gauntlet.totalWaves);
  });

  it('wave_surge mission target matches config duration', () => {
    const mission = generateMission(3, 'wave_surge');
    expect(mission.target).toBe(GAME_CONFIG.waveSurge.duration);
  });
});

// ---- Game state includes gauntlet and waveSurge ----
describe('createGameState — gauntlet and waveSurge state', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
  });

  it('state has a gauntlet object', () => {
    expect(state.gauntlet).toBeDefined();
    expect(typeof state.gauntlet).toBe('object');
  });

  it('gauntlet state has correct default fields', () => {
    expect(state.gauntlet.active).toBe(false);
    expect(state.gauntlet.currentWave).toBe(0);
    expect(state.gauntlet.totalWaves).toBe(3);
    expect(state.gauntlet.enemiesPerWave).toBe(0);
    expect(state.gauntlet.enemiesSpawnedInWave).toBe(0);
    expect(state.gauntlet.waveDelay).toBe(0);
    expect(state.gauntlet.betweenWaves).toBe(false);
  });

  it('state has a waveSurge object', () => {
    expect(state.waveSurge).toBeDefined();
    expect(typeof state.waveSurge).toBe('object');
  });

  it('waveSurge state has correct default fields', () => {
    expect(state.waveSurge.active).toBe(false);
    expect(state.waveSurge.remaining).toBe(0);
    expect(state.waveSurge.spawnRateMult).toBe(3);
  });
});

// ---- Game config includes waveSurge and gauntlet ----
describe('GAME_CONFIG — waveSurge and gauntlet config', () => {
  it('GAME_CONFIG has waveSurge config', () => {
    expect(GAME_CONFIG.waveSurge).toBeDefined();
    expect(GAME_CONFIG.waveSurge.duration).toBe(15);
    expect(GAME_CONFIG.waveSurge.spawnRateMult).toBe(3);
  });

  it('GAME_CONFIG has gauntlet config', () => {
    expect(GAME_CONFIG.gauntlet).toBeDefined();
    expect(GAME_CONFIG.gauntlet.totalWaves).toBe(3);
    expect(GAME_CONFIG.gauntlet.waveDelay).toBe(2);
  });
});

// ---- Gauntlet setup and reset ----
describe('setupGauntlet / resetGauntlet', () => {
  let g;
  let mission;

  beforeEach(() => {
    g = createGameState();
    g.level = 5;
    mission = generateMission(5, 'gauntlet');
  });

  it('setupGauntlet activates gauntlet state', () => {
    setupGauntlet(g, mission);
    expect(g.gauntlet.active).toBe(true);
    expect(g.gauntlet.currentWave).toBe(0);
    expect(g.gauntlet.totalWaves).toBe(3);
    expect(g.gauntlet.betweenWaves).toBe(false);
  });

  it('setupGauntlet sets enemiesPerWave based on level', () => {
    setupGauntlet(g, mission);
    expect(g.gauntlet.enemiesPerWave).toBe(5 + g.level * 2); // 5 + 5*2 = 15
  });

  it('setupGauntlet updates mission target and current', () => {
    setupGauntlet(g, mission);
    expect(g.mission.target).toBe(3);
    expect(g.mission.current).toBe(0);
  });

  it('resetGauntlet deactivates gauntlet state', () => {
    setupGauntlet(g, mission);
    resetGauntlet(g);
    expect(g.gauntlet.active).toBe(false);
    expect(g.gauntlet.currentWave).toBe(0);
    expect(g.gauntlet.enemiesPerWave).toBe(0);
    expect(g.gauntlet.betweenWaves).toBe(false);
  });

  it('setupWaveSurge activates wave surge state', () => {
    setupWaveSurge(g);
    expect(g.waveSurge.active).toBe(true);
    expect(g.waveSurge.remaining).toBe(15);
    expect(g.waveSurge.spawnRateMult).toBe(3);
  });

  it('resetWaveSurge deactivates wave surge state', () => {
    setupWaveSurge(g);
    resetWaveSurge(g);
    expect(g.waveSurge.active).toBe(false);
    expect(g.waveSurge.remaining).toBe(0);
  });
});

// ---- setupCombatMission integrates gauntlet and wave_surge ----
describe('setupCombatMission — gauntlet and wave_surge integration', () => {
  let g;

  beforeEach(() => {
    g = createGameState();
    g.level = 3;
  });

  it('gauntlet mission type calls setupGauntlet', () => {
    const mission = generateMission(3, 'gauntlet');
    setupCombatMission(g, mission, 3);
    expect(g.gauntlet.active).toBe(true);
    expect(g.waveSurge.active).toBe(false);
    expect(g.escort.active).toBe(false);
    expect(g.boss.active).toBe(false);
  });

  it('wave_surge mission type calls setupWaveSurge', () => {
    const mission = generateMission(3, 'wave_surge');
    setupCombatMission(g, mission, 3);
    expect(g.waveSurge.active).toBe(true);
    expect(g.gauntlet.active).toBe(false);
    expect(g.escort.active).toBe(false);
    expect(g.boss.active).toBe(false);
  });

  it('non-gauntlet mission resets gauntlet state', () => {
    // First activate gauntlet
    const gauntletMission = generateMission(3, 'gauntlet');
    setupCombatMission(g, gauntletMission, 3);
    expect(g.gauntlet.active).toBe(true);

    // Then switch to a different mission type
    const killMission = generateMission(3, 'combat');
    setupCombatMission(g, killMission, 3);
    expect(g.gauntlet.active).toBe(false);
    expect(g.waveSurge.active).toBe(false);
  });
});

// ---- Gauntlet wave progression in physics loop ----
describe('gauntlet wave progression in physics loop', () => {
  let g;
  let cbs;

  beforeEach(() => {
    g = createGameState();
    g.level = 3;
    g.player.hp = 300;
    g.player.maxHp = 300;
    g.cooldowns = { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 };
    g.settings = g.settings || { difficulty: 'normal' };
    cbs = { setGameState: () => {}, setNotificationVersion: () => {} };

    const mission = generateMission(3, 'gauntlet');
    setupCombatMission(g, mission, 3);
    // Set up a small wave for testing
    g.gauntlet.enemiesPerWave = 2;
    g.gauntlet.enemiesSpawnedInWave = 2; // Pretend 2 enemies already spawned
  });

  it('detects wave complete when all enemies dead and enemiesSpawnedInWave >= enemiesPerWave', () => {
    g.enemies = []; // No enemies alive
    g.gauntlet.enemiesSpawnedInWave = 2;
    g.gauntlet.currentWave = 0;
    g.gauntlet.totalWaves = 3;

    updatePhysics(0.016, g, cbs);

    // Should enter between-waves state
    expect(g.gauntlet.betweenWaves).toBe(true);
  });

  it('does not enter between-waves if enemies still alive', () => {
    g.enemies = [{ active: true, hp: 10 }];
    g.gauntlet.enemiesSpawnedInWave = 2;
    g.gauntlet.currentWave = 0;

    updatePhysics(0.016, g, cbs);

    expect(g.gauntlet.betweenWaves).toBe(false);
  });

  it('does not enter between-waves if enemiesSpawnedInWave < enemiesPerWave', () => {
    g.enemies = [];
    g.gauntlet.enemiesSpawnedInWave = 1;
    g.gauntlet.enemiesPerWave = 2;

    updatePhysics(0.016, g, cbs);

    expect(g.gauntlet.betweenWaves).toBe(false);
  });

  it('wave delay countdown progresses and advances to next wave', () => {
    g.enemies = [];
    g.gauntlet.enemiesSpawnedInWave = 2;
    g.gauntlet.currentWave = 0;
    g.gauntlet.totalWaves = 3;

    // First tick: enter between-waves
    updatePhysics(0.016, g, cbs);
    expect(g.gauntlet.betweenWaves).toBe(true);

    // Tick forward past the wave delay (2 seconds)
    updatePhysics(2.5, g, cbs);

    expect(g.gauntlet.betweenWaves).toBe(false);
    expect(g.gauntlet.currentWave).toBe(1);
    expect(g.gauntlet.enemiesSpawnedInWave).toBe(0);
    expect(g.mission.current).toBe(1);
  });

  it('completes mission progress on last wave', () => {
    g.enemies = [];
    g.gauntlet.enemiesSpawnedInWave = 2;
    g.gauntlet.currentWave = 2; // Last wave (0-indexed, totalWaves=3)
    g.gauntlet.totalWaves = 3;

    updatePhysics(0.016, g, cbs);

    // Should NOT enter between-waves since this is the last wave
    expect(g.gauntlet.betweenWaves).toBe(false);
    expect(g.gauntlet.currentWave).toBe(2);
    expect(g.mission.current).toBe(g.mission.target);
  });
});

describe('sector weather mission setup', () => {
  it('copies generated map weather onto normal node missions', () => {
    const g = createGameState();
    g.map.weatherTypes = ['solarFlare'];

    enterNodeMission(g, 3, 'combat', { id: 'node-1', type: 'combat' });

    expect(g.mission.weatherTypes).toEqual(['solarFlare']);
    expect(g.weather.active).toContain('solarFlare');
  });
});

// ---- Wave surge countdown in physics loop ----
describe('wave surge countdown in physics loop', () => {
  let g;
  let cbs;

  beforeEach(() => {
    g = createGameState();
    g.level = 3;
    g.player.hp = 300;
    g.player.maxHp = 300;
    g.cooldowns = { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 };
    g.settings = g.settings || { difficulty: 'normal' };
    cbs = { setGameState: () => {}, setNotificationVersion: () => {} };

    const mission = generateMission(3, 'wave_surge');
    setupCombatMission(g, mission, 3);
  });

  it('wave surge remaining decreases over time', () => {
    const initial = g.waveSurge.remaining;
    expect(initial).toBe(15);

    updatePhysics(3, g, cbs);

    expect(g.waveSurge.remaining).toBeCloseTo(12, 1);
    expect(g.waveSurge.active).toBe(true);
  });

  it('wave surge deactivates when remaining reaches zero', () => {
    expect(g.waveSurge.active).toBe(true);

    // Mock window for createCompleteMission (called on wave surge completion)
    global.window = { innerWidth: 800, innerHeight: 600 };

    updatePhysics(16, g, cbs);

    expect(g.waveSurge.active).toBe(false);
    expect(g.waveSurge.remaining).toBe(0);
  });

  it('wave surge does not go negative', () => {
    // Mock window for createCompleteMission (called on wave surge completion)
    global.window = { innerWidth: 800, innerHeight: 600 };

    updatePhysics(20, g, cbs);

    expect(g.waveSurge.remaining).toBe(0);
  });
});

// ---- Spawn rate modification during wave surge ----
describe('spawn rate modification during wave surge', () => {
  let g;
  let cbs;

  beforeEach(() => {
    g = createGameState();
    g.level = 3;
    g.player.hp = 300;
    g.player.maxHp = 300;
    g.cooldowns = { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 };
    g.settings = g.settings || { difficulty: 'normal' };
    cbs = { setGameState: () => {}, setNotificationVersion: () => {} };

    const mission = generateMission(3, 'wave_surge');
    setupCombatMission(g, mission, 3);
  });

  it('wave surge active reduces spawn cooldown by spawnRateMult', () => {
    g.spawnCooldown = 0;
    g.waveSurge.active = true;
    g.waveSurge.spawnRateMult = 3;
    g.waveAnnounce = { active: false };

    updatePhysics(0.016, g, cbs);

    // Spawn cooldown should be divided by 3
    expect(g.spawnCooldown).toBeGreaterThan(0);
    expect(g.spawnCooldown).toBeLessThan(1.0); // Normal would be ~2.5, divided by 3 is ~0.83
  });

  it('spawn cooldown is not modified when wave surge is inactive', () => {
    g.spawnCooldown = 0;
    g.waveSurge.active = false;
    g.waveAnnounce = { active: false };

    updatePhysics(0.016, g, cbs);

    // Normal spawn cooldown should be around 2.5 (baseSpawnRate)
    expect(g.spawnCooldown).toBeGreaterThan(1.5);
    expect(g.spawnCooldown).toBeLessThan(3.5);
  });

  it('wave surge spawn rate modification uses spawnRateMult from state', () => {
    g.spawnCooldown = 0;
    g.waveSurge.active = true;
    g.waveSurge.spawnRateMult = 5; // Custom multiplier
    g.waveAnnounce = { active: false };

    updatePhysics(0.016, g, cbs);

    // With 5x multiplier, cooldown should be much smaller
    expect(g.spawnCooldown).toBeLessThan(0.6);
  });
});
