/**
 * physics.js — Main game-loop physics & simulation step.
 * Delegates to individual systems for modular, testable simulation.
 *
 * @param {number} dt      - Delta time in seconds
 * @param {object} g       - Live game state (game.current)
 * @param {object} cbs     - { setGameState, setMapStateVersion }
 */
import { GAME_CONFIG } from '../constants/gameConfig';
import { spawnEnemy } from './spawner';
import { getNearestHostileTarget } from './targeting';
import { calculateDifficultyMultiplier } from './difficulty';

// Systems
import { updateTransition, createCompleteMission, checkMissionProgress } from './systems/mission';
import { updatePlayer }       from './systems/playerMovement';
import { updateWeapons } from './systems/weapons';
import { updateProjectiles } from './systems/projectiles';
import { updateEnemies } from './systems/enemies';
import { updatePickups } from './systems/pickups';
import { updatePowerups } from './systems/powerups';
import { updateParticles, updateEffects, updateScreenShake, updateHitStop } from './systems/particles';
import { updateEscort } from './systems/escort';
import { updateBeacon } from './systems/beacon';
import { updateSabotage } from './systems/sabotage';
import { updateBoss } from './systems/boss';
import { updateMiniboss } from './systems/miniboss';
import { updateAudio } from './systems/audio';
import { updateWaveAnnounce } from './systems/waveAnnounce';
import { updateEnvironmentalHazards } from './systems/environmentalHazards';
import { updateDeathPulses } from './systems/deathPulses';
import { cleanup } from './systems/cleanup';
import { updateLowHpWarning } from './lowHpWarning';

export const updatePhysics = (dt, g, cbs) => {
  const { setGameState, setNotificationVersion } = cbs;

  // Signal React when achievement notifications change
  if (setNotificationVersion && g.achievementVersion !== g._lastNotifVersion) {
    g._lastNotifVersion = g.achievementVersion;
    setNotificationVersion(g.achievementVersion);
  }

  // ─── Hit stop (freeze frame) — skip physics while counting down ────────────
  if (updateHitStop(dt, g)) return;

  // ─── Transition timer (runs after mission complete, before returning to map) ───
  if (updateTransition(dt, g, cbs)) return;

  // ─── Mission completion factory ───────────────────────────────────────────────
  const completeMission = createCompleteMission(g);

  // ─── Mission progress check (survive type) ────────────────────────────────────
  checkMissionProgress(dt, g, completeMission);

  // ─── Time & spawn ─────────────────────────────────────────────────────────────
  g.totalTime += dt;
  g.spawnCooldown -= dt;

  // Wave announcement countdown (blocks spawning while active)
  updateWaveAnnounce(dt, g);

  const C = GAME_CONFIG;
  const currentDiffMult = calculateDifficultyMultiplier(g.level, g.totalTime, g.settings?.difficulty);
  const currentSpawnRate = Math.max(0.1, C.enemies.baseSpawnRate - (g.level * C.enemies.spawnRateLevelDecay) - (g.totalTime * C.enemies.spawnRateTimeDecay));

  if (g.spawnCooldown <= 0 && !(g.waveAnnounce && g.waveAnnounce.active)) {
    spawnEnemy(g);
    g.spawnCooldown = currentSpawnRate + Math.random() * C.enemies.spawnCooldownVariance;
  }

  // ─── Player movement (yaw-based) ──────────────────────────────────────────────
  updatePlayer(dt, g);

  // ─── Audio event detection & playback ─────────────────────────────────────────
  updateAudio(dt, g);

  // ─── Aiming (turret tracking) ─────────────────────────────────────────────────
  let adx = g.worldMouse.x - g.player.x;
  let ady = g.worldMouse.y - g.player.y;
  if (g.touchBase && g.touchCurrent) {
    adx = Math.cos(g.player.yaw);
    ady = Math.sin(g.player.yaw);
  }
  if (g.levels.autoAim > 0) {
    const ne = getNearestHostileTarget(g.player.x, g.player.y, g);
    if (ne) { adx = ne.x - g.player.x; ady = ne.y - g.player.y; }
    else    { adx = Math.cos(g.player.yaw); ady = Math.sin(g.player.yaw); }
  }
  const targetAim = Math.atan2(ady, adx);
  if (g.player.aimAngle === undefined) g.player.aimAngle = targetAim;
  let adiff = targetAim - g.player.aimAngle;
  while (adiff >  Math.PI) adiff -= Math.PI * 2;
  while (adiff < -Math.PI) adiff += Math.PI * 2;
  g.player.aimAngle += adiff * 15 * dt;

  // ─── Weapon cooldowns ─────────────────────────────────────────────────────────
  for (let k in g.cooldowns) g.cooldowns[k] -= dt;

  // ─── Weapons firing ───────────────────────────────────────────────────────────
  updateWeapons(dt, g, completeMission);

  // ─── Projectile simulation ────────────────────────────────────────────────────
  updateProjectiles(dt, g, setGameState);
  if (g.player.hp <= 0) return;

 // ─── Enemy AI & collision ─────────────────────────────────────────────
  const enemyDt = g.activeBuffs.timeSlow ? dt * 0.5 : dt;
  updateEnemies(enemyDt, g, currentDiffMult, completeMission, setGameState);
  if (g.player.hp <= 0) return;

  // ─── Environmental hazards ────────────────────────────────────────────────────
  if (updateEnvironmentalHazards(dt, g, completeMission, setGameState)) return;

  // ─── Pickup magnet ────────────────────────────────────────────────────────────
  updatePickups(dt, g, completeMission);

  // ─── Power-up pickup & buff management ──────────────────────────────────────
  updatePowerups(dt, g, completeMission);

 // ─── Particles ────────────────────────────────────────
  updateParticles(dt, g);

  // ─── Effects ──────────────────────────────────────────
  updateEffects(dt, g);

  // ─── Screen shake decay ──────────────────────────────
  updateScreenShake(dt, g);

  // ─── Low HP warning (visual + audio) ─────────────────
  updateLowHpWarning(dt, g);

  // ─── Death pulse shockwaves ──────────────────────────
  updateDeathPulses(dt, g);
  if (g.player.hp <= 0) return;

  // ─── Escort mission logic ────────────────────────────
  if (updateEscort(dt, g, currentDiffMult, completeMission, setGameState)) return;

  // ─── Beacon mission logic ────────────────────────────────────────────────────
  if (updateBeacon(dt, g, currentDiffMult, completeMission, setGameState)) return;

  // ─── Sabotage mission logic ──────────────────────────────────────────────────
  if (updateSabotage(dt, g, currentDiffMult, completeMission)) return;

  // ─── Boss fight logic ────────────────────────────────────────────────────────
  if (updateBoss(dt, g, currentDiffMult, completeMission, setGameState)) return;

  // ─── Mini-boss fight logic ───────────────────────────────────────────────────
  if (updateMiniboss(dt, g, currentDiffMult, completeMission, setGameState)) return;

  // ─── Pool cleanup (every 5 seconds) ──────────────────────────────────────────
  cleanup(dt, g);
};
