/**
 * audio.js — Procedural sound manager using Web Audio API.
 *
 * No external audio files or libraries. Every sound is generated from
 * oscillators and noise buffers at runtime.
 *
 * AudioContext is created lazily on first init()/play() call so that
 * browser autoplay policies are respected.
 *
 * Usage:
 *   SoundManager.init();
 *   SoundManager.play('shoot');
 *   SoundManager.play('engine');
 *   SoundManager.stop('engine');
 *   SoundManager.setMuted(true);
 *   SoundManager.setVolume(0.5);
 */

/* ────────────────────────────────────────────── */
/*  Noise buffer helpers (used by noise sounds)   */
/* ────────────────────────────────────────────── */

/**
 * Generate a white-noise AudioBuffer of the given duration (seconds).
 */
function createWhiteNoiseBuffer(ctx, duration) {
  const length = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/* ────────────────────────────────────────────── */
/*  Envelope helper — apply ADSR-style envelope   */
/* ────────────────────────────────────────────── */

/**
 * Apply a simple attack/hold/decay envelope to a gain node.
 * Returns the total envelope duration in seconds.
 */
function applyEnvelope(gainNode, attack, hold, decay, now) {
  const t = now;
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(1, t + attack);
  if (hold > 0) {
    gainNode.gain.setValueAtTime(1, t + attack + hold);
  }
  gainNode.gain.linearRampToValueAtTime(0, t + attack + hold + decay);
  return attack + hold + decay;
}

/* ────────────────────────────────────────────── */
/*  Individual sound generators                   */
/*  Each returns { duration, nodes: [] } or null  */
/*  if the context is unavailable.                */
/* ────────────────────────────────────────────── */

/** shoot — Short high-pitch pulse (autocannon) */
function playShoot(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.1);
  const dur = applyEnvelope(gainNode, 0.005, 0.02, 0.07, now);
  return { duration: dur, nodes: [osc] };
}

/** shoot_plasma — Low rumble burst */
function playShootPlasma(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.25);
  const dur = applyEnvelope(gainNode, 0.02, 0.05, 0.18, now);
  return { duration: dur, nodes: [osc] };
}

/** shoot_missile — Whoosh sweep */
function playShootMissile(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.35);
  const dur = applyEnvelope(gainNode, 0.01, 0.15, 0.15, now);
  return { duration: dur, nodes: [osc] };
}

/** hit — Crack/pop */
function playHit(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1500, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.08);
  const dur = applyEnvelope(gainNode, 0.002, 0.01, 0.05, now);
  return { duration: dur, nodes: [osc] };
}

/** explosion — Noise burst decay */
function playExplosion(ctx, gainNode, now) {
  const noise = createWhiteNoiseBuffer(ctx, 0.6);
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3000, now);
  filter.frequency.exponentialRampToValueAtTime(100, now + 0.5);
  source.connect(filter);
  filter.connect(gainNode);
  source.start(now);
  const dur = applyEnvelope(gainNode, 0.02, 0.1, 0.45, now);
  return { duration: dur, nodes: [source, filter] };
}

/** pickup — High ding */
function playPickup(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.setValueAtTime(1600, now + 0.05);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.15);
  const dur = applyEnvelope(gainNode, 0.005, 0.04, 0.1, now);
  return { duration: dur, nodes: [osc] };
}

/** shield_hit — Buzz deflection */
function playShieldHit(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.linearRampToValueAtTime(600, now + 0.06);
  osc.frequency.linearRampToValueAtTime(300, now + 0.12);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.15);
  const dur = applyEnvelope(gainNode, 0.005, 0.04, 0.08, now);
  return { duration: dur, nodes: [osc] };
}

/** player_hit — Low thud */
function playPlayerHit(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.2);
  const dur = applyEnvelope(gainNode, 0.01, 0.03, 0.15, now);
  return { duration: dur, nodes: [osc] };
}

/** mission_complete — Ascending chord */
function playMissionComplete(ctx, gainNode, now) {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  const oscs = [];
  const subGain = ctx.createGain();
  subGain.connect(gainNode);
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(notes[i], now);
    osc.connect(subGain);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.4);
    oscs.push(osc);
  }
  const dur = applyEnvelope(gainNode, 0.05, 0.3, 0.3, now);
  return { duration: dur, nodes: [...oscs, subGain] };
}

/** game_over — Descending tone */
function playGameOver(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.8);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 1.0);
  const dur = applyEnvelope(gainNode, 0.05, 0.3, 0.6, now);
  return { duration: dur, nodes: [osc] };
}

/** engine — Continuous low rumble drone (looping) */
function playEngine(ctx, gainNode, now) {
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(55, now);
  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(57, now); // slight detune for texture
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.5, now);
  osc1.connect(subGain);
  osc2.connect(subGain);
  subGain.connect(gainNode);
  osc1.start(now);
  osc2.start(now);
  return { duration: Infinity, nodes: [osc1, osc2, subGain], stop: () => {
    try { osc1.stop(); } catch { /* oscillator already stopped */ }
    try { osc2.stop(); } catch { /* oscillator already stopped */ }
  }};
}

