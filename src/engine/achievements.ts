/**
 * achievements.ts — Achievement tracking and notification system.
 */

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (stats: Record<string, number>) => boolean;
  progress?: (stats: Record<string, number>) => number;
}

export interface AchievementProgress {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  unlocked: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
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
    check: (stats) => (stats.level ?? 0) >= 10,
    progress: (stats) => Math.min(1, (stats.level ?? 0) / 10),
  },
  {
    id: 'level_25',
    title: 'Level 25',
    description: 'Reach level 25',
    icon: '🚀',
    check: (stats) => (stats.level ?? 0) >= 25,
    progress: (stats) => Math.min(1, (stats.level ?? 0) / 25),
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

export function loadAchievements(): Set<string> {
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

export function saveAchievements(unlocked: Set<string>): void {
  try {
    localStorage.setItem('space_sentinel_achievements', JSON.stringify([...unlocked]));
  } catch {
    // localStorage unavailable
  }
}

export function checkAchievements(
  unlocked: Set<string>,
  stats: Record<string, number>,
): { newlyUnlocked: string[]; progress: AchievementProgress[] } {
  const newlyUnlocked: string[] = [];
  const progress: AchievementProgress[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked.has(achievement.id)) {
      if (achievement.progress) {
        progress.push({
          id: achievement.id,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          progress: achievement.progress(stats),
          unlocked: true,
        });
      }
      continue;
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
        unlocked: false,
      });
    }
  }

  return { newlyUnlocked, progress };
}

export function getAchievement(id: string): AchievementDef | null {
  return ACHIEVEMENTS.find(a => a.id === id) || null;
}

export function getAchievementProgress(
  unlocked: Set<string>,
  stats: Record<string, number>,
): AchievementProgress[] {
  const progress: AchievementProgress[] = [];

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
