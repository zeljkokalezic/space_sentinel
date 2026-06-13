/**
 * waveAnnounce.ts — Wave announcement system.
 */
import { SoundManager } from '../audio';
import type { GameState } from '../state';

export function updateWaveAnnounce(dt: number, g: GameState): void {
  if (!g.waveAnnounce?.active) return;

  g.waveAnnounce.timer = Math.max(0, g.waveAnnounce.timer - dt);

  const prevInt = Math.ceil(g.waveAnnounce.timer + dt);
  const currInt = Math.ceil(g.waveAnnounce.timer);

  if (prevInt !== currInt && currInt > 0) {
    SoundManager.play('countdown_beep');
  }

  if (g.waveAnnounce.timer <= 0) {
    g.waveAnnounce.active = false;
    SoundManager.play('wave_start');
  }
}
