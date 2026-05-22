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

/** combo_milestone — Ascending chime */
function playComboMilestone(ctx, gainNode, now) {
  const notes = [880, 1108.73, 1318.51] // A5, C#6, E6
  const oscs = []
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(notes[i], now)
    osc.connect(gainNode)
    osc.start(now + i * 0.06)
    osc.stop(now + i * 0.06 + 0.15)
    oscs.push(osc)
  }
  const dur = applyEnvelope(gainNode, 0.01, 0.1, 0.2, now)
  return { duration: dur, nodes: oscs }
}

/** powerup_pickup — Bright ascending sparkle */
function playPowerupPickup(ctx, gainNode, now) {
  const notes = [1046.5, 1318.51, 1567.98, 2093] // C6, E6, G6, C7
  const oscs = [];
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(notes[i], now);
    osc.connect(gainNode);
    osc.start(now + i * 0.04);
    osc.stop(now + i * 0.04 + 0.12);
    oscs.push(osc);
  }
  const dur = applyEnvelope(gainNode, 0.005, 0.1, 0.25, now);
  return { duration: dur, nodes: oscs };
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

/** soundtrack_calm — Gentle ambient pad (looping) */
function _playSoundtrackCalm(ctx, gainNode, now) {
  // Two detuned sine pads for ambient texture
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(110, now); // A2
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(164.81, now); // E3
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(220, now); // A3

  // Slow LFO for gentle movement
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.15, now);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(3, now);
  lfo.connect(lfoGain);
  lfoGain.connect(osc1.frequency);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.3, now);
  osc1.connect(subGain);
  osc2.connect(subGain);
  osc3.connect(subGain);
  subGain.connect(gainNode);

  osc1.start(now);
  osc2.start(now);
  osc3.start(now);
  lfo.start(now);

  return { duration: Infinity, nodes: [osc1, osc2, osc3, lfo, lfoGain, subGain], stop: () => {
    try { osc1.stop(); } catch { /* already stopped */ }
    try { osc2.stop(); } catch { /* already stopped */ }
    try { osc3.stop(); } catch { /* already stopped */ }
    try { lfo.stop(); } catch { /* already stopped */ }
  }};
}

/** soundtrack_tense — Pulsing rhythm with low bass (looping) */
function _playSoundtrackTense(ctx, gainNode, now) {
  // Low pulsing bass
  const bass = ctx.createOscillator();
  bass.type = 'sawtooth';
  bass.frequency.setValueAtTime(55, now); // A1

  // Pulsing LFO for rhythm
  const pulseLfo = ctx.createOscillator();
  pulseLfo.type = 'square';
  pulseLfo.frequency.setValueAtTime(2, now); // 2Hz pulse
  const pulseGain = ctx.createGain();
  pulseGain.gain.setValueAtTime(0.4, now);
  pulseLfo.connect(pulseGain);

  // Dissonant pad
  const pad = ctx.createOscillator();
  pad.type = 'sine';
  pad.frequency.setValueAtTime(146.83, now); // D3
  const pad2 = ctx.createOscillator();
  pad2.type = 'sine';
  pad2.frequency.setValueAtTime(185, now); // F#3 (tritone tension)

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, now);
  pulseGain.connect(filter.frequency);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.25, now);
  bass.connect(filter);
  pad.connect(filter);
  pad2.connect(filter);
  filter.connect(subGain);
  subGain.connect(gainNode);

  bass.start(now);
  pad.start(now);
  pad2.start(now);
  pulseLfo.start(now);

  return { duration: Infinity, nodes: [bass, pad, pad2, pulseLfo, pulseGain, filter, subGain], stop: () => {
    try { bass.stop(); } catch { /* already stopped */ }
    try { pad.stop(); } catch { /* already stopped */ }
    try { pad2.stop(); } catch { /* already stopped */ }
    try { pulseLfo.stop(); } catch { /* already stopped */ }
  }};
}

