/**
 * waveAnnounce.js — Wave announcement system.
 *
 * Manages the countdown timer between enemy spawn waves.
 * Plays audio countdown beeps at integer boundaries (2→1, 1→0).
 * Spawning is blocked while announcement is active.
 */
import { SoundManager } from '../audio';

/**
 * Update wave announcement timer and play countdown beeps.
 * @param {number} dt - Delta time in seconds
 * @param {object} g  - Game state
 */
export function updateWaveAnnounce(dt, g) {
  if (!g.waveAnnounce || !g.waveAnnounce.active) return;

  g.waveAnnounce.timer = Math.max(0, g.waveAnnounce.timer - dt);

  // Detect integer boundary crossings for countdown beeps
  const prevInt = Math.ceil(g.waveAnnounce.timer + dt);
  const currInt = Math.ceil(g.waveAnnounce.timer);

  if (prevInt !== currInt && currInt > 0) {
    SoundManager.play('countdown_beep');
  }

  // Announcement complete
  if (g.waveAnnounce.timer <= 0) {
    g.waveAnnounce.active = false;
    SoundManager.play('wave_start');
  }
}
