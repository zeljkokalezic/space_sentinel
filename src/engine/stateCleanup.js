/**
 * stateCleanup.js — Reset all per-mission state to defaults.
 * Used by: mission transition (mission.js), nextSector (App.jsx),
 * emergency beacon respawn (App.jsx).
 *
 * Centralizes cleanup so no per-mission state leaks between missions.
 */
import {
  createDefaultEscort,
  createDefaultBeacon,
  createDefaultSabotage,
  createDefaultBoss,
  createDefaultMiniboss,
  createDefaultGauntlet,
  createDefaultWaveSurge,
  createDefaultScreenShake,
  createDefaultLowHpWarning,
  createDefaultHitStop,
  createDefaultPlayerIFrames,
  createDefaultDynamicFov,
  createDefaultWeather,
} from './state';

/**
 * Reset all per-mission state to defaults.
 *
 * Preserves: player stats (hp, shield, scrap, levels, skills, sector),
 * persistent data (achievements, stats, settings, unlockedSkins, relics),
 * map state, audio settings, and ship skin.
 */
export const clearMissionState = (g) => {
  // ── Entity arrays ──
  g.enemies = [];
  g.projectiles = [];
  g.particles = [];
  g.pickups = [];
  g.effects = [];
  g.powerups = [];
  g.hazards = [];

  // ── Visual / effect arrays ──
  g.attackWarnings = [];
  g.deathPulses = [];
  g.spawnFlashes = [];
  g.scrapFloats = [];
  g.powerupAuras = [];

  // ── Combo / streak ──
  if (g.combo) {
    g.combo.count = 0;
    g.combo.timer = 0;
    g.combo.multiplier = 1;
  }

  // ── Active buffs ──
  if (g.activeBuffs) g.activeBuffs = {};

  // ── Wave announce ──
  if (g.waveAnnounce) {
    g.waveAnnounce.active = false;
    g.waveAnnounce.wave = 1;
    g.waveAnnounce.timer = 0;
  }

  // ── Screen effects ──
  if (g.screenFlash) {
    g.screenFlash.active = false;
    g.screenFlash.remaining = 0;
  }
  if (g.screenShake) Object.assign(g.screenShake, createDefaultScreenShake());
  else g.screenShake = createDefaultScreenShake();
  if (g.hitStop) Object.assign(g.hitStop, createDefaultHitStop());
  else g.hitStop = createDefaultHitStop();

  // ── Player state ──
  if (g.playerIFrames) Object.assign(g.playerIFrames, createDefaultPlayerIFrames());
  else g.playerIFrames = createDefaultPlayerIFrames();
  if (g.lowHpWarning) Object.assign(g.lowHpWarning, createDefaultLowHpWarning());
  else g.lowHpWarning = createDefaultLowHpWarning();
  if (g.dynamicFov) Object.assign(g.dynamicFov, createDefaultDynamicFov());
  else g.dynamicFov = createDefaultDynamicFov();

  // ── Mission-specific subsystems ──
  if (g.escort) Object.assign(g.escort, createDefaultEscort());
  else g.escort = createDefaultEscort();
  if (g.beacon) Object.assign(g.beacon, createDefaultBeacon());
  else g.beacon = createDefaultBeacon();
  if (g.sabotage) Object.assign(g.sabotage, createDefaultSabotage());
  else g.sabotage = createDefaultSabotage();
  if (g.boss) Object.assign(g.boss, createDefaultBoss());
  else g.boss = createDefaultBoss();
  if (g.miniboss) Object.assign(g.miniboss, createDefaultMiniboss());
  else g.miniboss = createDefaultMiniboss();
  if (g.gauntlet) Object.assign(g.gauntlet, createDefaultGauntlet());
  else g.gauntlet = createDefaultGauntlet();
  if (g.waveSurge) Object.assign(g.waveSurge, createDefaultWaveSurge());
  else g.waveSurge = createDefaultWaveSurge();

  // ── Weather ──
  if (g.weather) Object.assign(g.weather, createDefaultWeather());
  else g.weather = createDefaultWeather();

  // ── Adaptive difficulty ──
  if (g.adaptiveDifficulty) {
    g.adaptiveDifficulty.pressureScore = 0;
    g.adaptiveDifficulty.pressureHistory = [];
    g.adaptiveDifficulty.lowPressureTimer = 0;
    g.adaptiveDifficulty.highPressureTimer = 0;
    g.adaptiveDifficulty.rampageMode = false;
    g.adaptiveDifficulty.missionsHighHp = 0;
    g.adaptiveDifficulty.spawnRateMult = 1;
    g.adaptiveDifficulty.enemyAggressionMult = 1;
  }

  // ── Mission / transition ──
  g.mission = null;
  g.isVictory = false;
  g.transitionTimer = undefined;
};
