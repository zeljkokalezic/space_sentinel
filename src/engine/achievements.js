/**
 * achievements.js — Achievement tracking and notification system.
 *
 * Defines achievement descriptors, tracks progress, and fires notifications
 * when milestones are reached. Achievements persist in localStorage.
 */

/**
 * Achievement descriptor.
 * @typedef {Object} AchievementDef
 * @property {string} id - Unique achievement identifier
 * @property {string} title - Display title
 * @property {string} description - What the player needs to do
 * @property {string} icon - Emoji or unicode icon
 * @property {Function} check - Function(gameState, stats) => boolean
 * @property {Function} [progress] - Function(gameState, stats) => number 0-1
 */

/**
 * Achievement definitions.
 */
export const ACHIEVEMENTS = [
  {
    id: 'first_blood',
    title: 'First Blood',
    description: 'Destroy your first enemy',
    icon: '🩸',
    check: (stats) => stats.enemiesDestroyed >= 1,
    progress: (stats) => Math.min(1, stats.enemiesDestroyed),
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Destroy 100 enemies',
    icon: '⚔️',
    check: (stats) => stats.enemiesDestroyed >= 100,
    progress: (stats) => Math.min(1, stats.enemiesDestroyed / 100),
  },
  {
    id: 'slayer',
    title: 'Slayer',
    description: 'Destroy 500 enemies',
    icon: '💀',
    check: (stats) => stats.enemiesDestroyed >= 500,
    progress: (stats) => Math.min(1, stats.enemiesDestroyed / 500),
  },
  {
    id: 'scavenger',
    title: 'Scavenger',
    description: 'Collect 1000 scrap',
    icon: '🔩',
    check: (stats) => stats.totalScrap >= 1000,
    progress: (stats) => Math.min(1, stats.totalScrap / 1000),
  },
  {
    id: 'millionaire',
    title: 'Millionaire',
    description: 'Collect 10000 scrap',
    icon: '💰',
    check: (stats) => stats.totalScrap >= 10000,
    progress: (stats) => Math.min(1, stats.totalScrap / 10000),
  },
  {
    id: 'survivor',
    title: 'Survivor',
    description: 'Complete a survive mission',
    icon: '🛡️',
    check: (stats) => stats.surviveMissions >= 1,
    progress: (stats) => Math.min(1, stats.surviveMissions),
  },
  {
    id: 'escort_expert',
    title: 'Escort Expert',
    description: 'Complete 5 escort missions',
    icon: '🚀',
    check: (stats) => stats.escortMissions >= 5,
    progress: (stats) => Math.min(1, stats.escortMissions / 5),
  },
  {
    id: 'defender',
    title: 'Defender',
    description: 'Complete a defend mission',
    icon: '🏰',
    check: (stats) => stats.defendMissions >= 1,
    progress: (stats) => Math.min(1, stats.defendMissions),
  },
  {
    id: 'saboteur',
    title: 'Saboteur',
    description: 'Complete a sabotage mission',
    icon: '💣',
    check: (stats) => stats.sabotageMissions >= 1,
    progress: (stats) => Math.min(1, stats.sabotageMissions),
  },
  {
    id: 'boss_slayer',
    title: 'Boss Slayer',
    description: 'Defeat a sector boss',
    icon: '👑',
    check: (stats) => stats.bossesDefeated >= 1,
    progress: (stats) => Math.min(1, stats.bossesDefeated),
  },
  {
    id: 'level_10',
    title: 'Level 10',
    description: 'Reach level 10',
    icon: '📈',
    check: (stats) => stats.level >= 10,
    progress: (stats) => Math.min(1, stats.level / 10),
  },
  {
    id: 'level_25',
    title: 'Level 25',
    description: 'Reach level 25',
    icon: '🚀',
    check: (stats) => stats.level >= 25,
    progress: (stats) => Math.min(1, stats.level / 25),
  },
  {
    id: 'upgrade_master',
    title: 'Upgrade Master',
    description: 'Max out all upgrade types',
    icon: '🔧',
    check: (stats) => stats.upgradesMaxed >= 9,
    progress: (stats) => Math.min(1, stats.upgradesMaxed / 9),
  },
];

/**
 * Load unlocked achievements from localStorage.
 * @returns {Set<string>} Set of unlocked achievement IDs
 */
export function loadAchievements() {
  try {
    const data = localStorage.getItem('space_sentinel_achievements');
    if (data) {
      return new Set(JSON.parse(data));
    }
  } catch {
    // localStorage unavailable
  }
  return new Set();
}

/**
 * Save unlocked achievements to localStorage.
 * @param {Set<string>} unlocked - Set of unlocked achievement IDs
 */
export function saveAchievements(unlocked) {
  try {
    localStorage.setItem('space_sentinel_achievements', JSON.stringify([...unlocked]));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Check all achievements against current stats and return newly unlocked ones.
 * @param {Set<string>} unlocked - Current unlocked achievements
 * @param {object} stats - Current game stats
 * @returns {{newlyUnlocked: string[], progress: object[]}}
 */
export function checkAchievements(unlocked, stats) {
  const newlyUnlocked = [];
  const progress = [];
  
  for (const achievement of ACHIEVEMENTS) {
    if (unlocked.has(achievement.id)) {
      continue; // Already unlocked
    }
    
    if (achievement.check(stats)) {
      newlyUnlocked.push(achievement.id);
    }
    
    if (achievement.progress) {
      progress.push({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        progress: achievement.progress(stats),
        unlocked: unlocked.has(achievement.id),
      });
    }
  }
  
  return { newlyUnlocked, progress };
}

/**
 * Get achievement details by ID.
 * @param {string} id - Achievement ID
 * @returns {AchievementDef|null}
 */
export function getAchievement(id) {
  return ACHIEVEMENTS.find(a => a.id === id) || null;
}

/**
 * Get all achievement progress for display.
 * @param {Set<string>} unlocked - Unlocked achievements
 * @param {object} stats - Current game stats
 * @returns {object[]}
 */
export function getAchievementProgress(unlocked, stats) {
  const progress = [];
  
  for (const achievement of ACHIEVEMENTS) {
    const prog = achievement.progress ? achievement.progress(stats) : 0;
    progress.push({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      progress: prog,
      unlocked: unlocked.has(achievement.id),
    });
  }
  
  return progress;
}
