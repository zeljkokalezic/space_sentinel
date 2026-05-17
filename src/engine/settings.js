/**
 * settings.js — Persistent player settings helpers.
 */

const SETTINGS_KEY = 'space_sentinel_settings';

export function getDefaultSettings() {
  return {
    volume: 0.5,
    sfxVolume: 0.7,
    musicVolume: 0.5,
    difficulty: 'normal',
    showFPS: false,
    particlesQuality: 'high',
    screenShake: true,
    colorblindMode: 'none',
    reducedMotion: false,
    highContrast: false,
  };
}

export function normalizeSettings(settings) {
  if (!settings || typeof settings !== 'object') return getDefaultSettings();
  return { ...getDefaultSettings(), ...settings };
}

export function loadSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') return normalizeSettings(parsed);
    }
  } catch {
    // localStorage unavailable or corrupted data
  }
  return getDefaultSettings();
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // localStorage unavailable
  }
}
