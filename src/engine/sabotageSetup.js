/**
 * sabotageSetup.js — Reusable sabotage mission initialization.
 * Called from App.jsx (dev mode) and MapOverlay.jsx (normal play) when
 * the selected mission type is 'sabotage'.
 */
import { GAME_CONFIG } from '../constants/gameConfig';

/**
 * Initialize sabotage structures for a sabotage-type mission.
 * @param {object} g — Game state (game.current)
 * @param {number} level — Current player level
 */
export const setupSabotage = (g, level) => {
  const C = GAME_CONFIG;
  const cfg = C.sabotage;

  // Calculate number of structures (scales with level, capped)
  const count = Math.min(
    cfg.maxStructures,
    cfg.baseStructures + Math.floor(level / 2) * cfg.structuresPer2Levels
  );

  const structures = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
    const dist = cfg.spawnSpreadMin + Math.random() * (cfg.spawnSpreadMax - cfg.spawnSpreadMin);

    structures.push({
      x: g.player.x + Math.cos(angle) * dist,
      y: g.player.y + Math.sin(angle) * dist,
      hp: cfg.structureHp + level * cfg.hpPerLevel,
      maxHp: cfg.structureHp + level * cfg.hpPerLevel,
      radius: cfg.structureRadius,
      fireCooldown: cfg.fireCooldown,
      active: true,
    });
  }

  g.sabotage.active = true;
  g.sabotage.structures = structures;
};

/**
 * Reset sabotage state (called when mission is NOT sabotage type).
 * @param {object} g — Game state (game.current)
 */
export const resetSabotage = (g) => {
  g.sabotage.active = false;
  g.sabotage.structures = [];
};
