/**
 * systems/mission.js — Mission completion detection, rewards, map progression, transition timer.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { UPGRADE_DATA } from '../../constants/upgrades';
import { SoundManager } from '../audio';
import { checkAchievements, saveAchievements, getAchievement } from '../achievements';
import { autoSave } from '../saveManager';
import { recordMissionCompletion as recordAdaptiveMission } from '../adaptiveDifficulty';
import { recordMissionCompletion as recordSectorMission } from '../sectorRank';
import { getScrapMultiplier } from '../difficulty';
import { tryAddRelic, getRandomRelic } from '../relicSystem';
import { clearMissionState } from '../stateCleanup';
import { spawnEffect } from '../pool';

/**
 * Handle the post-mission transition timer. If active, counts down and switches to map/victory.
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {object} cbs — { setGameState, setMapStateVersion }
 * @returns {boolean} true if transition is active (should skip other updates)
 */
export const updateTransition = (dt, g, cbs) => {
  if (g.transitionTimer === undefined) return false;

  g.transitionTimer -= dt;
  if (g.transitionTimer <= 0) {
    if (g.isVictory) {
      cbs.setGameState('victory');
    } else {
      cbs.setGameState('map');
      cbs.setMapStateVersion(v => v + 1);
    }
    g.transitionTimer = undefined;
    clearMissionState(g);
  }
  return true;
};

/**
 * Check survive-type mission progress and trigger completion.
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {function} completeMission — Mission completion callback
 */
export const checkMissionProgress = (dt, g, completeMission) => {
  if (!g.mission || g.mission.completed) return;
  if (g.mission.type === 'survive' || g.mission.type === 'defend') {
    g.mission.current += dt;
    if (g.mission.current >= g.mission.target) completeMission();
  }
  // Gauntlet: complete when all waves cleared (mission.current tracks currentWave, target is totalWaves)
  if (g.mission.type === 'gauntlet' && g.gauntlet?.active) {
    if (g.mission.current >= g.mission.target && !g.gauntlet.betweenWaves) {
      completeMission();
    }
  }
  // Wave surge: complete when timer expires
  if (g.mission.type === 'wave_surge' && g.waveSurge?.active) {
    g.mission.current += dt;
    if (g.mission.current >= g.mission.target) completeMission();
  }
};

/**
 * The actual mission completion logic: award scrap, update map, advance level.
 * Also tracks persistent stats and checks achievements.
 * @param {object} g — Game state
 */
export const createCompleteMission = (g) => {
  const C = GAME_CONFIG;
  return () => {
    if (g.mission.completed) return;
    SoundManager.play('mission_complete');

    // Apply veteran mode scrap multiplier (1.5x)
    const activeDifficulty = g.sector?.veteranMode ? 'veteran' : (g.settings?.difficulty || 'normal');
    const scrapMult = getScrapMultiplier(activeDifficulty);
    const reward = Math.round(g.mission.reward * scrapMult);

    g.scrap += reward;
    g.totalScrapEarned += reward;

    // Track persistent stats
    if (!g.stats) {
      g.stats = {
        enemiesDestroyed: 0, totalScrap: 0,
        surviveMissions: 0, escortMissions: 0,
        defendMissions: 0, sabotageMissions: 0,
        bossesDefeated: 0, minibossesDefeated: 0, upgradesMaxed: 0,
      };
    }
    g.stats.totalScrap += g.mission.reward;
    if (g.mission.type === 'survive') g.stats.surviveMissions++;
    if (g.mission.type === 'escort') g.stats.escortMissions++;
    if (g.mission.type === 'defend') g.stats.defendMissions++;
    if (g.mission.type === 'sabotage') g.stats.sabotageMissions++;
    if (g.mission.type === 'kill_boss') g.stats.bossesDefeated++;
    if (g.mission.type === 'kill_miniboss') g.stats.minibossesDefeated = (g.stats.minibossesDefeated || 0) + 1;

    // Check achievements
    if (!g.achievements) {
      g.achievements = { unlocked: new Set(), notifications: [] };
    }
    const result = checkAchievements(g.achievements.unlocked, {
      ...g.stats,
      level: g.level,
      upgradesMaxed: countUpgradesMaxed(g.levels),
    });
    for (const id of result.newlyUnlocked) {
      g.achievements.unlocked.add(id);
      const def = getAchievement(id);
      if (def) {
        g.achievements.notifications.push({
          id: def.id,
          title: def.title,
          description: def.description,
          icon: def.icon,
          timer: 6, // seconds to show
        });
      }
    }
    if (result.newlyUnlocked.length > 0) {
      g.achievementVersion++;
      saveAchievements(g.achievements.unlocked);
    }

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    spawnEffect(g, {
      type: 'mission_complete',
      x: vw / 2,
      y: Math.max(100, vh / 4),
      text: `AREA CLEARED! +${reward} SCRAP`,
      life: C.transition.duration,
    });
    g.mission.completed = true;
    g.transitionTimer = C.transition.duration;

    // Auto-save on mission completion
    autoSave(g);

    if (g.mission.type === 'kill_boss') g.isVictory = true;

    // Record mission completion for adaptive difficulty / rampage mode tracking
    recordAdaptiveMission(g);

    // Record mission completion for sector rank calculation
    recordSectorMission(g);

    if (g.map.currentNodeId) {
      let cur = g.map.nodes.find(n => n.id === g.map.currentNodeId);
      if (cur) cur.status = 'cleared';

      let nextEdges = g.map.edges.filter(e => e.from === g.map.currentNodeId);
      nextEdges.forEach(e => {
        let n = g.map.nodes.find(node => node.id === e.to);
        if (n) n.status = 'available';
      });
    }
    g.level++;

    // Random relic find on combat mission clear (5% chance)
    if (Math.random() < 0.05) {
      const relic = getRandomRelic('rare');
      if (relic) {
        tryAddRelic(g, relic.id);
      }
    }
  };
};

/**
 * Count how many upgrade types are at max level.
 */
function countUpgradesMaxed(levels) {
  let count = 0;
  for (const key of Object.keys(levels)) {
    const maxLevel = UPGRADE_DATA[key]?.maxLevel;
    if (maxLevel !== undefined && levels[key] >= maxLevel) count++;
  }
  return count;
}

/**
 * Trigger game over: play the game_over sound.
 * Call this when the player is destroyed (from enemies.js, escort.js, etc.).
 */
export const triggerGameOver = () => {
  SoundManager.play('game_over');
};
