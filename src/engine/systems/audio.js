/**
 * systems/audio.js — Per-frame audio event detection and sound playback.
 *
 * Called each frame: updateAudio(dt, g)
 * Detects transitions (new deaths, new pickups, new hits) by comparing
 * current game state against the previous frame stored in g.audio._prev.
 *
 * Also manages procedural soundtrack intensity based on gameplay:
 * - calm: Few enemies, high HP
 * - tense: Many enemies or low HP
 * - triumphant: Mission completion transition
 *
 * @param {number} dt — Delta time (seconds)
 * @param {object} g — Game state
 */
import { SoundManager } from '../audio';

/**
 * @returns {boolean} Whether the game is currently in an active playing state.
 */
function isPlaying(g) {
  if (!g.mission) return false;
  if (g.mission.completed) return false;
  return true;
}

/**
 * Calculate soundtrack intensity from game state.
 * @param {object} g — Game state
 * @returns {'calm'|'tense'|'triumphant'}
 */
function calculateIntensity(g) {
  const enemyCount = g.enemies?.filter(e => e.active).length || 0;
  const hpPercent = g.player?.maxHp ? g.player.hp / g.player.maxHp : 1;

  // Tense if many enemies or low HP
  if (enemyCount >= 4 || hpPercent < 0.3) {
    return 'tense';
  }

  // Calm otherwise
  return 'calm';
}

/**
 * @returns {Map|null} Previous enemy active states keyed by enemy id.
 */
function getPrevEnemyStates(g) {
  if (!g.audio || !g.audio._prev || !g.audio._prev.enemyStates) return null;
  return g.audio._prev.enemyStates;
}

/**
 * @returns {Map|null} Previous pickup active states keyed by pickup id.
 */
function getPrevPickupStates(g) {
  if (!g.audio || !g.audio._prev || !g.audio._prev.pickupStates) return null;
  return g.audio._prev.pickupStates;
}

export const updateAudio = (dt, g) => {
  // Guard: missing audio config
  if (!g.audio) return;

  // Skip all audio when muted
  if (g.audio.muted) return;

  // ── Continuous sounds: start engine + soundtrack once when playing ──
  const playing = isPlaying(g);

  if (playing) {
    const prevPlaying = g.audio._prev ? g.audio._prev.playing : false;
    if (!prevPlaying) {
      // Just transitioned into playing — start continuous sounds
      SoundManager.play('engine');
      SoundManager.startSoundtrack('calm');
    }

    // Update soundtrack intensity based on game state
    const newIntensity = calculateIntensity(g);
    const prevIntensity = g.audio._prev ? g.audio._prev.soundtrackIntensity : 'calm';
    if (newIntensity !== prevIntensity) {
      SoundManager.setSoundtrackIntensity(newIntensity);
    }
  } else {
    // Stopped playing — stop continuous sounds if they were running
    if (g.audio._prev && g.audio._prev.playing) {
      SoundManager.stop('engine');
      SoundManager.stopSoundtrack();
    }
  }

  // ── Detect new explosions (enemies that just died) ──
  const prevEnemyStates = getPrevEnemyStates(g);
  if (g.enemies) {
    for (const e of g.enemies) {
      if (!e.id) continue;
      const wasActive = prevEnemyStates ? prevEnemyStates.get(e.id) : undefined;
      if (wasActive !== undefined && wasActive === true && e.active === false) {
        SoundManager.play('explosion');
      }
    }
  }

  // ── Detect new pickups collected ──
  const prevPickupStates = getPrevPickupStates(g);
  if (g.pickups) {
    for (const p of g.pickups) {
      if (!p.id) continue;
      const wasActive = prevPickupStates ? prevPickupStates.get(p.id) : undefined;
      if (wasActive !== undefined && wasActive === true && p.active === false) {
        SoundManager.play('pickup');
      }
    }
  }

  // ── Detect player hits (hp or shield decrease) ──
  const prevHp = g.audio._prev ? g.audio._prev.playerHp : undefined;
  const prevShield = g.audio._prev ? g.audio._prev.playerShield : undefined;

  if (prevHp !== undefined && prevShield !== undefined && g.player) {
    const shieldHit = prevShield !== undefined && g.player.shield < prevShield;
    const hpHit = prevHp !== undefined && g.player.hp < prevHp;

    if (shieldHit) SoundManager.play('shield_hit');
    if (hpHit) SoundManager.play('player_hit');
  }

  // ── Store current frame state as _prev for next frame ──
  if (!g.audio._prev) {
    g.audio._prev = {};
  }

  // Enemy active states
  if (!g.audio._prev.enemyStates) {
    g.audio._prev.enemyStates = new Map();
  }
  if (g.enemies) {
    for (const e of g.enemies) {
      if (e.id !== undefined) {
        g.audio._prev.enemyStates.set(e.id, e.active);
      }
    }
  }

  // Pickup active states
  if (!g.audio._prev.pickupStates) {
    g.audio._prev.pickupStates = new Map();
  }
  if (g.pickups) {
    for (const p of g.pickups) {
      if (p.id !== undefined) {
        g.audio._prev.pickupStates.set(p.id, p.active);
      }
    }
  }

  // Player hp and shield
  if (g.player) {
    g.audio._prev.playerHp = g.player.hp;
    g.audio._prev.playerShield = g.player.shield;
  }

  // Playing state
  g.audio._prev.playing = playing;
  g.audio._prev.soundtrackIntensity = SoundManager.getSoundtrackIntensity();
};
