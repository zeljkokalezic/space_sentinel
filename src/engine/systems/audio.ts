/**
 * systems/audio.ts — Per-frame audio event detection and sound playback.
 *
 * Called each frame: updateAudio(dt, g)
 * Detects transitions (new deaths, new pickups, new hits) by comparing
 * current game state against the previous frame stored in g.audio._prev.
 *
 * Also manages procedural soundtrack intensity based on gameplay:
 * - calm: Few enemies, high HP
 * - tense: Many enemies or low HP
 * - triumphant: Mission completion transition
 */
import { SoundManager } from '../audio';
import type { GameState } from '../state';

type Intensity = 'calm' | 'tense' | 'triumphant';

interface AudioPrev {
  playing?: boolean;
  soundtrackIntensity?: Intensity;
  enemyStates?: Map<number, boolean>;
  pickupStates?: Map<number, boolean>;
  playerHp?: number;
  playerShield?: number;
}

/** Runtime audio cache attached to g.audio (not part of the AudioState type). */
type AudioWithPrev = GameState['audio'] & { _prev?: AudioPrev };

interface IdEntity { id?: number; active: boolean }

/**
 * @returns Whether the game is currently in an active playing state.
 */
function isPlaying(g: GameState): boolean {
  if (!g.mission) return false;
  if (g.mission.completed) return false;
  return true;
}

/**
 * Calculate soundtrack intensity from game state.
 */
function calculateIntensity(g: GameState): Intensity {
  const enemyCount = (g.enemies as IdEntity[])?.filter(e => e.active).length || 0;
  const hpPercent = g.player?.maxHp ? g.player.hp / g.player.maxHp : 1;

  // Tense if many enemies or low HP
  if (enemyCount >= 4 || hpPercent < 0.3) {
    return 'tense';
  }

  // Calm otherwise
  return 'calm';
}

/**
 * @returns Previous enemy active states keyed by enemy id.
 */
function getPrevEnemyStates(g: GameState): Map<number, boolean> | null {
  const audio = g.audio as AudioWithPrev;
  if (!audio || !audio._prev || !audio._prev.enemyStates) return null;
  return audio._prev.enemyStates;
}

/**
 * @returns Previous pickup active states keyed by pickup id.
 */
function getPrevPickupStates(g: GameState): Map<number, boolean> | null {
  const audio = g.audio as AudioWithPrev;
  if (!audio || !audio._prev || !audio._prev.pickupStates) return null;
  return audio._prev.pickupStates;
}

export const updateAudio = (dt: number, g: GameState): void => {
  // Guard: missing audio config
  if (!g.audio) return;

  // Skip all audio when muted
  if (g.audio.muted) return;

  const audio = g.audio as AudioWithPrev;

  // ── Continuous sounds: start engine + soundtrack once when playing ──
  const playing = isPlaying(g);

  if (playing) {
    const prevPlaying = audio._prev ? audio._prev.playing : false;
    if (!prevPlaying) {
      // Just transitioned into playing — start continuous sounds
      SoundManager.play('engine');
      SoundManager.startSoundtrack('calm');
    }

    // Update soundtrack intensity based on game state
    const newIntensity = calculateIntensity(g);
    const prevIntensity = audio._prev ? audio._prev.soundtrackIntensity : 'calm';
    if (newIntensity !== prevIntensity) {
      SoundManager.setSoundtrackIntensity(newIntensity);
    }
  } else {
    // Stopped playing — stop continuous sounds if they were running
    if (audio._prev && audio._prev.playing) {
      SoundManager.stop('engine');
      SoundManager.stopSoundtrack();
    }
  }

  // ── Detect new explosions (enemies that just died) ──
  const prevEnemyStates = getPrevEnemyStates(g);
  if (g.enemies) {
    for (const e of g.enemies as IdEntity[]) {
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
    for (const p of g.pickups as IdEntity[]) {
      if (!p.id) continue;
      const wasActive = prevPickupStates ? prevPickupStates.get(p.id) : undefined;
      if (wasActive !== undefined && wasActive === true && p.active === false) {
        SoundManager.play('pickup');
      }
    }
  }

  // ── Detect player hits (hp or shield decrease) ──
  const prevHp = audio._prev ? audio._prev.playerHp : undefined;
  const prevShield = audio._prev ? audio._prev.playerShield : undefined;

  if (prevHp !== undefined && prevShield !== undefined && g.player) {
    const shieldHit = prevShield !== undefined && g.player.shield < prevShield;
    const hpHit = prevHp !== undefined && g.player.hp < prevHp;

    if (shieldHit) SoundManager.play('shield_hit');
    if (hpHit) SoundManager.play('player_hit');
  }

  // ── Store current frame state as _prev for next frame ──
  if (!audio._prev) {
    audio._prev = {};
  }

  // Enemy active states
  if (!audio._prev.enemyStates) {
    audio._prev.enemyStates = new Map();
  }
  if (g.enemies) {
    for (const e of g.enemies as IdEntity[]) {
      if (e.id !== undefined) {
        audio._prev.enemyStates.set(e.id, e.active);
      }
    }
  }

  // Pickup active states
  if (!audio._prev.pickupStates) {
    audio._prev.pickupStates = new Map();
  }
  if (g.pickups) {
    for (const p of g.pickups as IdEntity[]) {
      if (p.id !== undefined) {
        audio._prev.pickupStates.set(p.id, p.active);
      }
    }
  }

  // Player hp and shield
  if (g.player) {
    audio._prev.playerHp = g.player.hp;
    audio._prev.playerShield = g.player.shield;
  }

  // Playing state
  audio._prev.playing = playing;
  audio._prev.soundtrackIntensity = SoundManager.getSoundtrackIntensity();
};
