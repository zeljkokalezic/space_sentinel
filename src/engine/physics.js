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
import { updateAdaptiveDifficulty, getAdaptiveSpawnCooldown, getAdaptiveAggression } from './adaptiveDifficulty';

// Systems
import { updateTransition, createCompleteMission, checkMissionProgress } from './systems/mission';
import { updatePlayer }       from './systems/playerMovement';
import { updateWeapons } from './systems/weapons';
import { updateProjectiles } from './systems/projectiles';
import { updateEnemies } from './systems/enemies';
import { updatePickups } from './systems/pickups';
import { updatePowerups } from './systems/powerups';
import { updateParticles, updateEffects, updateScreenShake, updateHitStop, updatePlayerIFrames, updatePowerupAuras } from './systems/particles';
import { updateEscort } from './systems/escort';
import { updateBeacon } from './systems/beaconSystem';
import { updateSabotage } from './systems/sabotage';
import { updateBoss } from './systems/boss';
import { updateMiniboss } from './systems/miniboss';
import { updateAudio } from './systems/audio';
import { updateWaveAnnounce } from './systems/waveAnnounce';
import { updateEnvironmentalHazards } from './systems/environmentalHazards';
import { updateDeathPulses } from './systems/deathPulses';
import { updateAttackWarnings } from './systems/attackWarnings';
import { cleanup } from './systems/cleanup';
import { updateLowHpWarning } from './lowHpWarning';
import { updateDynamicFov } from './systems/dynamicFov';
import { updateSpawnFlashes } from './spawner';
import { updateWeather } from './systems/weather';
import { applyPerFrameEffects } from './relicSystem';

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
  const completeMission = createCompleteMission(g, cbs);

  // ─── Mission progress check (survive type) ────────────────────────────────────
  checkMissionProgress(dt, g, completeMission);

  // ─── Adaptive difficulty update ──────────────────────────────────────────────
  updateAdaptiveDifficulty(dt, g);

  // ─── Time & spawn ─────────────────────────────────────────────────────────────
  g.totalTime += dt;
  g.spawnCooldown -= dt;

  // Wave announcement countdown (blocks spawning while active)
  updateWaveAnnounce(dt, g);

  const C = GAME_CONFIG;
  // Apply veteran mode difficulty if unlocked (S-rank sectors)
  const activeDifficulty = g.sector?.veteranMode ? 'veteran' : (g.settings?.difficulty || 'normal');
  const currentDiffMult = calculateDifficultyMultiplier(g.level, g.totalTime, activeDifficulty);
  const currentSpawnRate = Math.max(0.1, C.enemies.baseSpawnRate - (g.level * C.enemies.spawnRateLevelDecay) - (g.totalTime * C.enemies.spawnRateTimeDecay));

  if (g.spawnCooldown <= 0 && !(g.waveAnnounce && g.waveAnnounce.active)) {
    spawnEnemy(g);
    let nextCooldown = currentSpawnRate + Math.random() * C.enemies.spawnCooldownVariance;
    // Apply adaptive difficulty spawn cooldown adjustment
    nextCooldown = getAdaptiveSpawnCooldown(g, nextCooldown);
    // Wave surge: multiply spawn cooldown by inverse of spawnRateMult (faster spawning)
    if (g.waveSurge?.active) {
      nextCooldown /= g.waveSurge.spawnRateMult;
    }
    g.spawnCooldown = nextCooldown;
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
  const adaptiveAggression = getAdaptiveAggression(g);
  updateEnemies(enemyDt, g, currentDiffMult, completeMission, setGameState, adaptiveAggression);
  if (g.player.hp <= 0) return;

  // ─── Gauntlet wave management ──────────────────────────────────────────
  if (g.gauntlet?.active && g.mission) {
    // Check if current wave is complete (all enemies in wave dead)
    if (!g.gauntlet.betweenWaves && g.enemies.length === 0 && g.gauntlet.enemiesSpawnedInWave >= g.gauntlet.enemiesPerWave) {
      // Wave cleared — check if more waves remain
      if (g.gauntlet.currentWave < g.gauntlet.totalWaves - 1) {
        // Start between-waves delay
        g.gauntlet.betweenWaves = true;
        g.gauntlet.waveDelay = GAME_CONFIG.gauntlet?.waveDelay ?? 2;
        g.spawnCooldown = 999; // Stop spawning during delay
      } else {
        g.mission.current = g.mission.target;
      }
    }

    // Between-waves countdown
    if (g.gauntlet.betweenWaves) {
      g.gauntlet.waveDelay -= dt;
      if (g.gauntlet.waveDelay <= 0) {
        g.gauntlet.betweenWaves = false;
        g.gauntlet.currentWave++;
        g.gauntlet.enemiesSpawnedInWave = 0;
        g.mission.current = g.gauntlet.currentWave;
        g.spawnCooldown = 0.5; // Resume spawning
      }
    }
  }

  // ─── Wave surge countdown ──────────────────────────────────────────────
  if (g.waveSurge?.active) {
    g.waveSurge.remaining -= dt;
    if (g.waveSurge.remaining <= 0) {
      g.waveSurge.active = false;
      g.waveSurge.remaining = 0;
    }
  }

  // ─── Attack warning indicators (telegraphing) ────────────────────────────
  updateAttackWarnings(dt, g);

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

  // ─── Player invincibility frames (i-frames) ──────────
  updatePlayerIFrames(dt, g);

  // ─── Low HP warning (visual + audio) ─────────────────
  updateLowHpWarning(dt, g);

  // ─── Dynamic FOV (camera tension/release) ────────────
  updateDynamicFov(dt, g);

  // ─── Death pulse shockwaves ──────────────────────────
  updateDeathPulses(dt, g, completeMission);
  if (g.player.hp <= 0) {
    setGameState('gameover');
    return;
  }

  // ─── Enemy spawn flash effects ───────────────────────
  updateSpawnFlashes(dt, g);

  // ─── Power-up aura ring effects ──────────────────────
  updatePowerupAuras(dt, g);

  // ─── Escort mission logic ────────────────────────────
  if (updateEscort(dt, g, currentDiffMult, completeMission, setGameState, adaptiveAggression)) return;

  // ─── Beacon mission logic ────────────────────────────────────────────────────
  if (updateBeacon(dt, g, currentDiffMult, completeMission, setGameState)) return;

  // ─── Sabotage mission logic ──────────────────────────────────────────────────
  if (updateSabotage(dt, g, currentDiffMult, completeMission)) return;

  // ─── Boss fight logic ────────────────────────────────────────────────────────
  if (updateBoss(dt, g, currentDiffMult, completeMission, setGameState)) return;

  // ─── Mini-boss fight logic ───────────────────────────────────────────────────
  if (updateMiniboss(dt, g, currentDiffMult, completeMission, setGameState)) return;

  // ─── Weather system update ────────────────────────────────────────────────
  updateWeather(dt, g);

  // ─── Relic per-frame effects ──────────────────────────────────────────────
  applyPerFrameEffects(dt, g);

  // ─── Pool cleanup (every 5 seconds) ──────────────────────────────────────────
  cleanup(dt, g);
};
