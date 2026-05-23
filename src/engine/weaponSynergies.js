/**
 * weaponSynergies.js — Synergy check and application logic.
 *
 * Pure helper functions (no React imports) that inspect weapon levels
 * and return active synergies, or apply per-weapon modifications.
 *
 * Integration into the game loop (Part 6) wires these into combat.js
 * and the weapon-fire code paths.
 */

import { GAME_CONFIG } from '../constants/gameConfig';

/**
 * Determine which synergies are active for the given weapon levels.
 *
 * A synergy is active when ALL of its required weapon levels are met.
 *
 * @param {object} levels — Weapon level map, e.g. { autocannon: 5, plasma: 3, ... }
 * @returns {Array<{id: string, config: object}>} Active synergies
 */
export function getActiveSynergies(levels) {
  const synergies = GAME_CONFIG.weaponSynergies;
  const active = [];

  for (const [id, config] of Object.entries(synergies)) {
    const req = config.requirements;
    let met = true;
    for (const [weapon, requiredLevel] of Object.entries(req)) {
      if ((levels[weapon] ?? 0) < requiredLevel) {
        met = false;
        break;
      }
    }
    if (met) {
      active.push({ id, config });
    }
  }

  return active;
}

/**
 * Apply plasma-specific synergy modifications to a projectile config.
 *
 * If Penetration synergy is active, the plasma projectile gains
 * armorPierce capability and a distinct purple color.
 *
 * @param {object} projectileConfig — Mutable projectile config object
 * @param {Array<{id: string, config: object}>} activeSynergies
 * @returns {object} The (possibly modified) projectileConfig
 */
export function applyPlasmaSynergy(projectileConfig, activeSynergies) {
  const pen = activeSynergies.find(s => s.id === 'penetration');
  if (pen) {
    projectileConfig.armorPierce = true;
    projectileConfig.color = pen.config.plasmaPierceColor;
    projectileConfig.shieldBypassHits = pen.config.shieldBypassHits;
  }
  return projectileConfig;
}

/**
 * Apply autocannon-specific synergy modifications to a projectile config.
 *
 * If Guided Rounds synergy is active, there is a chance the projectile
 * gains homing/guided behavior.
 *
 * @param {object} projectileConfig — Mutable projectile config object
 * @param {Array<{id: string, config: object}>} activeSynergies
 * @returns {object} The (possibly modified) projectileConfig
 */
export function applyAutocannonSynergy(projectileConfig, activeSynergies) {
  const guided = activeSynergies.find(s => s.id === 'guidedRounds');
  if (guided && Math.random() < guided.config.chance) {
    projectileConfig.guided = true;
    projectileConfig.steerAngle = guided.config.steerAngle;
  }
  return projectileConfig;
}

/**
 * Apply chain-reaction synergy on missile kill.
 *
 * If Chain Reaction synergy is active, finds enemies within the chain
 * radius of the killed enemy and fires point-defense projectiles at them.
 *
 * @param {object} killedEnemy — Enemy that was just destroyed
 * @param {object} g — Live game state
 * @param {Array<{id: string, config: object}>} activeSynergies
 * @returns {Array<object>} Array of enemies targeted by chain reaction
 */
export function applyMissileKillSynergy(killedEnemy, g, activeSynergies) {
  const chain = activeSynergies.find(s => s.id === 'chainReaction');
  if (!chain) return [];

  const { x, y } = killedEnemy;
  const radius = chain.config.chainRadius;

  const targets = [];
  for (const e of g.enemies) {
    if (!e.active || e === killedEnemy) continue;
    const dist = Math.hypot(e.x - x, e.y - y);
    if (dist <= radius) {
      targets.push(e);
    }
  }

  return targets;
}

/**
 * Calculate effective point defense max hits with synergy bonuses.
 *
 * If Piercing Defense synergy is active, adds extra hits on top of
 * the base max hits.
 *
 * @param {number} baseMaxHits — Base max hits from point defense level
 * @param {Array<{id: string, config: object}>} activeSynergies
 * @returns {number} Effective max hits
 */
export function applyPointDefenseSynergy(baseMaxHits, activeSynergies) {
  const pierce = activeSynergies.find(s => s.id === 'piercingDefense');
  if (pierce) {
    return baseMaxHits + pierce.config.extraHits;
  }
  return baseMaxHits;
}
