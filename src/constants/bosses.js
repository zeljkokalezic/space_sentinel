/**
 * bosses.js — Boss and mini-boss roster data.
 *
 * Each variant defines:
 *   - Identity: id, name, title, introText
 *   - Appearance: color, innerColor, geometry, radius
 *   - Stats: baseHp/hpPercent, hpPerLevel, speed, speedPerLevel
 *   - Attacks: attackPatterns { phase1, phase2, phase3 } referencing ATTACK_PATTERNS keys
 *   - Death: deathColors, guaranteedDrops, scrapReward
 *
 * Full bosses use baseHp + level * hpPerLevel.
 * Mini-bosses use hpPercent of full boss HP.
 *
 * Usage:
 *   BOSS_ROSTER[level % BOSS_ROSTER.length]  // deterministic by level
 *   MINIBOSS_ROSTER[level % MINIBOSS_ROSTER.length]
 */

/**
 * Full boss variants (sector-end fights).
 */
export const BOSS_ROSTER = [
  {
    id: 'void_reaper',
    name: 'Void Reaper',
    title: 'Destroy the Void Reaper',
    introText: 'The Void Reaper awakens...',
    color: 0xdc2626,
    innerColor: 0xff4444,
    geometry: 'box',
    radius: 60,
    baseHp: 1500,
    hpPerLevel: 200,
    speed: 60,
    speedPerLevel: 3,
    attackPatterns: {
      phase1: 'single_aimed',
      phase2: 'spread_shot',
      phase3: 'spiral_barrage',
    },
    deathColors: [0xdc2626, 0xfbbf24],
    guaranteedDrops: ['shieldBoost', 'damageSurge'],
    scrapReward: 500,
  },

  {
    id: 'nexus_prime',
    name: 'Nexus Prime',
    title: 'Destroy Nexus Prime',
    introText: 'Nexus Prime locks on!',
    color: 0x9333ea,
    innerColor: 0xc084fc,
    geometry: 'dodecahedron',
    radius: 70,
    baseHp: 2000,
    hpPerLevel: 250,
    speed: 50,
    speedPerLevel: 2,
    attackPatterns: {
      phase1: 'double_aimed',
      phase2: 'wide_spread',
      phase3: 'orbiting_mines',
    },
    deathColors: [0x9333ea, 0xe9d5ff],
    guaranteedDrops: ['shieldBoost', 'damageSurge'],
    scrapReward: 600,
  },

  {
    id: 'phantom_warden',
    name: 'Phantom Warden',
    title: 'Destroy the Phantom Warden',
    introText: 'The Phantom Warden descends!',
    color: 0x22d3ee,
    innerColor: 0x67e8f9,
    geometry: 'octahedron',
    radius: 55,
    baseHp: 1200,
    hpPerLevel: 180,
    speed: 80,
    speedPerLevel: 4,
    attackPatterns: {
      phase1: 'single_aimed',
      phase2: 'zigzag_spread',
      phase3: 'homing_burst',
    },
    deathColors: [0x22d3ee, 0xff4444],
    guaranteedDrops: ['shieldBoost', 'damageSurge'],
    scrapReward: 550,
  },
];

/**
 * Mini-boss variants (mid-sector fights, every 3 levels).
 */
export const MINIBOSS_ROSTER = [
  {
    id: 'scout_alpha',
    name: 'Scout Alpha',
    title: 'Destroy Scout Alpha',
    introText: 'Scout Alpha intercepts!',
    color: 0xf97316,
    innerColor: 0xfb923c,
    geometry: 'box',
    radius: 40,
    hpPercent: 0.4,
    speed: 50,
    speedPerLevel: 2,
    attackPatterns: {
      phase1: 'single_aimed',
      phase2: 'spread_shot',
      phase3: 'burst_ring',
    },
    deathColors: [0xf97316, 0xfbbf24],
    guaranteedDrops: null,
    scrapReward: 100,
  },

  {
    id: 'razor_wing',
    name: 'Razor Wing',
    title: 'Destroy Razor Wing',
    introText: 'Razor Wing dives in!',
    color: 0xeab308,
    innerColor: 0xfde047,
    geometry: 'tetrahedron',
    radius: 38,
    hpPercent: 0.35,
    speed: 65,
    speedPerLevel: 3,
    attackPatterns: {
      phase1: 'single_aimed',
      phase2: 'double_aimed',
      phase3: 'spread_shot',
    },
    deathColors: [0xeab308, 0xfbbf24],
    guaranteedDrops: null,
    scrapReward: 120,
  },

  {
    id: 'iron_hull',
    name: 'Iron Hull',
    title: 'Destroy Iron Hull',
    introText: 'Iron Hull advances!',
    color: 0x6b7280,
    innerColor: 0x9ca3af,
    geometry: 'icosahedron',
    radius: 45,
    hpPercent: 0.5,
    speed: 40,
    speedPerLevel: 2,
    attackPatterns: {
      phase1: 'single_aimed',
      phase2: 'spread_shot',
      phase3: 'wide_spread',
    },
    deathColors: [0x6b7280, 0xd1d5db],
    guaranteedDrops: null,
    scrapReward: 150,
  },
];