/** soundtrack_triumphant — Bright ascending chords (looping) */
function _playSoundtrackTriumphant(ctx, gainNode, now) {
  // Bright major chord arpeggio
  const notes = [261.63, 329.63, 392, 523.25]; // C4, E4, G4, C5
  const oscs = [];
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.2, now);
  subGain.connect(gainNode);

  for (const freq of notes) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(subGain);
    osc.start(now);
    oscs.push(osc);
  }

  // Slow ascending LFO for uplifting feel
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.2, now);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(10, now);
  lfo.connect(lfoGain);
  lfoGain.connect(oscs[0].frequency);
  lfo.start(now);
  oscs.push(lfo);

  return { duration: Infinity, nodes: [...oscs, lfoGain, subGain], stop: () => {
    oscs.forEach(o => { try { o.stop(); } catch { /* already stopped */ } });
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

/** boss_phase_change — Deep rising alarm tone */
function playBossPhaseChange(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.6);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.7);
  const dur = applyEnvelope(gainNode, 0.02, 0.2, 0.4, now);
  return { duration: dur, nodes: [osc] };
}

/** enemy_shoot — Harsh electronic blast */
function playEnemyShoot(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.12);
  const dur = applyEnvelope(gainNode, 0.005, 0.02, 0.08, now);
  return { duration: dur, nodes: [osc] };
}

/** wave_announce — Ascending tone sweep signaling incoming wave */
function playWaveAnnounce(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.4);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.5);
  const dur = applyEnvelope(gainNode, 0.02, 0.15, 0.25, now);
  return { duration: dur, nodes: [osc] };
}

/** countdown_beep — Short high beep for countdown (2, 1) */
function playCountdownBeep(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.1);
  const dur = applyEnvelope(gainNode, 0.005, 0.03, 0.06, now);
  return { duration: dur, nodes: [osc] };
}

/** wave_start — Sharp attack sound signaling wave has begun */
function playWaveStart(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.25);
  const dur = applyEnvelope(gainNode, 0.005, 0.05, 0.15, now);
  return { duration: dur, nodes: [osc] };
}

/** boss_spawn — Deep rumble + rising alarm (dramatic boss entrance) */
function playBossSpawn(ctx, gainNode, now) {
  // Low noise rumble
  const noise = createWhiteNoiseBuffer(ctx, 1.2);
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noise;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(800, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 1.0);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(gainNode);
  noiseSource.start(now);

  // Rising sawtooth alarm
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);
  osc.frequency.exponentialRampToValueAtTime(150, now + 1.0);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  osc.connect(oscGain);
  oscGain.connect(gainNode);
  osc.start(now);
  osc.stop(now + 1.2);

  const dur = applyEnvelope(gainNode, 0.05, 0.3, 0.7, now);
  return { duration: dur, nodes: [noiseSource, noiseFilter, osc, oscGain] };
}

/** boss_intro — Descending minor chord sting (boss name reveal) */
function playBossIntro(ctx, gainNode, now) {
  // Minor chord: C4, Eb4, Gb4 descending
  const notes = [261.63, 311.13, 369.99];
  const oscs = [];
  const subGain = ctx.createGain();
  subGain.connect(gainNode);
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(notes[i], now);
    osc.frequency.exponentialRampToValueAtTime(notes[i] * 0.5, now + 0.5);
    osc.connect(subGain);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.6);
    oscs.push(osc);
  }
  const dur = applyEnvelope(gainNode, 0.02, 0.2, 0.4, now);
  return { duration: dur, nodes: [...oscs, subGain] };
}

/** heartbeat — Low thump for low HP warning (dual-layer: thump + click) */
function playHeartbeat(ctx, gainNode, now) {
  // Layer 1: Low thump (first beat of the "lub-dub")
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(60, now);
  osc1.frequency.exponentialRampToValueAtTime(30, now + 0.08);
  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(1, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
  osc1.connect(gain1);
  gain1.connect(gainNode);
  osc1.start(now);
  osc1.stop(now + 0.12);

  // Layer 2: Higher click (second beat — "dub")
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(80, now + 0.12);
  osc2.frequency.exponentialRampToValueAtTime(40, now + 0.18);
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.setValueAtTime(0.6, now + 0.12);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
  osc2.connect(gain2);
  gain2.connect(gainNode);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.25);

  return { duration: 0.25, nodes: [osc1, osc2, gain1, gain2] };
}

/** shield_break — Electric shatter: high-frequency noise burst with descending pitch */
function playShieldBreak(ctx, gainNode, now) {
  // Layer 1: High-frequency electric crackle (noise burst)
  const noise = createWhiteNoiseBuffer(ctx, 0.5);
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noise;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(4000, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(500, now + 0.3);
  noiseFilter.Q.setValueAtTime(2, now);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(gainNode);
  noiseSource.start(now);

  // Layer 2: Descending electric hum (shield energy dissipating)
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(2000, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.35);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  osc.connect(oscGain);
  oscGain.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.4);

  const dur = applyEnvelope(gainNode, 0.005, 0.08, 0.3, now);
  return { duration: dur, nodes: [noiseSource, noiseFilter, osc, oscGain] };
}

