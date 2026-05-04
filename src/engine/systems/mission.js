/**
 * systems/mission.js — Mission completion detection, rewards, map progression, transition timer.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

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
    g.enemies = []; g.projectiles = []; g.particles = []; g.pickups = []; g.effects = [];
    g.escort.active = false;
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
  if (g.mission.type === 'survive') {
    g.mission.current += dt;
    if (g.mission.current >= g.mission.target) completeMission();
  }
};

/**
 * The actual mission completion logic: award scrap, update map, advance level.
 * @param {object} g — Game state
 */
export const createCompleteMission = (g) => {
  const C = GAME_CONFIG;
  return () => {
    if (g.mission.completed) return;
    g.scrap += g.mission.reward;
    g.totalScrapEarned += g.mission.reward;
    g.effects.push({
      type: 'mission_complete',
      x: window.innerWidth / 2,
      y: Math.max(100, window.innerHeight / 4),
      text: `AREA CLEARED! +${g.mission.reward} SCRAP`,
      life: C.transition.duration,
    });
    g.mission.completed = true;
    g.transitionTimer = C.transition.duration;

    if (g.mission.type === 'kill_boss') g.isVictory = true;

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
  };
};