/** bg_drone — Ambient space hum (looping) */
function playBgDrone(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, now);
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.3, now);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(5, now);
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(gainNode);
  osc.start(now);
  lfo.start(now);
  return { duration: Infinity, nodes: [osc, lfo, lfoGain], stop: () => {
    try { osc.stop(); } catch { /* oscillator already stopped */ }
    try { lfo.stop(); } catch { /* oscillator already stopped */ }
  }};
}

/** ui_click — Short blip */
function playUiClick(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, now);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.04);
  const dur = applyEnvelope(gainNode, 0.002, 0.01, 0.02, now);
  return { duration: dur, nodes: [osc] };
}

/* ────────────────────────────────────────────── */
/*  Sound definitions map                         */
/* ────────────────────────────────────────────── */

const SOUND_GENERATORS = {
  shoot: playShoot,
  shoot_plasma: playShootPlasma,
  shoot_missile: playShootMissile,
  hit: playHit,
  explosion: playExplosion,
  pickup: playPickup,
  shield_hit: playShieldHit,
  player_hit: playPlayerHit,
  mission_complete: playMissionComplete,
  game_over: playGameOver,
  engine: playEngine,
  bg_drone: playBgDrone,
  ui_click: playUiClick,
};

const CONTINUOUS_SOUNDS = new Set(['engine', 'bg_drone']);

/* ────────────────────────────────────────────── */
/*  SoundManager class                            */
/* ────────────────────────────────────────────── */

class SoundManagerClass {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this._muted = false;
    this._volume = 1;
    this._continuous = {}; // name -> { nodes, stopFn }
  }

  /**
   * Initialize the audio system.
   * Creates AudioContext lazily (browser autoplay policy).
   */
  init() {
    if (this.ctx) return; // already initialized
    if (typeof AudioContext === 'undefined') return; // Node.js / no Web Audio
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this._volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null; // creation failed
    }
  }

  /**
   * Play a sound by name.
   * @param {string} name — Sound key (e.g. 'shoot', 'explosion', 'engine')
   */
  play(name) {
    this.init();
    if (!this.ctx) return;

    const generator = SOUND_GENERATORS[name];
    if (!generator) return;

    // Resume context if suspended (autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // Stop any existing continuous sound with the same name
    if (CONTINUOUS_SOUNDS.has(name) && this._continuous[name]) {
      this._stopContinuous(name);
    }

    try {
      const gainNode = this.ctx.createGain();
      gainNode.connect(this.masterGain);

      const result = generator(this.ctx, gainNode, now);
      if (!result) return;

      // Track continuous sounds
      if (CONTINUOUS_SOUNDS.has(name)) {
        this._continuous[name] = {
          nodes: result.nodes,
          gainNode,
          stopFn: result.stop || null,
        };
      } else {
        // One-shot: disconnect gain after envelope finishes
        const disconnectTime = ((result.duration || 0.1) + 0.1) * 1000;
        setTimeout(() => {
          try { gainNode.disconnect(); } catch { /* already disconnected */ }
          result.nodes.forEach(node => {
            try { node.disconnect(); } catch { /* already disconnected */ }
          });
        }, disconnectTime);
      }
    } catch {
      // Silently ignore audio errors (e.g. context issues)
    }
  }

  /**
   * Stop a continuous sound by name.
   * @param {string} name — Sound key (e.g. 'engine', 'bg_drone')
   */
  stop(name) {
    this._stopContinuous(name);
  }

  /**
   * Toggle mute state.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this._muted = !!muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this._muted ? 0 : this._volume,
        this.ctx.currentTime
      );
    }
  }

  /**
   * @returns {boolean} Whether audio is currently muted.
   */
  isMuted() {
    return this._muted;
  }

  /**
   * Set master volume (0-1, clamped).
   * @param {number} vol
   */
  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this._muted) {
      this.masterGain.gain.setValueAtTime(
        this._volume,
        this.ctx.currentTime
      );
    }
  }

  /**
   * @returns {number} Current volume (0-1).
   */
  getVolume() {
    return this._volume;
  }

  /**
   * Destroy the audio system. Stops continuous sounds and closes AudioContext.
   */
  destroy() {
    for (const name of Object.keys(this._continuous)) {
      this._stopContinuous(name);
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch { /* context already closed */ }
      this.ctx = null;
      this.masterGain = null;
    }
  }

  /* ── internal helpers ── */

  _stopContinuous(name) {
    const entry = this._continuous[name];
    if (!entry) return;
    try {
      if (entry.stopFn) entry.stopFn();
      entry.nodes.forEach(node => {
        try { node.stop(); } catch { /* already stopped */ }
        try { node.disconnect(); } catch { /* already disconnected */ }
      });
      try { entry.gainNode.disconnect(); } catch { /* already disconnected */ }
    } catch {
      // ignore
    }
    delete this._continuous[name];
  }
}

/* ────────────────────────────────────────────── */
/*  Singleton export                              */
/* ────────────────────────────────────────────── */

const SoundManager = new SoundManagerClass();

export { SoundManager };
