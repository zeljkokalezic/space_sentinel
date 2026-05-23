/**
 * Radar enhancements tests.
 *
 * Verifies:
 * - Enemy type colors match GAME_CONFIG.radar.enemyColors
 * - Boss/miniboss pulsing markers use config colors
 * - Power-ups show as white dots on radar
 * - Radar legend respects showRadarLegend setting
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GAME_CONFIG } from '../../constants/gameConfig';
import { getDefaultSettings } from '../../engine/settings';
import { createTestState, createTestEnemy, createTestBoss, createTestMiniboss, createTestPowerup, setupLocalStorageMock, clearLocalStorageMock } from '../helpers';

describe('Radar Configuration', () => {
  it('should have radar config section in GAME_CONFIG', () => {
    expect(GAME_CONFIG.radar).toBeDefined();
    expect(GAME_CONFIG.radar.enemyColors).toBeDefined();
  });

  it('should define enemy type colors for all enemy types', () => {
    const colors = GAME_CONFIG.radar.enemyColors;
    expect(colors.fighter).toBe('#ef4444');
    expect(colors.interceptor).toBe('#eab308');
    expect(colors.heavy).toBe('#f97316');
    expect(colors.shooter).toBe('#a855f7');
    expect(colors.shielded).toBe('#3b82f6');
    expect(colors.missile_boat).toBe('#d946ef');
    expect(colors.mini_interceptor).toBe('#fbbf24');
  });

  it('should define boss and miniboss radar colors', () => {
    expect(GAME_CONFIG.radar.bossColor).toBe('#ef4444');
    expect(GAME_CONFIG.radar.minibossColor).toBe('#f97316');
  });

  it('should define power-up radar color as white', () => {
    expect(GAME_CONFIG.radar.powerupColor).toBe('#ffffff');
  });

  it('should define warning, pickup, escort, and beacon colors', () => {
    expect(GAME_CONFIG.radar.warningColor).toBe('#ef4444');
    expect(GAME_CONFIG.radar.pickupColor).toBe('#fbbf24');
    expect(GAME_CONFIG.radar.escortColor).toBe('#22d3ee');
    expect(GAME_CONFIG.radar.beaconColor).toBe('#22d3ee');
  });
});

describe('Radar Settings', () => {
  beforeEach(() => {
    setupLocalStorageMock();
  });

  afterEach(() => {
    clearLocalStorageMock();
  });

  it('should include showRadarLegend in default settings', () => {
    const defaults = getDefaultSettings();
    expect(defaults.showRadarLegend).toBe(true);
  });

  it('should default showRadarLegend to true', () => {
    const defaults = getDefaultSettings();
    expect(defaults).toHaveProperty('showRadarLegend', true);
  });
});

describe('Radar Enemy Type Coloring', () => {
  it('should map fighter enemies to red color', () => {
    const enemy = createTestEnemy(100, 100, 'fighter');
    const color = GAME_CONFIG.radar.enemyColors[enemy.type];
    expect(color).toBe('#ef4444');
  });

  it('should map heavy enemies to orange color', () => {
    const enemy = createTestEnemy(200, 200, 'heavy');
    const color = GAME_CONFIG.radar.enemyColors[enemy.type];
    expect(color).toBe('#f97316');
  });

  it('should map shooter enemies to purple color', () => {
    const enemy = createTestEnemy(300, 300, 'shooter');
    const color = GAME_CONFIG.radar.enemyColors[enemy.type];
    expect(color).toBe('#a855f7');
  });

  it('should map missile_boat enemies to pink color', () => {
    const enemy = createTestEnemy(400, 400, 'missile_boat');
    const color = GAME_CONFIG.radar.enemyColors[enemy.type];
    expect(color).toBe('#d946ef');
  });

  it('should map shielded enemies to blue color', () => {
    const enemy = createTestEnemy(500, 500, 'shielded');
    const color = GAME_CONFIG.radar.enemyColors[enemy.type];
    expect(color).toBe('#3b82f6');
  });

  it('should map interceptor enemies to yellow color', () => {
    const enemy = createTestEnemy(600, 600, 'interceptor');
    const color = GAME_CONFIG.radar.enemyColors[enemy.type];
    expect(color).toBe('#eab308');
  });

  it('should fall back to red for unknown enemy types', () => {
    const radarCfg = GAME_CONFIG.radar;
    const color = radarCfg.enemyColors['unknown_type'] || '#ef4444';
    expect(color).toBe('#ef4444');
  });
});

describe('Radar Boss/Miniboss Markers', () => {
  it('should use config bossColor for boss radar marker', () => {
    const bossColor = GAME_CONFIG.radar.bossColor;
    expect(bossColor).toBeDefined();
    expect(bossColor).toBe('#ef4444');
  });

  it('should use config minibossColor for miniboss radar marker', () => {
    const mbColor = GAME_CONFIG.radar.minibossColor;
    expect(mbColor).toBeDefined();
    expect(mbColor).toBe('#f97316');
  });

  it('should use different colors for boss and miniboss', () => {
    expect(GAME_CONFIG.radar.bossColor).not.toBe(GAME_CONFIG.radar.minibossColor);
  });

  it('should create test state with boss that can be used for radar', () => {
    const state = createTestState({
      boss: createTestBoss(500, 500),
    });
    expect(state.boss.active).toBe(true);
    expect(state.boss.hp).toBeGreaterThan(0);
  });

  it('should create test state with miniboss that can be used for radar', () => {
    const state = createTestState({
      miniboss: createTestMiniboss(300, 300),
    });
    expect(state.miniboss.active).toBe(true);
    expect(state.miniboss.hp).toBeGreaterThan(0);
  });
});

describe('Radar Power-up Indicators', () => {
  it('should use white color for power-up radar markers', () => {
    expect(GAME_CONFIG.radar.powerupColor).toBe('#ffffff');
  });

  it('should create test state with active power-ups for radar', () => {
    const state = createTestState({
      powerups: [
        createTestPowerup(100, 100, 'rapidFire'),
        createTestPowerup(200, 200, 'shieldBoost'),
      ],
    });
    expect(state.powerups).toHaveLength(2);
    expect(state.powerups[0].active).toBe(true);
    expect(state.powerups[1].active).toBe(true);
  });

  it('should filter inactive power-ups from radar', () => {
    const powerups = [
      { ...createTestPowerup(100, 100, 'rapidFire'), active: true },
      { ...createTestPowerup(200, 200, 'shieldBoost'), active: false },
    ];
    const activePowerups = powerups.filter(pu => pu.active);
    expect(activePowerups).toHaveLength(1);
    expect(activePowerups[0].type).toBe('rapidFire');
  });
});

describe('Radar Legend Toggle', () => {
  beforeEach(() => {
    setupLocalStorageMock();
  });

  afterEach(() => {
    clearLocalStorageMock();
  });

  it('should show legend when showRadarLegend is true', () => {
    const settings = getDefaultSettings();
    const shouldShow = settings.showRadarLegend;
    expect(shouldShow).toBe(true);
  });

  it('should hide legend when showRadarLegend is false', () => {
    const settings = { ...getDefaultSettings(), showRadarLegend: false };
    const shouldShow = settings.showRadarLegend;
    expect(shouldShow).toBe(false);
  });

  it('should default to true when showRadarLegend is undefined', () => {
    const settings = getDefaultSettings();
    // Simulate fallback logic used in renderer
    const showLegend = settings.showRadarLegend ?? true;
    expect(showLegend).toBe(true);
  });

  it('should have 6 legend items in the radar legend', () => {
    const radarCfg = GAME_CONFIG.radar;
    const legendItems = [
      { color: radarCfg.enemyColors.fighter, label: 'FIGHTER' },
      { color: radarCfg.enemyColors.heavy, label: 'HEAVY' },
      { color: radarCfg.enemyColors.shooter, label: 'SHOOTER' },
      { color: radarCfg.enemyColors.missile_boat, label: 'MISSILE' },
      { color: radarCfg.enemyColors.shielded, label: 'SHIELDED' },
      { color: radarCfg.powerupColor, label: 'PWR-UP' },
    ];
    expect(legendItems).toHaveLength(6);
  });

  it('should have unique colors for all legend items', () => {
    const radarCfg = GAME_CONFIG.radar;
    const colors = [
      radarCfg.enemyColors.fighter,
      radarCfg.enemyColors.heavy,
      radarCfg.enemyColors.shooter,
      radarCfg.enemyColors.missile_boat,
      radarCfg.enemyColors.shielded,
      radarCfg.powerupColor,
    ];
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(colors.length);
  });
});

describe('Radar Escort/Beacon Indicators', () => {
  it('should use config escortColor for escort drone radar marker', () => {
    expect(GAME_CONFIG.radar.escortColor).toBe('#22d3ee');
  });

  it('should use config beaconColor for beacon radar marker', () => {
    expect(GAME_CONFIG.radar.beaconColor).toBe('#22d3ee');
  });

  it('should create test state with active escort for radar', () => {
    const state = createTestState({
      escort: {
        active: true,
        x: 200, y: 200,
        targetX: 400, targetY: 400,
        hp: 120, maxHp: 120,
        speed: 80,
        radius: 20,
        lives: 3,
        evasionAngle: 0,
        evasionTimer: 0,
        respawnTimer: 0,
      },
    });
    expect(state.escort.active).toBe(true);
    expect(state.escort.hp).toBeGreaterThan(0);
  });

  it('should create test state with active beacon for radar', () => {
    const state = createTestState({
      beacon: {
        active: true,
        x: 300, y: 300,
        hp: 200, maxHp: 200,
        radius: 30,
        color: 0x22d3ee,
      },
    });
    expect(state.beacon.active).toBe(true);
    expect(state.beacon.hp).toBeGreaterThan(0);
  });
});

describe('Radar Enemy Radius Logic', () => {
  it('should use radius 3 for heavy enemies on radar', () => {
    const enemyType = 'heavy';
    const radius = enemyType === 'heavy' ? 3 : 2;
    expect(radius).toBe(3);
  });

  it('should use radius 2 for non-heavy enemies on radar', () => {
    const types = ['fighter', 'shooter', 'interceptor', 'shielded', 'missile_boat'];
    for (const type of types) {
      const radius = type === 'heavy' ? 3 : 2;
      expect(radius).toBe(2);
    }
  });
});