/** shield_restore — Bright ascending chime: shield fully restored */
function playShieldRestore(ctx, gainNode, now) {
  // Layer 1: Ascending chime (C5 → E5 → G5 → C6)
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const oscs = [];
  const subGain = ctx.createGain();
  subGain.connect(gainNode);
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(notes[i], now);
    osc.connect(subGain);
    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.2);
    oscs.push(osc);
  }

  // Layer 2: Shield hum (rising then settling — like energy building up)
  const hum = ctx.createOscillator();
  hum.type = 'sine';
  hum.frequency.setValueAtTime(200, now);
  hum.frequency.exponentialRampToValueAtTime(600, now + 0.15);
  hum.frequency.exponentialRampToValueAtTime(400, now + 0.4);
  const humGain = ctx.createGain();
  humGain.gain.setValueAtTime(0.3, now);
  humGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  hum.connect(humGain);
  humGain.connect(gainNode);
  hum.start(now);
  hum.stop(now + 0.55);

  const dur = applyEnvelope(gainNode, 0.01, 0.15, 0.35, now);
  return { duration: dur, nodes: [...oscs, subGain, hum, humGain] };
}

/** enemy_spawn — Quick sharp pop signaling new enemy appearance */
function playEnemySpawn(ctx, gainNode, now) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + 0.1);
  const dur = applyEnvelope(gainNode, 0.002, 0.02, 0.06, now);
  return { duration: dur, nodes: [osc] };
}

/** scrap_collect — Bright metallic "cha-ching" coin pickup sound */
function playScrapCollect(ctx, gainNode, now) {
  // High metallic ping
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1800, now);
  osc1.frequency.exponentialRampToValueAtTime(2400, now + 0.03);
  osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
  osc1.connect(gainNode);
  osc1.start(now);
  osc1.stop(now + 0.15);
  // Secondary shimmer
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2800, now + 0.02);
  osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
  osc2.connect(gainNode);
  osc2.start(now + 0.02);
  osc2.stop(now + 0.15);
  const dur = applyEnvelope(gainNode, 0.002, 0.02, 0.1, now);
  return { duration: dur, nodes: [osc1, osc2] };
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
  shield_break: playShieldBreak,
  shield_restore: playShieldRestore,
  player_hit: playPlayerHit,
  mission_complete: playMissionComplete,
  game_over: playGameOver,
  combo_milestone: playComboMilestone,
  powerup_pickup: playPowerupPickup,
  engine: playEngine,
  bg_drone: playBgDrone,
  ui_click: playUiClick,
  boss_phase_change: playBossPhaseChange,
 enemy_shoot: playEnemyShoot,
  wave_announce: playWaveAnnounce,
  countdown_beep: playCountdownBeep,
  wave_start: playWaveStart,
  soundtrack_calm: _playSoundtrackCalm,
  soundtrack_tense: _playSoundtrackTense,
  soundtrack_triumphant: _playSoundtrackTriumphant,
  boss_spawn: playBossSpawn,
  boss_intro: playBossIntro,
  heartbeat: playHeartbeat,
  enemy_spawn: playEnemySpawn,
  scrap_collect: playScrapCollect,
};

const CONTINUOUS_SOUNDS = new Set(['engine', 'bg_drone', 'soundtrack_calm', 'soundtrack_tense', 'soundtrack_triumphant']);

/* ────────────────────────────────────────────── */
/*  SoundManager class                            */
/* ────────────────────────────────────────────── */

