/**
 * settingsOverlay.test.js — Tests for SettingsOverlay helper functions.
 *
 * Tests loadSettings, saveSettings, getDefaultSettings directly
 * (no React rendering needed — all logic lives in plain helpers).
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { setupLocalStorageMock, clearLocalStorageMock } from './helpers';
import { loadSettings, saveSettings, getDefaultSettings } from '../engine/settings';

describe('getDefaultSettings', () => {
  test('returns the documented default shape', () => {
    const defaults = getDefaultSettings();
    expect(defaults).toEqual({
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
      showRadarLegend: true,
    });
  });

  test('returns a new object each call', () => {
    const a = getDefaultSettings();
    const b = getDefaultSettings();
    expect(a).not.toBe(b);
  });

  test('volume is a number between 0 and 1', () => {
    const defaults = getDefaultSettings();
    expect(defaults.volume).toBeGreaterThanOrEqual(0);
    expect(defaults.volume).toBeLessThanOrEqual(1);
  });

  test('sfxVolume is a number between 0 and 1', () => {
    const defaults = getDefaultSettings();
    expect(defaults.sfxVolume).toBeGreaterThanOrEqual(0);
    expect(defaults.sfxVolume).toBeLessThanOrEqual(1);
  });

  test('musicVolume is a number between 0 and 1', () => {
    const defaults = getDefaultSettings();
    expect(defaults.musicVolume).toBeGreaterThanOrEqual(0);
    expect(defaults.musicVolume).toBeLessThanOrEqual(1);
  });

  test('difficulty is one of the valid options', () => {
    const defaults = getDefaultSettings();
    expect(['easy', 'normal', 'hard']).toContain(defaults.difficulty);
  });

  test('particlesQuality is one of the valid options', () => {
    const defaults = getDefaultSettings();
    expect(['low', 'medium', 'high']).toContain(defaults.particlesQuality);
  });

  test('colorblindMode is one of the valid options', () => {
    const defaults = getDefaultSettings();
    expect(['none', 'protanopia', 'deuteranopia', 'tritanopia']).toContain(defaults.colorblindMode);
  });
});

describe('saveSettings', () => {
  beforeEach(() => setupLocalStorageMock());
  afterEach(() => clearLocalStorageMock());

  test('writes settings to localStorage as JSON', () => {
    const settings = getDefaultSettings();
    settings.volume = 0.8;
    settings.difficulty = 'hard';
    saveSettings(settings);

    const stored = localStorage.getItem('space_sentinel_settings');
    expect(stored).toBe(JSON.stringify(settings));
  });

  test('stores under the correct key', () => {
    saveSettings({ volume: 0.3 });
    expect(localStorage.getItem('space_sentinel_settings')).not.toBeNull();
    expect(localStorage.getItem('other_key')).toBeNull();
  });

  test('swallows quota errors without throwing', () => {
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => saveSettings(getDefaultSettings())).not.toThrow();
  });

  test('overwrites previous settings', () => {
    saveSettings({ volume: 0.5 });
    saveSettings({ volume: 0.9 });
    const stored = JSON.parse(localStorage.getItem('space_sentinel_settings'));
    expect(stored.volume).toBe(0.9);
  });
});

describe('loadSettings', () => {
  beforeEach(() => setupLocalStorageMock());
  afterEach(() => clearLocalStorageMock());

  test('returns defaults when key is absent', () => {
    const result = loadSettings();
    expect(result).toEqual(getDefaultSettings());
  });

  test('round-trips through localStorage', () => {
    const custom = {
      volume: 1.0,
      sfxVolume: 0.0,
      musicVolume: 0.25,
      difficulty: 'easy',
      showFPS: true,
      particlesQuality: 'low',
      screenShake: false,
      colorblindMode: 'protanopia',
      reducedMotion: true,
      highContrast: true,
      showRadarLegend: true,
    };
    saveSettings(custom);
    const loaded = loadSettings();
    expect(loaded).toEqual(custom);
  });

  test('returns defaults when JSON is corrupted', () => {
    localStorage.setItem('space_sentinel_settings', '{broken json!!!');
    const result = loadSettings();
    expect(result).toEqual(getDefaultSettings());
  });

  test('returns defaults when value is not JSON-parseable', () => {
    localStorage.setItem('space_sentinel_settings', 'just a string');
    const result = loadSettings();
    expect(result).toEqual(getDefaultSettings());
  });

  test('returns defaults when localStorage throws', () => {
    localStorage.getItem = () => { throw new DOMException('Security error'); };
    const result = loadSettings();
    expect(result).toEqual(getDefaultSettings());
  });

  test('returns defaults when stored value is null', () => {
    localStorage.setItem('space_sentinel_settings', 'null');
    const result = loadSettings();
    expect(result).toEqual(getDefaultSettings());
  });

  test('returns defaults when stored value is empty string', () => {
    localStorage.setItem('space_sentinel_settings', '');
    const result = loadSettings();
    expect(result).toEqual(getDefaultSettings());
  });

  test('returns partial settings merged with defaults', () => {
    // loadSettings returns whatever parses — no merging with defaults
    const partial = { volume: 0.99 };
    localStorage.setItem('space_sentinel_settings', JSON.stringify(partial));
    const result = loadSettings();
    expect(result.volume).toBe(0.99);
    expect(result.sfxVolume).toBe(getDefaultSettings().sfxVolume);
  });
});