class SoundManagerClass {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this._muted = false;
    this._volume = 1;
    this._sfxVolume = 1;
    this._musicVolume = 1;
    this._continuous = {}; // name -> { nodes, stopFn }
    this._soundtrackIntensity = 'calm'; // 'calm' | 'tense' | 'triumphant'
    this._soundtrackActive = false;
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
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this._volume, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this._sfxVolume, this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(this._musicVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null; // creation failed
    }
  }

  /**
   * Set the soundtrack intensity level.
   * Crossfades between intensity layers smoothly.
   * @param {'calm'|'tense'|'triumphant'} intensity
   */
  setSoundtrackIntensity(intensity) {
    if (intensity === this._soundtrackIntensity) return; // no change
    if (!this.ctx) return;

    const oldIntensity = this._soundtrackIntensity;
    this._soundtrackIntensity = intensity;

    const now = this.ctx.currentTime;
    const crossfadeDuration = 1.5; // seconds

    // Fade out old intensity layer
    this._stopSoundtrackLayer(oldIntensity, now, crossfadeDuration);

    // Fade in new intensity layer
    this._startSoundtrackLayer(intensity, now, crossfadeDuration);
  }

  /**
   * Start the soundtrack system.
   * @param {'calm'|'tense'|'triumphant'} [initialIntensity='calm']
   */
  startSoundtrack(initialIntensity = 'calm') {
    if (this._soundtrackActive) return;
    this._soundtrackActive = true;
    this._soundtrackIntensity = initialIntensity;
    this._startSoundtrackLayer(initialIntensity, this.ctx?.currentTime, 0);
  }

  /**
   * Pause the audio system (suspend AudioContext).
   * Saves current state so resume() can restore it.
   */
  pause() {
    if (!this.ctx) return;
    this._pausedVolume = this._volume;
    this._wasMuted = this._muted;
    this.setMuted(true);
    this.ctx.suspend();
  }

  /**
   * Resume the audio system (resume AudioContext).
   */
  resume() {
    if (!this.ctx) return;
    this.ctx.resume();
    this.setMuted(this._wasMuted ?? false);
  }

  /**
   * Stop the soundtrack system.
   */
  stopSoundtrack() {
    if (!this._soundtrackActive) return;
    this._soundtrackActive = false;
    const now = this.ctx?.currentTime;
    if (now) {
      this._stopSoundtrackLayer(this._soundtrackIntensity, now, 1.0);
    } else {
      this._stopContinuous(`soundtrack_${this._soundtrackIntensity}`);
    }
    this._soundtrackIntensity = 'calm';
  }

  /**
   * @returns {boolean} Whether the soundtrack is active.
   */
  isSoundtrackActive() {
    return this._soundtrackActive;
  }

  /**
   * @returns {'calm'|'tense'|'triumphant'} Current soundtrack intensity.
   */
  getSoundtrackIntensity() {
    return this._soundtrackIntensity;
  }

  /**
   * Start a soundtrack layer with optional fade-in.
   * @param {'calm'|'tense'|'triumphant'} intensity
   * @param {number} now - Current audio time
   * @param {number} fadeDuration - Fade-in duration in seconds (0 for instant)
   */
  _startSoundtrackLayer(intensity, now, fadeDuration) {
    const name = `soundtrack_${intensity}`;
    const generator = SOUND_GENERATORS[name];
    if (!generator || !this.ctx) return;

    try {
      const gainNode = this.ctx.createGain();
      if (fadeDuration > 0) {
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1, now + fadeDuration);
      } else {
        gainNode.gain.setValueAtTime(1, now);
      }
      gainNode.connect(this.musicGain || this.masterGain);

      const result = generator(this.ctx, gainNode, now);
      if (!result) return;

      this._continuous[name] = {
        nodes: result.nodes,
        gainNode,
        stopFn: result.stop || null,
      };
    } catch {
      // Silently ignore audio errors
    }
  }

  /**
   * Stop a soundtrack layer with optional fade-out.
   * @param {'calm'|'tense'|'triumphant'} intensity
   * @param {number} now - Current audio time
   * @param {number} fadeDuration - Fade-out duration in seconds
   */
  _stopSoundtrackLayer(intensity, now, fadeDuration) {
    const name = `soundtrack_${intensity}`;
    const entry = this._continuous[name];
    if (!entry) return;

    try {
      if (fadeDuration > 0 && this.ctx) {
        entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, now);
        entry.gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);
        setTimeout(() => {
          this._stopContinuous(name);
        }, fadeDuration * 1000 + 100);
      } else {
        this._stopContinuous(name);
      }
    } catch {
      // Silently ignore
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
      const isMusic = name.startsWith('soundtrack_') || name === 'bg_drone';
      gainNode.connect(isMusic ? (this.musicGain || this.masterGain) : (this.sfxGain || this.masterGain));

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
   * Set SFX volume (0-1, clamped).
   * @param {number} vol
   */
  setSfxVolume(vol) {
    this._sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this._sfxVolume, this.ctx.currentTime);
    }
  }

  /**
   * Set music volume (0-1, clamped).
   * @param {number} vol
   */
  setMusicVolume(vol) {
    this._musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this._musicVolume, this.ctx.currentTime);
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
      this.sfxGain = null;
      this.musicGain = null;
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
